import { ApiError } from "./api-errors";

const SESSION_ENDING_STATUS = 401;

export const SESSION_ENDING_CODES = [
  "AUTHENTICATION_REQUIRED",
  "SESSION_INVALID",
  "SESSION_REVOKED",
] as const;

const sessionEndingCodes: ReadonlySet<string> = new Set(SESSION_ENDING_CODES);

function endsSession(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === SESSION_ENDING_STATUS &&
    error.code !== undefined &&
    sessionEndingCodes.has(error.code)
  );
}

export class SessionPolicy {
  private endSessionHandler: (() => void) | null = null;

  whenSessionEnded(handler: (() => void) | null): void {
    this.endSessionHandler = handler;
  }

  reviewFailure(error: unknown): void {
    if (endsSession(error)) this.endSessionHandler?.();
  }
}
