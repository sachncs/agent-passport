// Scenario C: 1000 concurrent users — stress test
// Verifies the service's breaking point and graceful degradation.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, pickWallet, VALID_WALLET } from '../lib/config.js';
import {
  errorRate,
  requestDuration,
  passportDuration,
  scoreDuration,
  recordResponse,
} from '../lib/metrics.js';

export const options = {
  vus: 1000,
  duration: '60s',
  thresholds: {
    'http_req_duration{expected_response:true}': ['p(95)<1500', 'p(99)<3000'],
    'http_req_failed': ['rate<0.01'],
    'app_errors': ['rate<0.05'],
  },
};

export default function () {
  const wallet = pickWallet(__VU);

  const r1 = http.get(`${BASE_URL}/score?wallet=${wallet}`);
  scoreDuration.add(r1.timings.duration);
  recordResponse(r1);

  const r2 = http.get(`${BASE_URL}/passport?wallet=${wallet}`);
  passportDuration.add(r2.timings.duration);
  recordResponse(r2);

  check(r1, { 'score ok or 404': (r) => r.status === 200 || r.status === 404 });
  check(r2, { 'passport ok or 404': (r) => r.status === 200 || r.status === 404 });

  sleep(0.05);
}
