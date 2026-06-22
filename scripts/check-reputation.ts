import { computeReputation, ReputationResult } from '../src/reputation';

function printResult(r: ReputationResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('  AGENT PASSPORT — REPUTATION');
  console.log('='.repeat(60));
  console.log(`  Wallet:     ${r.wallet}`);
  console.log(`  Reputation: ${r.reputation}`);
  console.log(`  Risk Level: ${r.riskLevel}`);
  console.log(`  Confidence: ${(r.confidence * 100).toFixed(0)}%`);
  console.log('-'.repeat(60));
  console.log('  BREAKDOWN');
  console.log(`  Payments:      ${r.breakdown.successfulPayments}`);
  console.log(`  Purchases:     ${r.breakdown.successfulPurchases}`);
  console.log(`  Disputes:      ${r.breakdown.disputes}`);
  console.log(`  Refunds:       ${r.breakdown.refunds}`);
  console.log(`  Endorsements:  ${r.breakdown.sponsorEndorsements}`);
  console.log(`  Services:      ${r.breakdown.serviceInteractions}`);
  console.log(`  Total Events:  ${r.breakdown.totalEvents}`);
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
    console.error('Usage: npx tsx scripts/check-reputation.ts <WALLET>');
    console.error('Example: npx tsx scripts/check-reputation.ts GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A');
    process.exit(1);
  }

  if (!/^[A-Z2-7]{58}$/.test(wallet)) {
    console.error('Invalid wallet address. Must be 58-character base32 (A-Z, 2-7).');
    process.exit(1);
  }

  console.log(`Checking reputation for: ${wallet}...`);

  const result = await computeReputation(wallet);
  if (!result) {
    console.error('Failed to compute reputation. Check network connectivity.');
    process.exit(1);
  }

  printResult(result);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
