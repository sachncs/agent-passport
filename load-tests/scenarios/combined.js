// Combined scenario: runs A, B, C, D in sequence.
// This is the recommended entry point for full load testing.

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.3/index.js';
import { BASE_URL, pickWallet, VALID_WALLET } from '../lib/config.js';
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
  scenarios: {
    a_100vu: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '60s', target: 100 },
        { duration: '10s', target: 0 },
      ],
      exec: 'scenarioA',
    },
    b_500vu: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 500 },
        { duration: '60s', target: 500 },
        { duration: '10s', target: 0 },
      ],
      exec: 'scenarioB',
      startTime: '2m',
    },
    c_1000vu: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 1000 },
        { duration: '60s', target: 1000 },
        { duration: '15s', target: 0 },
      ],
      exec: 'scenarioC',
      startTime: '5m',
    },
    d_sustained: {
      executor: 'constant-arrival-rate',
      rate: 12,
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 50,
      maxVUs: 200,
      exec: 'scenarioD',
      startTime: '8m',
    },
  },
  thresholds: {
    'http_req_duration{expected_response:true}': ['p(95)<1000', 'p(99)<2500'],
    'http_req_failed': ['rate<0.01'],
    'app_errors': ['rate<0.05'],
  },
};

export function scenarioA() {
  group('A: 100 concurrent', () => {
    const res = http.get(`${BASE_URL}/passport?wallet=${VALID_WALLET}`);
    passportDuration.add(res.timings.duration);
    recordResponse(res);
    check(res, { 'passport ok': (r) => r.status === 200 || r.status === 404 });
    sleep(0.5);
  });
}

export function scenarioB() {
  group('B: 500 concurrent mixed', () => {
    const choice = Math.random();
    let res;
    if (choice < 0.3) {
      res = http.get(`${BASE_URL}/passport?wallet=${VALID_WALLET}`);
      passportDuration.add(res.timings.duration);
    } else if (choice < 0.6) {
      res = http.get(`${BASE_URL}/score?wallet=${VALID_WALLET}`);
      scoreDuration.add(res.timings.duration);
    } else if (choice < 0.85) {
      res = http.get(`${BASE_URL}/underwrite?wallet=${VALID_WALLET}`);
    } else {
      res = http.post(`${BASE_URL}/counterparty-check`, JSON.stringify({ buyer: VALID_WALLET }), {
        headers: { 'Content-Type': 'application/json' },
      });
      counterpartyDuration.add(res.timings.duration);
    }
    recordResponse(res);
    check(res, { 'ok or 404': (r) => r.status === 200 || r.status === 404 });
    sleep(0.2);
  });
}

export function scenarioC() {
  group('C: 1000 concurrent burst', () => {
    const wallet = pickWallet(__VU);
    const res = http.get(`${BASE_URL}/passport?wallet=${wallet}`);
    passportDuration.add(res.timings.duration);
    recordResponse(res);
    sleep(0.05);
  });
}

export function scenarioD() {
  group('D: 10k/day sustained', () => {
    const wallet = pickWallet(__VU * 7 + __ITER);
    const res = http.get(`${BASE_URL}/score?wallet=${wallet}`);
    scoreDuration.add(res.timings.duration);
    recordResponse(res);
  });
}

export function handleSummary(data) {
  const summary = textSummary(data, { indent: ' ', enableColors: true });
  return {
    'stdout': summary,
    'load-tests/results/combined-summary.txt': summary,
  };
}
