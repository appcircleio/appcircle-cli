
export class AppcircleExitError extends Error {
  public code: number;
  constructor(message: string, code: number = 1) {
    super(message);
    this.name = 'AppcircleExitError';
    this.code = code;
  }
}
