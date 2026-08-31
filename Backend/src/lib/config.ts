import { config } from "dotenv";
import z from "zod";
import { allOrNone } from "./validation/all-or-none";

config({ quiet: true });

const schema = z.object({
  DB_FILE: z.string().nonempty().default("main.db"),
  PORT: z.coerce.number().default(8080),
  OAUTH_BASE_URL: z.string().nonempty().default(process.env.RENDER_EXTERNAL_URL || "http://localhost:8080"),
  OAUTH_GOOGLE_CLIENT_ID: z.string().nonempty(),
  OAUTH_GOOGLE_CLIENT_SECRET: z.string().nonempty(),
  HMAC_SIGNATURE_SECRET: z.string().nonempty(),
  APPLE_PUSH_NOTIFICATION_BUNDLE_IDENTIFIER: z.string().optional(),
  APPLE_PUSH_NOTIFICATION_AUTHORIZATION_TOKEN: z.string().optional(),
  FCM_SERVER_KEY: z.string().optional(),
  FCM_PROJECT_NAME: z.string().optional(),
  GEOCODE_API: z.string().nonempty().default("https://nominatim.828101.xyz"),
})
  .superRefine(
    (arg, ctx) => allOrNone<typeof arg>([
      "APPLE_PUSH_NOTIFICATION_BUNDLE_IDENTIFIER",
      "APPLE_PUSH_NOTIFICATION_AUTHORIZATION_TOKEN"
    ])(arg, ctx)
  )
  .superRefine(
    (arg, ctx) => allOrNone<typeof arg>([
      "FCM_SERVER_KEY",
      "FCM_PROJECT_NAME"
    ])(arg, ctx)
  );

const result = schema.safeParse(process.env);

if (!result.success) {
  throw new Error(`Error parsing env:\n${
    z.prettifyError(result.error)
  }`);
}

export const {
  DB_FILE,
  HMAC_SIGNATURE_SECRET,
  OAUTH_BASE_URL,
  OAUTH_GOOGLE_CLIENT_ID,
  OAUTH_GOOGLE_CLIENT_SECRET,
  PORT,
  APPLE_PUSH_NOTIFICATION_AUTHORIZATION_TOKEN,
  APPLE_PUSH_NOTIFICATION_BUNDLE_IDENTIFIER,
  FCM_PROJECT_NAME,
  FCM_SERVER_KEY,
  GEOCODE_API
} = result.data;