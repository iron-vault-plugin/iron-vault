export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly path: string[],
    opts?: ErrorOptions,
  ) {
    super(message, opts);
  }
}
