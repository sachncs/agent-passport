import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { config } from '../../config';
import { requestDeadlineMiddleware } from '../request-deadline';

describe('requestDeadlineMiddleware', () => {
  it('uses the central request timeout configuration', () => {
    const setTimeout = vi.fn();
    const on = vi.fn();
    const req = { setTimeout } as unknown as Request;
    const res = { locals: {}, on } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    requestDeadlineMiddleware(req, res, next);

    expect(res.locals.deadlineAt).toBeGreaterThan(Date.now());
    expect(setTimeout).toHaveBeenCalledWith(config.requestTimeoutMs + 5_000);
    expect(on).toHaveBeenCalledWith('finish', expect.any(Function));
    expect(next).toHaveBeenCalledOnce();
  });
});
