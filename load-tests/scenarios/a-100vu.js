// Scenario A: 100 concurrent users — sustained load
// Verifies the service can handle baseline production traffic.

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { BASE_URL, pickWallet, VALID_WALLET } from '../lib/config.js';
import {
  errorRate,
  requestDuration,
  passportDuration,
  underwritingDuration,
  counterpartyDuration,
  recordResponse,
} from '../lib/metrics.js';

export const options = {
  vus: 100,
  duration: '60s',
  thresholds: {
    'http_req_duration{expected_response:true}': ['p(95)<500', 'p(99)<1500'],
    'http_req_failed': ['rate<0.001'],
    'app_errors': ['rate<0.01'],
    'app_request_duration': ['p(95)<500', 'p(99)<1500'],
  },
};

export default function () {
  group('Scenario A — 100 concurrent users', () => {
    let res = http.get(`${BASE_URL}/health`);
    recordResponse(res);
    check(res, { 'health is 200': (r) => r.status === 200 });

    sleep(0.3);

    res = http.get(`${BASE_URL}/passport?wallet=${VALID_WALLET}`);
    passportDuration.add(res.timings.duration);
    recordResponse(res);
    check(res, {
      'passport returns 200 or 404': (r) => r.status === 200 || r.status === 404,
    });

    sleep(0.3);

    res = http.get(`${BASE_URL}/underwrite?wallet=${VALID_WALLET}`);
    underwritingDuration.add(res.timings.duration);
    recordResponse(res);
    check(res, {
      'underwrite returns 200 or 404': (r) => r.status === 200 || r.status === 404,
    });

    sleep(0.3);

    res = http.post(`${BASE_URL}/counterparty-check`, JSON.stringify({ buyer: VALID_WALLET }), {
      headers: { 'Content-Type': 'application/json' },
    });
    counterpartyDuration.add(res.timings.duration);
    recordResponse(res);
    check(res, {
      'counterparty-check returns 200 or 404': (r) => r.status === 200 || r.status === 404,
    });

    sleep(0.3);

    res = http.post(`${BASE_URL}/credit-estimate`, JSON.stringify({ wallet: VALID_WALLET, amount: 100 }), {
      headers: { 'Content-Type': 'application/json' },
    });
    recordResponse(res);
    check(res, {
      'credit-estimate returns 200 or 404': (r) => r.status === 200 || r.status === 404,
    });

    sleep(0.3);
  });
}
