import * as dotenv from 'dotenv';
dotenv.config();

import algosdk from 'algosdk';
import * as fs from 'fs';
import * as path from 'path';

const ALGOD_URL = process.env.ALGOD_URL || 'https://testnet-api.algonode.cloud:443';
const ALGOD_TOKEN = process.env.ALGOD_TOKEN || '';

async function main() {
  const mnemonic = process.env.DEPLOYER_MNEMONIC;
  if (!mnemonic) {
    console.error('Error: Set DEPLOYER_MNEMONIC in .env (25-word Algorand testnet mnemonic)');
    process.exit(1);
  }

  const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL);
  const deployer = algosdk.mnemonicToSecretKey(mnemonic);

  console.log(`Deployer: ${deployer.addr}`);

  const balance = await algod.accountInformation(deployer.addr).do();
  const balanceAlgo = Number((balance as any).amount) / 1_000_000;
  console.log(`Balance: ${balanceAlgo.toFixed(4)} ALGO`);

  if (balanceAlgo < 0.1) {
    console.error('Insufficient balance. Get testnet ALGO from https://testnet.algoexplorer.io/dispenser');
    process.exit(1);
  }

  const tealPath = path.join(__dirname, '..', 'contracts', 'reputation.teal');
  const tealSource = fs.readFileSync(tealPath, 'utf-8');

  console.log('Compiling TEAL...');
  const compileResponse = await algod.compile(tealSource).do();
  const approvalProgram = new Uint8Array(Buffer.from(compileResponse.result, 'base64'));

  const clearSource = '#pragma version 10\nint 1\n';
  const clearResponse = await algod.compile(clearSource).do();
  const clearProgram = new Uint8Array(Buffer.from(clearResponse.result, 'base64'));

  console.log('Deploying Reputation Contract...');
  const suggestedParams = await algod.getTransactionParams().do();

  const appCreateTxn = algosdk.makeApplicationCreateTxnFromObject({
    sender: deployer.addr,
    approvalProgram,
    clearProgram,
    numGlobalByteSlices: 1,  // admin address
    numGlobalInts: 1,        // total_events
    numLocalByteSlices: 0,
    numLocalInts: 0,
    suggestedParams,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
  });

  const signedTxn = appCreateTxn.signTxn(deployer.sk);
  const { txid } = await algod.sendRawTransaction(signedTxn).do();

  console.log(`Transaction: ${txid}`);

  const result = await algosdk.waitForConfirmation(algod, txid, 4);
  const appId = result['application-index'];
  const appAddress = algosdk.getApplicationAddress(appId);

  console.log(`\nReputation contract deployed!`);
  console.log(`  App ID:    ${appId}`);
  console.log(`  App Addr:  ${appAddress}`);
  console.log(`  Network:   testnet`);
  console.log(`\nAdd to .env:`);
  console.log(`  REPUTATION_APP_ID=${appId}`);

  console.log('\nFunding contract account (0.1 ALGO for MBR)...');
  const fundTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: deployer.addr,
    receiver: appAddress,
    amount: 100_000,
    suggestedParams,
  });

  const signedFund = fundTxn.signTxn(deployer.sk);
  const { txid: fundTxid } = await algod.sendRawTransaction(signedFund).do();
  await algosdk.waitForConfirmation(algod, fundTxid, 4);
  console.log('Contract account funded.');
}

main().catch((err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
