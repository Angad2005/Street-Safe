import { expect, suite, test } from "vitest";
import { signedBlob } from "./signed";
import { sign } from "../crypto/hmac";

suite("Signature Validation via Zod", () => {
  test("Parsing a valid signature results in a successful parse", () => {
    const data = sign(Buffer.from("abc", "utf-8"));
    const result = signedBlob.safeParse(data);

    expect(result.success).toBe(true);
    expect(result.data).toBeInstanceOf(Buffer);
    expect(result.error).toBeUndefined();
  })

  test("Parsing a missing signature results in a failed parse", () => {
    const data = "abcd";
    const result = signedBlob.safeParse(data);

    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).not.toBeUndefined();
  });

  test("Parsing an invalid signature results in a failed parse", () => {
    const data = sign(Buffer.from("abc", "utf-8")) + "abcd";
    const result = signedBlob.safeParse(data);

    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).not.toBeUndefined();
  });
})