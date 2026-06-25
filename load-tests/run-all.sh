#!/usr/bin/env bash
# Run all four load test scenarios against a local Agent Passport instance.
# Prerequisite: `npm run dev` (or `npm start`) running on http://localhost:3000

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
RESULTS_DIR="$(dirname "$0")/results"
mkdir -p "$RESULTS_DIR"

K6_BIN="${K6_BIN:-k6}"

if ! command -v "$K6_BIN" >/dev/null 2>&1; then
  echo "Error: k6 is not installed or not in PATH"
  echo "Install with: brew install k6 (macOS) or see https://k6.io/docs/getting-started/installation/"
  exit 1
fi

echo "Waiting for service to be ready at $BASE_URL ..."
for i in {1..30}; do
  if curl -sf "$BASE_URL/health" > /dev/null 2>&1; then
    echo "Service is up"
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "Service did not respond within 30s"
    exit 1
  fi
  sleep 1
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Scenario A: 100 concurrent users"
echo "═══════════════════════════════════════════════════════════════"
BASE_URL="$BASE_URL" "$K6_BIN" run --out json="$RESULTS_DIR/scenario-a.json" \
  "$(dirname "$0")/scenarios/a-100vu.js" \
  --summary-trend-stats="avg,min,med,max,p(50),p(90),p(95),p(99)" \
  | tee "$RESULTS_DIR/scenario-a.txt"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Scenario B: 500 concurrent users"
echo "═══════════════════════════════════════════════════════════════"
BASE_URL="$BASE_URL" "$K6_BIN" run --out json="$RESULTS_DIR/scenario-b.json" \
  "$(dirname "$0")/scenarios/b-500vu.js" \
  --summary-trend-stats="avg,min,med,max,p(50),p(90),p(95),p(99)" \
  | tee "$RESULTS_DIR/scenario-b.txt"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Scenario C: 1000 concurrent users (stress)"
echo "═══════════════════════════════════════════════════════════════"
BASE_URL="$BASE_URL" "$K6_BIN" run --out json="$RESULTS_DIR/scenario-c.json" \
  "$(dirname "$0")/scenarios/c-1000vu.js" \
  --summary-trend-stats="avg,min,med,max,p(50),p(90),p(95),p(99)" \
  | tee "$RESULTS_DIR/scenario-c.txt"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Scenario D: 10k requests/day sustained (3m accelerated)"
echo "═══════════════════════════════════════════════════════════════"
BASE_URL="$BASE_URL" "$K6_BIN" run --out json="$RESULTS_DIR/scenario-d.json" \
  "$(dirname "$0")/scenarios/d-sustained.js" \
  --summary-trend-stats="avg,min,med,max,p(50),p(90),p(95),p(99)" \
  | tee "$RESULTS_DIR/scenario-d.txt"

echo ""
echo "All scenarios complete. Results in $RESULTS_DIR"
