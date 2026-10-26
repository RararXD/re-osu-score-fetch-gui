import type { ErrorCode, ErrorResponse } from "../../shared/contracts";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
  }
}

export function errorResponse(error: ApiError): Response {
  const body: ErrorResponse = {
    error: {
      code: error.code,
      message: error.message,
    },
  };
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  if (error.retryAfter !== undefined) {
    headers.set("Retry-After", String(error.retryAfter));
  }
  return new Response(JSON.stringify(body), { status: error.status, headers });
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
