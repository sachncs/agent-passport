import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app';

describe('runtime introspection', () => {
  it('/version reports build metadata', async () => {
    const res = await request(app).get('/version');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      service: 'Agent Passport',
      sanctionsProvider: expect.any(String),
      uptime: expect.any(Number),
    });
    expect(res.body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(res.body.node).toMatch(/^v\d+/);
  });

  it('/ lists service endpoints', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      service: 'Agent Passport',
      docs: '/openapi.json',
      dashboard: '/dashboard',
    });
  });

  it('/openapi.json describes every public route', async () => {
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    const required = [
      '/score', '/delegation', '/counterparty-check', '/credit-estimate',
      '/sybil-check', '/reputation', '/reputation/record', '/reputation/subscribe',
      '/underwrite', '/trust-graph', '/passport', '/delegate', '/revoke',
      '/registry/status', '/verify', '/discovery/search',
      '/health', '/ready', '/metrics', '/version', '/openapi.json',
    ];
    for (const path of required) {
      expect(res.body.paths[path]).toBeDefined();
    }
  });
});