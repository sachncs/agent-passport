import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
}

export function createAppError(message: string, statusCode: number): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
}

export function errorHandler(
  err: AppError | Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as any).requestId || req.headers['x-request-id'];

  if ('statusCode' in err) {
    logger.warn('Request error', {
      statusCode: err.statusCode,
      message: err.message,
      path: req.path,
      method: req.method,
      requestId,
    });
    res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode,
    });
    return;
  }

  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId,
  });

  res.status(500).json({
    error: 'Internal server error',
    statusCode: 500,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
  });
}
