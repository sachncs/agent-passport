import { spawnSync } from 'child_process';

interface VitestJsonReport {
  numTotalTests: number;
  testResults?: unknown[];
}

export interface TestCount {
  tests: number;
  files: number;
}

export function readTestCount(): TestCount {
  const result = spawnSync(
    'npm',
    ['exec', '--', 'vitest', 'run', '--reporter=json'],
    { encoding: 'utf8', cwd: process.cwd() },
  );
  if (result.status !== 0) {
    throw new Error(
      `vitest run --reporter=json failed: ${result.stderr.slice(0, 500)}`,
    );
  }
  // Vitest 4 writes a final JSON line; Vitest 5 may emit the same report as
  // one multi-line JSON document after runner diagnostics. Support both
  // formats so this source-derived release check remains stable across the
  // supported dependency range.
  const output = result.stdout.trim();
  let report: VitestJsonReport | undefined;
  try {
    const parsed = JSON.parse(output) as VitestJsonReport;
    if (typeof parsed.numTotalTests === 'number') report = parsed;
  } catch {
    // Fall through to line and embedded-document parsing below.
  }

  // Split on newlines and pick the line that parses cleanly.
  const lines = result.stdout.split(/\r?\n/);
  for (const line of lines.reverse()) {
    try {
      const parsed = JSON.parse(line) as VitestJsonReport;
      if (typeof parsed.numTotalTests === 'number') {
        report = parsed;
        break;
      }
    } catch {
      // not JSON; keep looking
    }
  }

  if (!report) {
    const start = output.indexOf('{"numTotalTestSuites"');
    const end = output.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(output.slice(start, end + 1)) as VitestJsonReport;
        if (typeof parsed.numTotalTests === 'number') report = parsed;
      } catch {
        // Keep the actionable error below.
      }
    }
  }
  if (!report) {
    throw new Error('Could not parse vitest --reporter=json output');
  }
  // numTotalTestSuites counts every describe() block, which inflates
  // the figure. Use the per-file result array length instead.
  return {
    tests: report.numTotalTests,
    files: report.testResults?.length ?? 0,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const count = readTestCount();
  console.log(JSON.stringify(count, null, 2));
}
