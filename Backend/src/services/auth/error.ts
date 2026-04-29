import { ApplicationError } from "~/lib/errors";

export class InvalidAuthenticationTokenError extends ApplicationError {
  constructor(cause: Error | undefined = undefined) {
    super({
      code: "unauthorized",
      message: "Unauthorized",
      context: null,
      httpStatus: 401
    }, cause);
  }
}

export class AuthenticationRequiredError extends ApplicationError {
  constructor() {
    super({
      code: "unauthorized",
      message: "Unauthorized",
      context: null,
      httpStatus: 401
    })
  }
}