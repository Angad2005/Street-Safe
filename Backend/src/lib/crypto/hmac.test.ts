import { expect, test, suite } from "vitest";

import { InvalidFormatError, SignatureMismatchError, sign, verify } from "./hmac";


suite("HMAC signing of Buffers", () => {
  test("HMAC signing produces a signed base64 value", () => {
    const buffer = Buffer.from("abc", "utf-8");
    const signed = sign(buffer);
    const verified = verify(signed);

    expect(
      verified.equals(buffer),
      "Signing and then verifying a Buffer should result in the same contents back"
    ).toEqual(true);
  });

  test("Data without a signature is rejected", () => {
    expect(
      () => verify("data-without-a-signature"),
      "Verifying data without a signature should throw an InvalidFormatError"
    ).toThrow(InvalidFormatError);
  })

  test("Signed data with a differing signature from the original is rejected", () => {
    const buffer = Buffer.from("abc", "utf-8");
    const signed = sign(buffer);
    
    const modified = signed + "abcd";

    expect(
      () => verify(modified),
      "Verifying a modified signature should result in a SignatureMismatchError"
    ).toThrow(SignatureMismatchError);
  });
});