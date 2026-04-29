import { expect, suite, test } from "vitest";
import { allOrNone } from "./all-or-none";
import z, { ZodError } from "zod";

suite("allOrNone", () => {
  const baseSchema = z.object({
    a: z.number().optional(),
    b: z.number().optional()
  });
  
  const schema = baseSchema.superRefine(
    (arg, ctx) => allOrNone<typeof arg>(["a", "b"])(arg, ctx)
  );

  test("should be successful when all keys are specified", () => {
    expect(
      () => schema.parse({
        a: 1,
        b: 1
      }),
      "Parsing a valid schema should not throw"
    ).not.toThrow();
  });

  test("should be successful when no keys are specified", () => {
    expect(
      () => schema.parse({}),
      "Parsing a valid schema should not throw"
    ).not.toThrow()
  });

  test("should fail when a key is missing", () => {
    expect(
      () => schema.parse({ a: 1 }),
      "Parsing an invalid schema should throw"
    ).toThrow(ZodError);
  });
})