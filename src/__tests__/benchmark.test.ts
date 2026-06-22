import { describe, it, expect } from 'vitest';
import algosdk from 'algosdk';
import { scoreWallet } from '../trust-score';
import { scoreDelegation } from '../delegation';
import { checkCounterparty } from '../counterparty';
import { estimateCredit } from '../credit';
import { detectSybil } from '../sybil';
import { computeReputation } from '../reputation';
import { underwrite } from '../underwriting';

const WALLET_COUNT = 1000;
const CONCURRENCY = 10;

interface BenchmarkResult {
  totalMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  throughput: number;
  memBefore: number;
  memAfter: number;
}

function generateWallets(count: number): string[] {
  const wallets: string[] = [];
  for (let i = 0; i < count; i++) {
    const account = algosdk.generateAccount();
    wallets.push(account.addr);
  }
  return wallets;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function formatMs(ms: number): string {
  return ms.toFixed(1);
}

function formatTable(results: { capability: string; mode: string; result: BenchmarkResult }[]): string {
  const header = [
    'Capability'.padEnd(22),
    'Mode'.padEnd(10),
    'Total(s)'.padEnd(10),
    'Avg(ms)'.padEnd(10),
    'P50(ms)'.padEnd(10),
    'P95(ms)'.padEnd(10),
    'P99(ms)'.padEnd(10),
    'Min(ms)'.padEnd(10),
    'Max(ms)'.padEnd(10),
    'Wallets/s'.padEnd(10),
    'Mem(MB)'.padEnd(10),
  ].join('│');

  const sep = '─'.repeat(header.length);
  const rows = results.map(r => {
    const res = r.result;
    return [
      r.capability.padEnd(22),
      r.mode.padEnd(10),
      formatMs(res.totalMs / 1000).padEnd(10),
      formatMs(res.avgMs).padEnd(10),
      formatMs(res.p50Ms).padEnd(10),
      formatMs(res.p95Ms).padEnd(10),
      formatMs(res.p99Ms).padEnd(10),
      formatMs(res.minMs).padEnd(10),
      formatMs(res.maxMs).padEnd(10),
      res.throughput.toFixed(1).padEnd(10),
      ((res.memAfter - res.memBefore) / 1024 / 1024).toFixed(2).padEnd(10),
    ].join('│');
  });

  return `\n┌${sep}┐\n│${header}│\n├${sep}┤\n${rows.map(r => `│${r}│`).join('\n')}\n└${sep}┘`;
}

async function measureSequential<T>(
  fn: (wallet: string) => Promise<T>,
  wallets: string[],
): Promise<BenchmarkResult> {
  const timings: number[] = [];
  const memBefore = process.memoryUsage().heapUsed;
  const start = performance.now();

  for (const wallet of wallets) {
    const s = performance.now();
    await fn(wallet);
    timings.push(performance.now() - s);
  }

  const totalMs = performance.now() - start;
  const memAfter = process.memoryUsage().heapUsed;
  timings.sort((a, b) => a - b);

  return {
    totalMs,
    avgMs: timings.reduce((a, b) => a + b, 0) / timings.length,
    p50Ms: percentile(timings, 50),
    p95Ms: percentile(timings, 95),
    p99Ms: percentile(timings, 99),
    minMs: timings[0],
    maxMs: timings[timings.length - 1],
    throughput: (wallets.length / totalMs) * 1000,
    memBefore,
    memAfter,
  };
}

async function measureConcurrent<T>(
  fn: (wallet: string) => Promise<T>,
  wallets: string[],
  concurrency: number,
): Promise<BenchmarkResult> {
  const timings: number[] = [];
  const memBefore = process.memoryUsage().heapUsed;
  const start = performance.now();

  for (let i = 0; i < wallets.length; i += concurrency) {
    const batch = wallets.slice(i, i + concurrency);
    const batchStart = performance.now();
    await Promise.all(batch.map(fn));
    timings.push(performance.now() - batchStart);
  }

  const totalMs = performance.now() - start;
  const memAfter = process.memoryUsage().heapUsed;
  timings.sort((a, b) => a - b);

  return {
    totalMs,
    avgMs: timings.reduce((a, b) => a + b, 0) / timings.length,
    p50Ms: percentile(timings, 50),
    p95Ms: percentile(timings, 95),
    p99Ms: percentile(timings, 99),
    minMs: timings[0],
    maxMs: timings[timings.length - 1],
    throughput: (wallets.length / totalMs) * 1000,
    memBefore,
    memAfter,
  };
}

const wallets = generateWallets(WALLET_COUNT);

describe('1K Wallet Benchmark', () => {
  it('Trust Scoring — Sequential', async () => {
    const res = await measureSequential(scoreWallet, wallets);
    expect(res.totalMs).toBeGreaterThan(0);
    expect(res.throughput).toBeGreaterThan(0);
    console.log(formatTable([{ capability: 'Trust Scoring', mode: 'Seq', result: res }]));
  }, 300000);

  it('Trust Scoring — Concurrent(10)', async () => {
    const res = await measureConcurrent(scoreWallet, wallets, CONCURRENCY);
    expect(res.totalMs).toBeGreaterThan(0);
    expect(res.throughput).toBeGreaterThan(0);
    console.log(formatTable([{ capability: 'Trust Scoring', mode: `Conc(${CONCURRENCY})`, result: res }]));
  }, 300000);

  it('Delegation — Sequential', async () => {
    const res = await measureSequential(scoreDelegation, wallets);
    expect(res.totalMs).toBeGreaterThan(0);
    expect(res.throughput).toBeGreaterThan(0);
    console.log(formatTable([{ capability: 'Delegation', mode: 'Seq', result: res }]));
  }, 300000);

  it('Delegation — Concurrent(10)', async () => {
    const res = await measureConcurrent(scoreDelegation, wallets, CONCURRENCY);
    expect(res.totalMs).toBeGreaterThan(0);
    expect(res.throughput).toBeGreaterThan(0);
    console.log(formatTable([{ capability: 'Delegation', mode: `Conc(${CONCURRENCY})`, result: res }]));
  }, 300000);

  it('Counterparty — Sequential', async () => {
    const res = await measureSequential(checkCounterparty, wallets);
    expect(res.totalMs).toBeGreaterThan(0);
    expect(res.throughput).toBeGreaterThan(0);
    console.log(formatTable([{ capability: 'Counterparty', mode: 'Seq', result: res }]));
  }, 300000);

  it('Counterparty — Concurrent(10)', async () => {
    const res = await measureConcurrent(checkCounterparty, wallets, CONCURRENCY);
    expect(res.totalMs).toBeGreaterThan(0);
    expect(res.throughput).toBeGreaterThan(0);
    console.log(formatTable([{ capability: 'Counterparty', mode: `Conc(${CONCURRENCY})`, result: res }]));
  }, 300000);

  it('Credit — Sequential', async () => {
    const res = await measureSequential(
      (w) => estimateCredit(w),
      wallets,
    );
    expect(res.totalMs).toBeGreaterThan(0);
    expect(res.throughput).toBeGreaterThan(0);
    console.log(formatTable([{ capability: 'Credit', mode: 'Seq', result: res }]));
  }, 300000);

  it('Credit — Concurrent(10)', async () => {
    const res = await measureConcurrent(
      (w) => estimateCredit(w),
      wallets,
      CONCURRENCY,
    );
    expect(res.totalMs).toBeGreaterThan(0);
    expect(res.throughput).toBeGreaterThan(0);
    console.log(formatTable([{ capability: 'Credit', mode: `Conc(${CONCURRENCY})`, result: res }]));
  }, 300000);

  it('Sybil — Sequential', async () => {
    const res = await measureSequential(detectSybil, wallets);
    expect(res.totalMs).toBeGreaterThan(0);
    expect(res.throughput).toBeGreaterThan(0);
    console.log(formatTable([{ capability: 'Sybil', mode: 'Seq', result: res }]));
  }, 300000);

  it('Sybil — Concurrent(10)', async () => {
    const res = await measureConcurrent(detectSybil, wallets, CONCURRENCY);
    expect(res.totalMs).toBeGreaterThan(0);
    expect(res.throughput).toBeGreaterThan(0);
    console.log(formatTable([{ capability: 'Sybil', mode: `Conc(${CONCURRENCY})`, result: res }]));
  }, 300000);

  it('Reputation — Sequential', async () => {
    const res = await measureSequential(computeReputation, wallets);
    expect(res.totalMs).toBeGreaterThan(0);
    expect(res.throughput).toBeGreaterThan(0);
    console.log(formatTable([{ capability: 'Reputation', mode: 'Seq', result: res }]));
  }, 300000);

  it('Reputation — Concurrent(10)', async () => {
    const res = await measureConcurrent(computeReputation, wallets, CONCURRENCY);
    expect(res.totalMs).toBeGreaterThan(0);
    expect(res.throughput).toBeGreaterThan(0);
    console.log(formatTable([{ capability: 'Reputation', mode: `Conc(${CONCURRENCY})`, result: res }]));
  }, 300000);

  it('Underwriting — Sequential', async () => {
    const res = await measureSequential(underwrite, wallets);
    expect(res.totalMs).toBeGreaterThan(0);
    expect(res.throughput).toBeGreaterThan(0);
    console.log(formatTable([{ capability: 'Underwriting', mode: 'Seq', result: res }]));
  }, 600000);

  it('Underwriting — Concurrent(10)', async () => {
    const res = await measureConcurrent(underwrite, wallets, CONCURRENCY);
    expect(res.totalMs).toBeGreaterThan(0);
    expect(res.throughput).toBeGreaterThan(0);
    console.log(formatTable([{ capability: 'Underwriting', mode: `Conc(${CONCURRENCY})`, result: res }]));
  }, 600000);
});
