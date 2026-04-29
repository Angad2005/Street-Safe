interface ApplicationErrorOptions {
  httpStatus: number;
  code: string;
  message: string;
  context: Record<string, any> | null;
}

export class ApplicationError extends Error {
  private readonly code: string;
  private readonly context: Record<string, any> | null;
  readonly httpStatus: number;

  constructor(options: ApplicationErrorOptions, cause: Error | undefined = undefined) {
    super(options.message, { cause });

    this.message = options.message;
    this.code = options.code;
    this.context = options.context;
    this.httpStatus = options.httpStatus;
  }

  toResponse() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: (this.context ?? undefined)
      }
    }
  }
}

export class UnknownError extends ApplicationError {
  constructor(cause: Error) {
    super({
      code: "internal_server_error",
      message: "Internal Server Error",
      httpStatus: 500,
      context: null
    }, cause);
  }
}
