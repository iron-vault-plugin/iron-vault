/** Raised when an oracle is not found. */
export class NoSuchOracleError extends Error {
  constructor(
    public readonly oracleId: string,
    message?: string,
    options?: ErrorOptions,
  ) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super(`Oracle '${oracleId} not found: ${message}`, options);

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NoSuchOracleError);
    }

    this.name = "NoSuchOracleError";
    this.oracleId = oracleId;
  }
}
