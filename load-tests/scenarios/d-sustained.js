// Scenario D: 10,000 requests/day sustained — long-tail capacity test
// Simulates a steady-state of ~0.116 req/s over 24h, accelerated.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, pickWallet, VALID_WALLET } from '../lib/config.js';
import {
  errorRate,
  requestDuration,
  trustScoreDuration,
  recordResponse,
} from '../lib/metrics.js';

export const options = {
  scenarios: {
    d_sustained: {
      executor: 'constant-arrival-rate',
      // 10000 requests per 24h = ~0.116 req/s — we accelerate to 12 req/s
      // for a 3-minute window to gather meaningful data
      rate: 12,
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
  thresholds: {
    'http_req_duration{expected_response:true}': ['p(95)<300', 'p(99)<800'],
    'http_req_failed': ['rate<0.001'],
    'app_errors': ['rate<0.005'],
  },
};

export default function () {
  // Use a real, well-known testnet wallet so we get 200s, not 404s
  const res = http.get(`${BASE_URL}/score?wallet=${VALID_WALLET}`);
  trustScoreDuration.add(res.timings.duration);
  recordResponse(res);

  check(res, { 'status 200': (r) => r.status === 200 });
}
