import { createHmac } from "crypto";
import * as base64 from "../base64";

import { HMAC_SIGNATURE_SECRET } from "../config";

const generateSignatureFromBuffer = (data: Buffer, key: string) => createHmac("sha256", key)
  .update(data)
  .digest();

export class SignatureError extends Error {};
export class SignatureMismatchError extends SignatureError {};
export class InvalidFormatError extends SignatureError {};

export const sign = (
  data: Buffer
) => {
  const signatureBytes = generateSignatureFromBuffer(data, HMAC_SIGNATURE_SECRET);

  const payload = base64.encodeWithoutPadding(data);
  const signature = base64.encodeWithoutPadding(signatureBytes);

  return `${payload}.${signature}`;
}

export const verify = (
  signed: string
) => {
  const parts = signed.split(".");

  if (parts.length !== 2) {
    throw new InvalidFormatError();
  }

  const [data, signature] = parts;
  const payload = base64.decode(data);

  const clientProvidedSignatureBytes = base64.decode(signature);
  const serverVerifiedSignatureBytes = generateSignatureFromBuffer(payload, HMAC_SIGNATURE_SECRET);

  if (!serverVerifiedSignatureBytes.equals(clientProvidedSignatureBytes)) {
    throw new SignatureMismatchError();
  }

  return payload;
}