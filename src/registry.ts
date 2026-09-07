/**
 * On-chain Delegation Registry
 *
 * Submits add_delegation / revoke_delegation transactions to the
 * Algorand stateful contract in `contracts/registry.teal`.
 *
 * The service is strictly on-chain: when REGISTRY_APP_ID is 0
 * (default in `.env.example`), every operation surfaces a
 * RegistryNotConfigured error and the HTTP layer must return 503.
 *
 * All amounts are microUSDC (uint64). The contract stores
 * `amount(8 bytes) + timestamp(8 bytes)` in a box keyed by
 * "del:" + delegator(32) + delegatee(32).
 */

import algosdk from 'algosdk';
import { config } from './config';
import { isValidWallet } from './lib/constants';
import { logger } from './lib/logger';
import { recordContractEvent } from './lib/metrics';
import { submitApplicationCall } from './lib/operator-wallet';

const REGISTRY_APP_ID = config.registryAppId;

export class RegistryNotConfiguredError extends Error {
  constructor() {
    super('Delegation registry contract is not configured (REGISTRY_APP_ID=0)');
    this.name = 'RegistryNotConfiguredError';
  }
}

export class RegistryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistryValidationError';
  }
}

interface DelegationResult {
  txId: string;
  sponsor: string;
  agent: string;
  amount: number;
  round: number;
  timestamp: number;
}

interface RevocationResult {
  txId: string;
  sponsor: string;
  agent: string;
  round: number;
  timestamp: number;
}

function validateArgs(sponsor: string, agent: string, amount?: number): void {
  if (!isValidWallet(sponsor)) {
    throw new RegistryValidationError('Invalid sponsor wallet address. Must be 58-character base32 (A-Z, 2-7).');
  }
  if (!isValidWallet(agent)) {
    throw new RegistryValidationError('Invalid agent wallet address. Must be 58-character base32 (A-Z, 2-7).');
  }
  if (sponsor === agent) {
    throw new RegistryValidationError('Sponsor and agent must be different wallets');
  }
  if (amount !== undefined) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new RegistryValidationError('Amount must be a positive finite number');
    }
    if (amount > Number.MAX_SAFE_INTEGER) {
      throw new RegistryValidationError('Amount exceeds maximum safe integer');
    }
  }
}

export async function delegate(
  sponsor: string,
  agent: string,
  amount: number,
): Promise<DelegationResult> {
  validateArgs(sponsor, agent, amount);
  if (REGISTRY_APP_ID === 0) {
    throw new RegistryNotConfiguredError();
  }

  const appArgs: Uint8Array[] = [
    new TextEncoder().encode('add_delegation'),
    algosdk.encodeUint64(Math.floor(amount)),
  ];
  const accounts = [agent];

  const txId = await submitApplicationCall(REGISTRY_APP_ID, appArgs, accounts);
  if (!txId) {
    throw new Error('Failed to submit delegation transaction');
  }

  recordContractEvent('endorsement');
  logger.info('Delegation submitted on-chain', { sponsor, agent, amount, txId });

  return {
    txId,
    sponsor,
    agent,
    amount: Math.floor(amount),
    round: 0,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

export async function revoke(
  sponsor: string,
  agent: string,
): Promise<RevocationResult> {
  validateArgs(sponsor, agent);
  if (REGISTRY_APP_ID === 0) {
    throw new RegistryNotConfiguredError();
  }

  const appArgs: Uint8Array[] = [
    new TextEncoder().encode('revoke_delegation'),
  ];
  const accounts = [agent];

  const txId = await submitApplicationCall(REGISTRY_APP_ID, appArgs, accounts);
  if (!txId) {
    throw new Error('Failed to submit revocation transaction');
  }

  recordContractEvent('revocation');
  logger.info('Revocation submitted on-chain', { sponsor, agent, txId });

  return {
    txId,
    sponsor,
    agent,
    round: 0,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

export function isRegistryConfigured(): boolean {
  return REGISTRY_APP_ID !== 0;
}
