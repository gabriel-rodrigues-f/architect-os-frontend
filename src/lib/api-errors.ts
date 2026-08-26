export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
    readonly code?: string,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
