import zod from 'zod';

import type { Request, Response, NextFunction } from 'express';
import { ValidationFailedError } from './error';

/**
 * The key that stores validated data.
 * @private
 */
const kValidated = Symbol("kValidated");

/**
 * Represents an express request with validated data
 * attached to it.
 */
export interface ValidatedRequest extends Request {
  [kValidated]: Map<zod.ZodSchema, unknown>
}

const didValidationMiddlewareRun = (req: Request) => kValidated in req;

/**
 * 
 * @param req The request to get validated data from
 * @param schema The schema that the value was validated against
 * @returns The data, as the inferred schema from validation.
 */
export const getValidated = <T extends zod.ZodSchema>(req: Request, schema: T): zod.infer<T> => {
  if (!didValidationMiddlewareRun(req)) {
    throw new Error("Validation middleware must have been ran to be able to get a validated value");
  }

  // If the schema exists in this map, then it has passed validation successfully.
  const data = (req as ValidatedRequest)[kValidated].get(schema);

  // Return casted to the type that the schema represents once parsed.
  return data as unknown as zod.infer<T>;
}

type MaybeValidated<T extends string> = { [K in T]: unknown };

/**
 * Middleware to validate data coming from a request.
 * 
 * @example ```ts
 * const bodySchema = zod.object({ text: zod.string() });
 * app.use("/schema", validate({ body: bodySchema}), (req, res) => {
 *    // `text` is inferred from `bodySchema` as `string`. 
 *    const { text } = getValidated(req, bodySchema);
 *  
 *    res.end(text);
 * })
 * ```
 * 
 * @param schemas The schemas to use to validate against
 * @returns A Middleware function that can be used as part of a request chain.
 */
export const validate = <TBody extends zod.ZodSchema, TRouterParams extends zod.ZodSchema, TQueryParams extends zod.ZodSchema>({ body, params, query }: {
  body?: TBody,
  params?: TRouterParams,
  query?: TQueryParams
}) => {
  // Include each schema if it is present.
  const schema = zod.object({
    ...(body && { body }),
    ...(params && { params }),
    ...(query && { query }),
  });

  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query
    });

    if (!result.success) {
      throw new ValidationFailedError(result.error);
    }

    // We have to use a `Map<K, V>` here instead of a `Record<K, V>`
    // since for a `Record<K, V>`, `K` must be a string, a number or
    // a symbol. By using a Map, we can have an interface like `getValidated(req, schema)`
    // that returns a `T` inferred from schema.
    (req as ValidatedRequest)[kValidated] = new Map<zod.ZodSchema, unknown>([
      [body ?? zod.object(), (result.data as unknown as MaybeValidated<"body">).body],
      [params ?? zod.object(), (result.data as unknown as MaybeValidated<"params">).params],
      [query ?? zod.object(), (result.data as unknown as MaybeValidated<"query">).query]
    ]);

    return next();
  }
}