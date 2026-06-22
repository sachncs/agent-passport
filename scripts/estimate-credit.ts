import { estimateCredit, CreditEstimate } from '../src/credit';

function printResult(r: CreditEstimate): void {
  console.log('\n' + '='.repeat(60));
  console.log('  AGENT PASSPORT — CREDIT ESTIMATE');
  console.log('='.repeat(60));
  console.log(`  Wallet:     ${r.wallet}`);
  console.log(`  Limit:      $${r.estimatedLimit.toFixed(2)}`);
  console.log(`  Risk:       ${r.risk}`);
  console.log(`  Confidence: ${(r.confidence * 100).toFixed(0)}%`);
  console.log(`  Approved:   ${r.approved ? 'YES' : 'NO'}`);
  console.log('-'.repeat(60));
  console.log('  BREAKDOWN');
  console.log(`  Balance Capacity:  $${r.breakdown.balanceCapacity.toFixed(2)}`);
  console.log(`  Activity Bonus:    $${r.breakdown.activityBonus.toFixed(2)}`);
  console.log(`  Age Bonus:         $${r.breakdown.ageBonus.toFixed(2)}`);
  console.log(`  Delegation Bonus:  $${r.breakdown.delegationBonus.toFixed(2)}`);
  console.log(`  Risk Penalty:      -$${r.breakdown.riskPenalty.toFixed(2)}`);
  console.log('-'.repeat(60));
  console.log('  EXPLANATION');
  for (const e of r.explanation) {
    console.log(`  - ${e}`);
  }
  console.log('='.repeat(60));
}

async function main() {
  const wallet = process.argv[2];
  const amount = process.argv[3] ? parseFloat(process.argv[3]) : undefined;

  if (!wallet) {
    console.error('Usage: npx tsx scripts/estimate-credit.ts <WALLET> [AMOUNT]');
    console.error('Example: npx tsx scripts/estimate-credit.ts GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A 200');
    process.exit(1);
  }

  if (!/^[A-Z2-7]{58}$/.test(wallet)) {
    console.error('Invalid wallet address. Must be 58-character base32 (A-Z, 2-7).');
    process.exit(1);
  }

  if (amount !== undefined && (isNaN(amount) || amount <= 0)) {
    console.error('Amount must be a positive number.');
    process.exit(1);
  }

  console.log(`Estimating credit for: ${wallet}${amount ? ` (requested: $${amount})` : ''}...`);

  const result = await estimateCredit(wallet, amount);
  if (!result) {
    console.error('Failed to estimate credit. Check network connectivity.');
    process.exit(1);
  }

  printResult(result);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
