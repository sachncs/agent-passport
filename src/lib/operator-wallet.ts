/**
 * Operator Wallet
 *
 * Handles signing and submitting Algorand transactions for the Agent
 * Passport system. The operator wallet is a pre-funded account that pays
 * transaction fees and submits state changes to the delegation registry
 * and reputation contracts.
 *
 * Configuration:
 *   OPERATOR_MNEMONIC — 25-word Algorand mnemonic for the operator wallet
 *
 * Security:
 *   - Mnemonic is loaded once at startup and held in memory
 *   - Never logged or exposed in API responses
 *   - In production, use AWS KMS / GCP Secret Manager instead of env vars
 */

import algosdk from 'algosdk';
import { algod } from './algorand-client';
import { logger } from './logger';
import { withTimeout } from './timeout';

let operatorAccount: algosdk.Account | null = null;

/**
 * Initializes the operator wallet from environment mnemonic.
 * Must be called once at startup before any transactions are submitted.
 */
export function initOperatorWallet(): boolean {
  const mnemonic = process.env.OPERATOR_MNEMONIC;
  if (!mnemonic) {
    logger.warn('OPERATOR_MNEMONIC not set — on-chain transactions will be disabled');
    return false;
  }

  try {
    const words = mnemonic.trim().split(/\s+/);
    if (words.length !== 25) {
      logger.error('OPERATOR_MNEMONIC must be 25 words', { wordCount: words.length });
      return false;
    }
    operatorAccount = algosdk.mnemonicToSecretKey(mnemonic);
    logger.info('Operator wallet initialized', {
      address: operatorAccount.addr.toString(),
    });
    return true;
  } catch (e) {
    logger.error('Failed to initialize operator wallet', { error: String(e) });
    return false;
  }
}

/** Whether initOperatorWallet() has successfully loaded an account. */
export function isOperatorInitialized(): boolean {
  return operatorAccount !== null;
}

export type SubmitApplicationCallResult =
  | { txId: string; confirmedRound: number; status: 'confirmed' }
  | { txId: string; confirmedRound: number; status: 'pending' };

/**
 * Signs and submits an application call transaction.
 *
 * After submission, polls `algod.pendingTransactionInformation(txId)`
 * for up to `CONFIRM_POLL_ROUNDS` rounds (~4.5s at 3.3s/block) waiting
 * for inclusion. If the transaction is included, `status` is
 * `'confirmed'` and `confirmedRound` is the round in which it landed.
 * If the poll window expires the response carries `status: 'pending'`
 * with `confirmedRound: 0` so callers can distinguish "submitted" from
 * "confirmed and known to be in a block".
 *
 * @param appIndex — Application ID to call
 * @param appArgs — Application arguments (array of Uint8Array)
 * @param accounts — Account references for the application call
 * @returns Result or null on failure to submit
 */
export async function submitApplicationCall(
  appIndex: number,
  appArgs: Uint8Array[],
  accounts: string[] = [],
): Promise<SubmitApplicationCallResult | null> {
  if (!operatorAccount) {
    logger.warn('Operator wallet not initialized — cannot submit transaction');
    return null;
  }

  try {
    const suggestedParams = await withTimeout(
      algod.getTransactionParams().do(),
      10_000,
      'getTransactionParams',
    );

    const txn = algosdk.makeApplicationCallTxnFromObject({
      sender: operatorAccount.addr,
      appIndex,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs,
      accounts,
      suggestedParams,
    });

    const signedTxn = txn.signTxn(operatorAccount.sk);
    const response = await withTimeout(
      algod.sendRawTransaction(signedTxn).do(),
      10_000,
      'sendRawTransaction',
    );

    const txId = response.txid;
    logger.info('Transaction submitted', { txId, appIndex });

    // Poll for confirmation so the caller can echo a real confirmed
    // round back over HTTP instead of a misleading zero.
    const confirmedRound = await waitForConfirmation(txId);
    return {
      txId,
      confirmedRound,
      status: confirmedRound > 0 ? 'confirmed' : 'pending',
    };
  } catch (e) {
    logger.error('Failed to submit application call', {
      appIndex,
      error: String(e),
    });
    return null;
  }
}

const CONFIRM_POLL_ROUNDS = 10;
const CONFIRM_POLL_INTERVAL_MS = 500;

/**
 * Polls algod.pendingTransactionInformation up to CONFIRM_POLL_ROUNDS
 * times, returning the block-inclusion round or 0 if still pending.
 * Exported for testing.
 */
export async function waitForConfirmation(txId: string): Promise<number> {
  for (let i = 0; i < CONFIRM_POLL_ROUNDS; i++) {
    try {
      const info = await withTimeout(
        algod.pendingTransactionInformation(txId).do(),
        5_000,
        'pendingTransactionInformation',
      ) as { 'confirmed-round'?: number };
      if (info && info['confirmed-round'] && info['confirmed-round'] > 0) {
        return Number(info['confirmed-round']);
      }
    } catch (e) {
      logger.warn('pendingTransactionInformation failed', {
        txId, attempt: i, error: String(e),
      });
    }
    await new Promise(r => setTimeout(r, CONFIRM_POLL_INTERVAL_MS));
  }
  return 0;
}
