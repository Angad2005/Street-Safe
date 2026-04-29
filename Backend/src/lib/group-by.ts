export const groupBy = <
  T extends object, 
  U extends string | number | symbol
>(
  entries: T[],
  pick: (val: T) => U
): Partial<Record<U, T[]>> => {
  return entries.reduce(
    (acc, curr) => {
      const key = pick(curr);

      if (!(key in acc)) {
        acc[key] = [];
      }

      acc[key].push(curr);
      return acc;
    },
    {} as Record<U, T[]>
  );
}