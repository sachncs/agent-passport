import { scoreDelegation, DelegationTrustScore } from '../src/delegation';

function printResult(r: DelegationTrustScore): void {
  console.log('\n' + '='.repeat(60));
  console.log('  AGENT PASSPORT — DELEGATION TRUST');
  console.log('='.repeat(60));
  console.log(`  Wallet:    ${r.wallet}`);
  console.log(`  Score:     ${r.trustScore}`);
  console.log(`  Level:     ${r.riskLevel}`);
  console.log(`  Approved:  ${r.approved ? 'YES' : 'NO'}`);
  console.log(`  Limit:     $${r.recommendedLimit.toFixed(2)}`);
  console.log('-'.repeat(60));
  console.log('  DELEGATION DATA');
  console.log(`  Depth:     ${r.delegation.depth} hop${r.delegation.depth !== 1 ? 's' : ''}`);
  console.log(`  Sponsors:  ${r.delegation.sponsorCount}`);
  console.log(`  Quality:   ${r.delegation.sponsorQuality}%`);
  console.log(`  Amount:    ${(r.delegation.totalDelegatedAmount / 1_000_000).toFixed(4)} ALGO`);
  console.log(`  Anchor:    ${r.delegation.isTrustAnchor ? 'YES' : 'NO'}`);
  console.log(`  Ancestors: ${r.delegation.trustedAncestors}`);
  console.log(`  Path:      ${r.delegation.delegationPath.join(' → ')}`);
  console.log('-'.repeat(60));
  console.log('  SCORE BREAKDOWN');
  console.log(`  Depth:       ${r.breakdown.depthScore}`);
  console.log(`  Quality:     ${r.breakdown.sponsorQualityScore}`);
  console.log(`  Count:       ${r.breakdown.sponsorCountScore}`);
  console.log(`  Amount:      ${r.breakdown.amountScore}`);
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
    console.error('Usage: npx tsx scripts/delegate.ts <WALLET_ADDRESS>');
    console.error('Example: npx tsx scripts/delegate.ts GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A');
    process.exit(1);
  }

  if (!/^[A-Z2-7]{58}$/.test(wallet)) {
    console.error('Invalid wallet address. Must be 58-character base32 (A-Z, 2-7).');
    process.exit(1);
  }

  console.log(`Scoring delegation trust for: ${wallet}...`);

  const result = await scoreDelegation(wallet);
  if (!result) {
    console.error('Failed to score delegation trust. Check network connectivity.');
    process.exit(1);
  }

  printResult(result);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
