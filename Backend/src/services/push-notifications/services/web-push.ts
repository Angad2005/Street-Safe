import z from "zod";
import * as webpush from "web-push";

import type { Notification } from "../types";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const readMustExist = (relativePath: string) => {
  const cwd = process.cwd();
  const fullPath = path.join(cwd, relativePath);

  if (!existsSync(fullPath)) {
    throw new Error(`File "${relativePath}" (relative to cwd) must exist for the server to run.`);
  }

  return readFileSync(fullPath).toString();
}

const PUBLIC_KEY = readMustExist(
  path.join("priv", "vapid", "ed25519.pub"),
);

const PRIVATE_KEY = readMustExist(
  path.join("priv", "vapid", "ed25519")
);

export const webPushSchema = z.object({
  endpoint: z.string().nonempty(),
  expiresAt: z.number().nullable(),
  keys: z.object({
    p256dh: z.string().nonempty(),
    auth: z.string().nonempty()
  })
});

export type WebPushParams = z.infer<typeof webPushSchema>;
export type Payload = {
  version: 1;
  payload: {
    title: string;
    body: string;
  }
};  

export const toWebPushNotification = (
  common: Notification
): Payload => ({
  version: 1,
  payload: {
    title: common.title,
    body: common.body
  }
});

export const send = async (
  webPushParams: WebPushParams,
  payload: Payload
) => {
  await webpush.sendNotification({
    endpoint: webPushParams.endpoint,
    keys: webPushParams.keys,
    expirationTime: webPushParams.expiresAt
  }, JSON.stringify(payload), {
    vapidDetails: {
      subject: "mailto:tpg439@student.bham.ac.uk",
      publicKey: PUBLIC_KEY,
      privateKey: PRIVATE_KEY,
    }
  });
}