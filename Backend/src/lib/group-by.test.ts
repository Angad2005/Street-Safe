import { expect, suite, test } from "vitest";
import { groupBy } from "./group-by";

suite("groupBy", () => {
  const sample = [
    { kind: "a", value: true },
    { kind: "a", value: false },
    { kind: "b", anotherKey: 1 },
    { kind: "c", anotherAnotherKey: "something" },
    { kind: "c" }
  ];

  const partial = sample.slice(0, 3);

  test("should correctly group an object with all-present keys", () => {
    expect(
      groupBy(sample, (it) => it.kind)
    ).toEqual({
      a: [sample[0], sample[1]],
      b: [sample[2]],
      c: [sample[3], sample[4]]
    });
  });

  test("should not include keys if they are not present in the output", () => {
    const result = groupBy(partial, (it) => it.kind);

    expect(
      "a" in result,
      "Key `a` should be in the result since it is in the partial sample data"
    ).toBe(true);

    expect(
      "b" in result,
      "Key `b` should be in the result since it is in the partial sample data"
    ).toBe(true);

    expect(
      "c" in result,
      "Key `c` should not be in the result since it is not in the partial sample data, even though it is in the type domain of sample"
    ).toBe(false);
  })
})