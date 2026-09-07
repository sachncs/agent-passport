// Custom k6 metrics for the Agent Passport load-test suite.
//
// `app_*` metrics complement the built-in `http_req_*` family. They are
// emitted by every scenario and consumed by the k6 `--summary-export`
// output. Thresholds in each scenario reference these names.

import { Rate, Trend, Counter } from 'k6/metrics';

// ── Errors ──────────────────────────────────────────────────────
/** Non-2xx response rate, computed by every scenario. */
export const errorRate = new Rate('app_errors');

// ── Latency by endpoint ─────────────────────────────────────────
/** End-to-end request duration across all endpoints. */
export const requestDuration = new Trend('app_request_duration');

/** `/score` endpoint duration. */
export const scoreDuration = new Trend('app_score_duration');
/** `/passport` endpoint duration. */
export const passportDuration = new Trend('app_passport_duration');
/** `/delegation` endpoint duration. */
export const delegationDuration = new Trend('app_delegation_duration');
/** `/underwrite` endpoint duration. */
export const underwritingDuration = new Trend('app_underwriting_duration');
/** `/counterparty-check` endpoint duration. */
export const counterpartyDuration = new Trend('app_counterparty_duration');
/** `/trust-graph` endpoint duration (BFS over Algorand on-chain data). */
export const graphTraversalLatency = new Trend('app_graph_traversal_latency');
/** `/credit-estimate` endpoint duration. */
export const creditEstimateDuration = new Trend('app_credit_estimate_duration');
/** `/sybil-check` endpoint duration. */
export const sybilCheckDuration = new Trend('app_sybil_check_duration');
/** `/reputation` endpoint duration. */
export const reputationDuration = new Trend('app_reputation_duration');
/** `/verify` endpoint duration. */
export const verifyDuration = new Trend('app_verify_duration');
/** `/discovery/search` endpoint duration. */
export const discoveryDuration = new Trend('app_discovery_duration');

// ── Cache ───────────────────────────────────────────────────────
export const cacheHits   = new Rate('app_cache_hits');
export const cacheMisses = new Rate('app_cache_misses');

// ── x402 payment failures ───────────────────────────────────────
export const x402Failures       = new Counter('app_x402_failures');
export const x402ReplayAttempts = new Counter('app_x402_replay_attempts');

// ── On-chain contract events ────────────────────────────────────
export const contractEndorsements = new Counter('app_contract_endorsements');
export const contractRevocations  = new Counter('app_contract_revocations');
export const contractDisputes     = new Counter('app_contract_disputes');

// ── HTTP status code breakdown ──────────────────────────────────
export const response2xx = new Counter('app_response_2xx');
export const response4xx = new Counter('app_response_4xx');
export const response5xx = new Counter('app_response_5xx');

/**
 * Records one observation for each metric, given a k6 response object.
 * Scenarios call this once per request after `http.get`/`http.post`.
 */
export function recordResponse(res, durationTrend) {
  const status = res.status;
  if (status >= 200 && status < 300) {
    errorRate.add(false);
    response2xx.add(1);
  } else if (status >= 400 && status < 500) {
    errorRate.add(true);
    response4xx.add(1);
  } else {
    errorRate.add(true);
    response5xx.add(1);
  }
  if (durationTrend) {
    durationTrend.add(res.timings.duration);
  }
  requestDuration.add(res.timings.duration);
}
