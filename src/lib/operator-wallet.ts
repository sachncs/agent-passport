/**
 * Operator Wallet
 *
 * Handles signing and submitting Algorand transactions for the Agent Passport system.
 * The operator wallet is a pre-funded account that pays transaction fees and submits
 * state changes to the delegation registry and reputation contracts.
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
import { withTimeout } from './timeout';
import { logger } from './logger';

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

/**
 * Returns the operator account, or null if not initialized.
 */
export function getOperatorAccount(): algosdk.Account | null {
  return operatorAccount;
}

/** Whether initOperatorWallet() has successfully loaded an account. */
export function isOperatorInitialized(): boolean {
  return operatorAccount !== null;
}

/**
 * Returns the operator address as a string, or null if not initialized.
 */
export function getOperatorAddress(): string | null {
  return operatorAccount?.addr.toString() ?? null;
}

/**
 * Signs and submits an application call transaction.
 *
 * @param appIndex — Application ID to call
 * @param appArgs — Application arguments (array of Uint8Array)
 * @param accounts — Account references for the application call
 * @returns Transaction ID, or null on failure
 */
export async function submitApplicationCall(
  appIndex: number,
  appArgs: Uint8Array[],
  accounts: string[] = [],
): Promise<string | null> {
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
    return txId;
  } catch (e) {
    logger.error('Failed to submit application call', {
      appIndex,
      error: String(e),
    });
    return null;
  }
}
