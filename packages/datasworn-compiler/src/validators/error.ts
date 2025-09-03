export class ValidationError {
  public readonly instancePath: string;

  constructor(
    public readonly message: string,
    path: string[],
  ) {
    this.instancePath = "/" + path.map(encodeURIComponent).join("/");
  }
}
