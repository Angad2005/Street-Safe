import * as http2 from "node:http2";
import { APPLE_PUSH_NOTIFICATION_AUTHORIZATION_TOKEN, APPLE_PUSH_NOTIFICATION_BUNDLE_IDENTIFIER } from "~/lib/config";

import type { Notification } from "../types";

const APNS_ENDPOINT = "https://api.sandbox.push.apple.com";

export enum AlertContentType {
  Title = "title",
  Subtitle = "subtitle",
  Body = "body",
};

export type AlertContent = string | Partial<Record<AlertContentType, string>>;

export type Payload = {
  alert: AlertContent;
  badge: number;
  sound?: "default";
  "thread-id"?: string;
  category?: string;
};

export const send = (
  nativeDeviceToken: string,
  payload: Payload
) => new Promise<void>((resolve, reject) => {
  if (!APPLE_PUSH_NOTIFICATION_AUTHORIZATION_TOKEN) {
    return reject(new Error("APNS credentials not configured"));
  }

  const client = http2.connect(APNS_ENDPOINT);

  const request = client.request({
    ":method": "POST",
    ":scheme": "https",
    "apns-topic": APPLE_PUSH_NOTIFICATION_BUNDLE_IDENTIFIER,
    ":path": "/3/device/" + nativeDeviceToken
  });

  request.setEncoding("utf-8");
  request.write(JSON.stringify({ aps: payload }));

  request.on('end', () => resolve());
});

export const toApnsNotification = (
  shared: Notification
): Payload => {
  return {
    alert: {
      [AlertContentType.Title]: shared.title,
      [AlertContentType.Body]: shared.body
    },
    badge: 1
  }
}