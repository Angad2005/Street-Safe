import { z, type ZodError } from "zod";
import { ApplicationError } from "../errors";

export class ValidationFailedError extends ApplicationError {
  constructor(issue: ZodError) {
    super({
      code: "validation_failed",
      message: "Validation Failed",
      context: { errors: z.flattenError(issue) },
      httpStatus: 400
    });
  }
}