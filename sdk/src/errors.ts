/**
 * Error hierarchy for the Agent Passport SDK.
 *
 * All errors thrown by the SDK are subclasses of `AgentPassportError`.
 * Use `instanceof` checks to handle specific failure modes.
 */

export class AgentPassportError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly requestId?: string;

  constructor(message: string, statusCode: number, details?: unknown, requestId?: string) {
    super(message);
    this.name = 'AgentPassportError';
    this.statusCode = statusCode;
    this.details = details;
    this.requestId = requestId;
  }
}

export class AuthenticationError extends AgentPassportError {
  constructor(message = 'Authentication failed', details?: unknown, requestId?: string) {
    super(message, 401, details, requestId);
    this.name = 'AuthenticationError';
  }
}

export class PaymentRequiredError extends AgentPassportError {
  public readonly requirements: PaymentRequirements;

  constructor(requirements: PaymentRequirements, requestId?: string) {
    super('Payment required (x402)', 402, requirements, requestId);
    this.name = 'PaymentRequiredError';
    this.requirements = requirements;
  }
}

export class NotFoundError extends AgentPassportError {
  constructor(message = 'Resource not found', details?: unknown, requestId?: string) {
    super(message, 404, details, requestId);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AgentPassportError {
  public readonly retryAfter?: number;

  constructor(message = 'Rate limit exceeded', retryAfter?: number, requestId?: string) {
    super(message, 429, { retryAfter }, requestId);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class IdempotencyError extends AgentPassportError {
  constructor(message = 'Idempotency conflict: same key with different body', details?: unknown, requestId?: string) {
    super(message, 409, details, requestId);
    this.name = 'IdempotencyError';
  }
}

export class ValidationError extends AgentPassportError {
  constructor(message = 'Validation failed', details?: unknown, requestId?: string) {
    super(message, 400, details, requestId);
    this.name = 'ValidationError';
  }
}

export class ServerError extends AgentPassportError {
  constructor(message = 'Server error', details?: unknown, requestId?: string) {
    super(message, 500, details, requestId);
    this.name = 'ServerError';
  }
}

export class TimeoutError extends AgentPassportError {
  constructor(message = 'Request timed out', requestId?: string) {
    super(message, 408, undefined, requestId);
    this.name = 'TimeoutError';
  }
}

export class ConnectionError extends AgentPassportError {
  constructor(message = 'Connection error', requestId?: string) {
    super(message, 503, undefined, requestId);
    this.name = 'ConnectionError';
  }
}

export interface PaymentRequirements {
  amount: string;
  network: string;
  payTo: string;
}

export interface PaymentProof {
  paymentHeader: string;
}
