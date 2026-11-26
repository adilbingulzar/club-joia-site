/**
 * Application errors carry a stable code and a message that is safe to show to users.
 * Anything that is not an AppError is treated as unexpected: logged with a reference id,
 * and the user only sees a generic message plus that reference.
 */
export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INVALID_STATE"
  | "NOT_CONFIGURED";

const STATUS: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INVALID_STATE: 409,
  NOT_CONFIGURED: 503,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(code: AppErrorCode, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.fieldErrors = fieldErrors;
  }
}

export const forbidden = (message = "You do not have permission to do that.") =>
  new AppError("FORBIDDEN", message);
export const notFound = (what = "Item") => new AppError("NOT_FOUND", `${what} not found.`);

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

export type ActionError = {
  code: AppErrorCode | "UNEXPECTED";
  message: string;
  fieldErrors?: Record<string, string[]>;
  /** Diagnostic reference for unexpected errors — quote it to support / find it in logs. */
  reference?: string;
};

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: ActionError };

export function errorReference(): string {
  return `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/** Convert any thrown value into a user-safe ActionError (logging unexpected ones). */
export function toActionError(e: unknown): ActionError {
  if (isAppError(e)) return { code: e.code, message: e.message, fieldErrors: e.fieldErrors };
  const reference = errorReference();
  console.error(`[${reference}]`, e);
  return {
    code: "UNEXPECTED",
    message: "Something went wrong on our side. Please try again in a moment.",
    reference,
  };
}
