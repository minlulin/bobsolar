/**
 * Error handling utilities for server actions
 */

import { z } from "zod";
import { type ActionFailure, errorResponse } from "@/lib/utils/action-response";

export interface ActionError {
  message: string;
  code?: string;
  details?: unknown;
}

export type ErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "DB_ERROR"
  | "FORBIDDEN"
  | "INVALID_STATE"
  | "UNKNOWN";

const MAX_ERROR_CHAIN_LENGTH = 500;

function isNextRedirectError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const digest =
    "digest" in error && typeof (error as { digest?: unknown }).digest === "string"
      ? (error as { digest: string }).digest
      : null;

  return digest?.startsWith("NEXT_REDIRECT") ?? false;
}

export function getErrorCode(error: unknown): ErrorCode {
  if (error instanceof z.ZodError) return "VALIDATION_ERROR";
  if (error instanceof Error) {
    if (error.message.includes("Unauthorized")) return "UNAUTHORIZED";
    if (error.message.includes("not found")) return "NOT_FOUND";
    if (error.message.includes("permission") || error.message.includes("forbidden"))
      return "FORBIDDEN";
    if (error.message.includes("transaction") || error.message.includes("database"))
      return "DB_ERROR";
  }
  return "UNKNOWN";
}

/** Walk `Error.cause` (Drizzle/Neon often nest the Postgres message). */
function formatErrorChain(error: unknown, fallback: string): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message || "Validation failed";
  }
  const parts: string[] = [];
  let current: unknown = error;
  let depth = 0;
  while (current && depth < 6) {
    if (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
      depth += 1;
    } else if (
      current &&
      typeof current === "object" &&
      "message" in current &&
      typeof (current as { message: unknown }).message === "string"
    ) {
      // Handle plain objects with message property (common in some error responses)
      parts.push(String((current as { message: string }).message));
      current = (current as { cause?: unknown }).cause;
      depth += 1;
    } else {
      break;
    }
  }
  if (parts.length > 0) {
    const chain = [...new Set(parts)].join(" -> ");
    if (chain.length > MAX_ERROR_CHAIN_LENGTH) {
      return `${chain.slice(0, MAX_ERROR_CHAIN_LENGTH)}...`;
    }
    return chain;
  }
  return fallback;
}

export function formatErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message || "Validation failed";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function logError(context: string, error: unknown, extra?: Record<string, unknown>): void {
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

  // DB/driver errors can contain BigInt and circular structures.
  // Guard logging so error reporting never throws while handling an action error.
  const seen = new WeakSet<object>();
  const serialized = JSON.stringify(
    errorInfo,
    (_key, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return "[Circular]";
        seen.add(value);
      }
      return value;
    },
    2,
  );

  console.error(serialized);
}

export function handleActionError(
  error: unknown,
  context: string,
  fallbackMessage: string,
): ActionFailure {
  // Don't re-throw NEXT_REDIRECT when called from server actions invoked by client hooks
  // redirect() should only be used in Server Components, not in action functions
  if (isNextRedirectError(error)) {
    return errorResponse("Redirect requested - this should only happen in Server Components");
  }

  const code = getErrorCode(error);
  const message =
    process.env.NODE_ENV === "development"
      ? formatErrorChain(error, fallbackMessage)
      : formatErrorMessage(error, fallbackMessage);

  logError(context, error, { code, userMessage: message });

  return errorResponse(message);
}

export function handleNotFoundError(resource: string, id: string): ActionFailure {
  return errorResponse(`${resource} with ID "${id}" not found`);
}

export function handleStateError(message: string): ActionFailure {
  return errorResponse(message);
}
