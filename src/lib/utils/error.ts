/**
 * Error handling utilities for server actions
 */

import { z } from 'zod';
import { errorResponse, type ActionFailure } from '@/lib/utils/action-response';

export interface ActionError {
  message: string;
  code?: string;
  details?: unknown;
}

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'DB_ERROR'
  | 'FORBIDDEN'
  | 'INVALID_STATE'
  | 'UNKNOWN';

export function getErrorCode(error: unknown): ErrorCode {
  if (error instanceof z.ZodError) return 'VALIDATION_ERROR';
  if (error instanceof Error) {
    if (error.message.includes('Unauthorized')) return 'UNAUTHORIZED';
    if (error.message.includes('not found')) return 'NOT_FOUND';
    if (
      error.message.includes('permission') ||
      error.message.includes('forbidden')
    )
      return 'FORBIDDEN';
    if (
      error.message.includes('transaction') ||
      error.message.includes('database')
    )
      return 'DB_ERROR';
  }
  return 'UNKNOWN';
}

export function formatErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message || 'Validation failed';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function logError(
  context: string,
  error: unknown,
  extra?: Record<string, unknown>,
) {
  const timestamp = new Date().toISOString();
  const errorInfo = {
    timestamp,
    context,
    error:
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : String(error),
    ...extra,
  };
  console.error(JSON.stringify(errorInfo, null, 2));
}

export function handleActionError(
  error: unknown,
  context: string,
  fallbackMessage: string,
): ActionFailure {
  const code = getErrorCode(error);
  const message = formatErrorMessage(error, fallbackMessage);

  logError(context, error, { code, userMessage: message });

  return errorResponse(message);
}

export function handleNotFoundError(
  resource: string,
  id: string,
): ActionFailure {
  return errorResponse(`${resource} with ID "${id}" not found`);
}

export function handleStateError(message: string): ActionFailure {
  return errorResponse(message);
}
