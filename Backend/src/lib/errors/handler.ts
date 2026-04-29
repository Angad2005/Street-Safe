import { NextFunction, Request, Response } from "express";
import { ApplicationError, UnknownError } from "./base";

export const handleError = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (res.headersSent) {
    return next(err);
  }

  if (!(err instanceof ApplicationError)) {
    return handleError(
      new UnknownError(err),
      req,
      res,
      next
    );
  }
  
  console.error("An exception occured while handling the request");
  console.error(err);

  res.status(err.httpStatus);
  res.json(err.toResponse());
  return;
}