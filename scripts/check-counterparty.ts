import { checkCounterparty, CounterpartyResult } from '../src/counterparty';

function printResult(r: CounterpartyResult, wallet: string): void {
  console.log('\n' + '='.repeat(60));
  console.log('  AGENT PASSPORT — COUNTERPARTY CHECK');
  console.log('='.repeat(60));
  console.log(`  Buyer:     ${wallet}`);
  console.log(`  Allow:     ${r.allow ? 'YES' : 'NO'}`);
  console.log(`  Confidence: ${(r.confidence * 100).toFixed(0)}%`);
  console.log(`  Risk:      ${r.riskLevel}`);
  console.log(`  Trust:     ${r.trustScore}`);
  console.log('-'.repeat(60));
  console.log('  SCORES');
  console.log(`  On-chain:    ${r.onChainScore}`);
  console.log(`  Delegation:  ${r.delegationScore}`);
  console.log(`  Combined:    ${r.trustScore}`);
  console.log('-'.repeat(60));
  console.log('  EXPLANATION');
  for (const e of r.explanation) {
    console.log(`  - ${e}`);
  }
  console.log('='.repeat(60));
}

async function main() {
  const wallet = process.argv[2];
  if (!wallet) {
    console.error('Usage: npx tsx scripts/check-counterparty.ts <WALLET_ADDRESS>');
    console.error('Example: npx tsx scripts/check-counterparty.ts GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A');
    process.exit(1);
  }

  if (!/^[A-Z2-7]{58}$/.test(wallet)) {
    console.error('Invalid wallet address. Must be 58-character base32 (A-Z, 2-7).');
    process.exit(1);
  }

  console.log(`Checking counterparty: ${wallet}...`);

  const result = await checkCounterparty(wallet);
  if (!result) {
    console.error('Failed to check counterparty. Check network connectivity.');
    process.exit(1);
  }

  printResult(result, wallet);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
