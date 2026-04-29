import { suite, test, expect } from "vitest";
import { encodeWithoutPadding, decode } from "./base64";

suite("base64", () => {
  const ENCODED = "Zm9vYmFyYmF6";
  const DECODED = Buffer.from("foobarbaz", "utf-8");

  test("base64 decoding should result in the expected buffer", () => {
    expect(decode(ENCODED)).toEqual(DECODED);
  });

  test("base64 encoding should result in the expected string", () => {
    expect(encodeWithoutPadding(DECODED)).toEqual(ENCODED);
  })
})