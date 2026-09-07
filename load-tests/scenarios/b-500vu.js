// Scenario B: 500 concurrent users — production-peak load
// Verifies the service holds up at typical production peaks.

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { BASE_URL, VALID_WALLET } from '../lib/config.js';
import {
  errorRate,
  requestDuration,
  passportDuration,
  scoreDuration,
  counterpartyDuration,
  graphTraversalLatency,
  recordResponse,
} from '../lib/metrics.js';

export const options = {
  vus: 500,
  duration: '60s',
  thresholds: {
    'http_req_duration{expected_response:true}': ['p(95)<750', 'p(99)<2000'],
    'http_req_failed': ['rate<0.005'],
    'app_errors': ['rate<0.02'],
    'app_request_duration': ['p(95)<750', 'p(99)<2000'],
  },
};

const ENDPOINTS = [
  { method: 'GET', path: () => `/score?wallet=${VALID_WALLET}`, type: 'trustScore' },
  { method: 'GET', path: () => `/delegation?wallet=${VALID_WALLET}`, type: 'trustScore' },
  { method: 'GET', path: () => `/passport?wallet=${VALID_WALLET}`, type: 'passport' },
  { method: 'GET', path: () => `/underwrite?wallet=${VALID_WALLET}`, type: 'underwriting' },
  { method: 'GET', path: () => `/trust-graph?wallet=${VALID_WALLET}`, type: 'graph' },
  { method: 'GET', path: () => `/reputation?wallet=${VALID_WALLET}`, type: 'trustScore' },
  { method: 'POST', path: () => `/counterparty-check`, body: () => JSON.stringify({ buyer: VALID_WALLET }), type: 'counterparty' },
  { method: 'POST', path: () => `/credit-estimate`, body: () => JSON.stringify({ wallet: VALID_WALLET, amount: 100 }), type: 'trustScore' },
];

export default function () {
  group('Scenario B — 500 concurrent users (mixed read)', () => {
    const choice = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
    let res;
    if (choice.method === 'GET') {
      res = http.get(`${BASE_URL}${choice.path()}`);
    } else {
      res = http.post(`${BASE_URL}${choice.path()}`, choice.body(), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    switch (choice.type) {
      case 'passport': passportDuration.add(res.timings.duration); break;
      case 'trustScore': scoreDuration.add(res.timings.duration); break;
      case 'counterparty': counterpartyDuration.add(res.timings.duration); break;
      case 'graph': graphTraversalLatency.add(res.timings.duration); break;
    }

    recordResponse(res);
    check(res, {
      'expected status (2xx or 404)': (r) => r.status === 200 || r.status === 404,
    });

    sleep(0.1 + Math.random() * 0.2);
  });
}
