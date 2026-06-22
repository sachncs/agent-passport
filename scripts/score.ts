import { scoreWallet, WalletTrustScore } from '../src/trust-score';

function printResult(r: WalletTrustScore): void {
  console.log('\n' + '='.repeat(60));
  console.log('  AGENT PASSPORT — TRUST SCORE');
  console.log('='.repeat(60));
  console.log(`  Wallet:    ${r.wallet}`);
  console.log(`  Score:     ${r.trustScore}`);
  console.log(`  Level:     ${r.riskLevel}`);
  console.log(`  Approved:  ${r.approved ? 'YES' : 'NO'}`);
  console.log(`  Limit:     $${r.recommendedLimit.toFixed(2)}`);
  console.log('-'.repeat(60));
  console.log('  ON-CHAIN DATA');
  console.log(`  Balance:   ${r.onChain.balanceAlgo.toFixed(4)} ALGO`);
  console.log(`  Txns:      ${r.onChain.totalTxns}`);
  console.log(`  Assets:    ${r.onChain.assetCount}`);
  console.log(`  Apps:      ${r.onChain.appCount}`);
  console.log(`  Age:       ${r.onChain.accountAgeDays} days`);
  console.log(`  First txn: round ${r.onChain.firstSeenRound}`);
  console.log(`  Last txn:  round ${r.onChain.lastSeenRound}`);
  console.log('-'.repeat(60));
  console.log('  SCORE BREAKDOWN');
  console.log(`  Age:       ${r.breakdown.ageScore}`);
  console.log(`  Activity:  ${r.breakdown.activityScore}`);
  console.log(`  Volume:    ${r.breakdown.volumeScore}`);
  console.log(`  Velocity:  ${r.breakdown.velocityScore}`);
  console.log(`  Compliance:${r.breakdown.complianceScore}`);
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
    console.error('Usage: npx tsx scripts/score.ts <WALLET_ADDRESS>');
    console.error('Example: npx tsx scripts/score.ts GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A');
    process.exit(1);
  }

  if (!/^[A-Z2-7]{58}$/.test(wallet)) {
    console.error('Invalid wallet address. Must be 58-character base32 (A-Z, 2-7).');
    process.exit(1);
  }

  console.log(`Scoring wallet: ${wallet}...`);

  const result = await scoreWallet(wallet);
  if (!result) {
    console.error('Failed to score wallet. Check network connectivity.');
    process.exit(1);
  }

  printResult(result);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
