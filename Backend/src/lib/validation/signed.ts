import * as z from "zod";
import { SignatureError, verify } from "../crypto/hmac";

/**
 * Represents a signed blob that is validated and then 
 * parsed when used within a validator.
 * 
 * @example ```ts
 * const result = signedBlob.safeParse(someExternalData);
 * 
 * if (!result.success) {
 *  return false;
 * }
 * 
 * // result.data is a Buffer
 * process(result.data);
 * ```
 */
export const signedBlob = z.string()
  .transform((data, ctx) => {
    try {
      return verify(data);
    } catch (err) {
      if (!(err instanceof SignatureError)) {
        throw err;
      }

      ctx.addIssue({
        code: "custom",
        message: "Invalid Signature",
        input: data
      });
    }
  })