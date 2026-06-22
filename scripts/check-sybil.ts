import { detectSybil, SybilResult } from '../src/sybil';

function printResult(r: SybilResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('  AGENT PASSPORT — SYBIL DETECTION');
  console.log('='.repeat(60));
  console.log(`  Wallet:          ${r.wallet}`);
  console.log(`  Sybil Risk:      ${r.sybilRisk}`);
  console.log(`  Risk Level:      ${r.riskLevel}`);
  console.log(`  Confidence:      ${(r.confidence * 100).toFixed(0)}%`);
  console.log(`  Cluster Size:    ${r.clusterSize} wallets`);
  console.log('-'.repeat(60));
  console.log('  SIGNALS');
  console.log(`  Creation Clustering:  ${r.signals.creationClustering.toFixed(2)}`);
  console.log(`  Interaction Density:  ${r.signals.interactionDensity.toFixed(2)}`);
  console.log(`  Balance Similarity:   ${r.signals.balanceSimilarity.toFixed(2)}`);
  console.log(`  Circular Activity:    ${r.signals.circularActivity.toFixed(2)}`);
  console.log('-'.repeat(60));
  if (r.flaggedWallets.length > 0) {
    console.log('  FLAGGED WALLETS');
    for (const w of r.flaggedWallets) {
      console.log(`  - ${w}`);
    }
    console.log('-'.repeat(60));
  }
  console.log('  EXPLANATION');
  for (const e of r.explanation) {
    console.log(`  - ${e}`);
  }
  console.log('='.repeat(60));
}

async function main() {
  const wallet = process.argv[2];

  if (!wallet) {
    console.error('Usage: npx tsx scripts/check-sybil.ts <WALLET>');
    console.error('Example: npx tsx scripts/check-sybil.ts GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A');
    process.exit(1);
  }

  if (!/^[A-Z2-7]{58}$/.test(wallet)) {
    console.error('Invalid wallet address. Must be 58-character base32 (A-Z, 2-7).');
    process.exit(1);
  }

  console.log(`Checking sybil risk for: ${wallet}...`);

  const result = await detectSybil(wallet);
  if (!result) {
    console.error('Failed to detect sybil risk. Check network connectivity.');
    process.exit(1);
  }

  printResult(result);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
