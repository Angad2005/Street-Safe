import { randomBytes } from "crypto";
import { sign } from "./hmac";

export const generateRandomBytes = (size: number) => randomBytes(size);
export const generateSignedRandomBytes = (size: number) => {
  const raw = generateRandomBytes(size);

  return {
    raw,
    signed: sign(raw)
  }
}