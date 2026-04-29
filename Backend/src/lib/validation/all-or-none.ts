import type { z, ZodObject } from "zod";

const any = (args: any[]) => {
  return args.some((it) => it !== undefined)
};

const all = (args: any[]) => {
  return args.every((it) => it !== undefined)
}

export const allOrNone = <T extends Record<string, unknown>>(
  fields: (keyof T)[]
) => {
  const formattedFields = fields.join(", ");

  return (arg: z.infer<T>, ctx: z.core.$RefinementCtx<T>) => {
    const values = fields.map((key) => arg[key]);

    if (any(values) && !all(values)) {
      for(const field of fields) {
        if (arg[field] !== undefined) {
          continue;
        }

        ctx.addIssue({
          code: "custom",
          message: `${String(field)} must be specified when any of ${formattedFields} are specified`
        });
      }
    }
  }
}