import { recordEvent, EventType, EVENT_TYPES } from '../src/reputation';

function printEvent(r: { wallet: string; eventType: string; amount: number; round: number; timestamp: number }): void {
  console.log('\n' + '='.repeat(60));
  console.log('  AGENT PASSPORT — RECORD REPUTATION EVENT');
  console.log('='.repeat(60));
  console.log(`  Wallet:    ${r.wallet}`);
  console.log(`  Event:     ${r.eventType}`);
  console.log(`  Amount:    ${r.amount} microAlgo (${(r.amount / 1_000_000).toFixed(4)} ALGO)`);
  console.log(`  Round:     ${r.round}`);
  console.log(`  Timestamp: ${new Date(r.timestamp * 1000).toISOString()}`);
  console.log('='.repeat(60));
}

async function main() {
  const wallet = process.argv[2];
  const eventType = process.argv[3] as EventType;
  const amount = process.argv[4] ? parseInt(process.argv[4], 10) : 0;
  const counterparty = process.argv[5];

  if (!wallet || !eventType) {
    console.error('Usage: npx tsx scripts/record-reputation.ts <WALLET> <EVENT_TYPE> [AMOUNT] [COUNTERPARTY]');
    console.error(`Event types: ${EVENT_TYPES.join(', ')}`);
    console.error('Example: npx tsx scripts/record-reputation.ts GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A payment 1000000');
    process.exit(1);
  }

  if (!/^[A-Z2-7]{58}$/.test(wallet)) {
    console.error('Invalid wallet address. Must be 58-character base32 (A-Z, 2-7).');
    process.exit(1);
  }

  if (!EVENT_TYPES.includes(eventType)) {
    console.error(`Invalid event type: ${eventType}. Must be one of: ${EVENT_TYPES.join(', ')}`);
    process.exit(1);
  }

  if (amount < 0) {
    console.error('Amount must be non-negative.');
    process.exit(1);
  }

  console.log(`Recording ${eventType} event for: ${wallet}...`);

  const result = await recordEvent(wallet, eventType, amount, counterparty);
  if (!result) {
    console.error('Failed to record event. Check network connectivity.');
    process.exit(1);
  }

  printEvent(result);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
