import db from "~/lib/db";

import * as base64 from "~/lib/base64"

export enum DeviceKind {
  Ios = 0,
  Android = 1,
  Web = 2,
  MacOS = 3,
  Windows = 4
};

const channelToDeviceKindMap: Record<string, DeviceKind> = {
  "ios": DeviceKind.Ios,
  "android": DeviceKind.Android,
  "web": DeviceKind.Web,
  "macos": DeviceKind.MacOS,
  "windows": DeviceKind.Windows
};

export const init = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_notification_destinations (
      id INTEGER PRIMARY KEY NOT NULL,
      kind INTEGER NOT NULL,
      user_id INTEGER,
      token VARCHAR(4096),
      device_id BLOB(32) NOT NULL
    );
  `)
};

interface WebPushData {
  endpoint: string;
  expiresAt: number | null;
  keys: {
    p256dh: string;
    auth: string;
  }
}

export interface Device {
  id: number;
  kind: number;
  userId: number | null;
  token: string | null;
  deviceId: Buffer
}

export type CreateDeviceMobile = {
  kind: DeviceKind.Android | DeviceKind.Ios;
  userId: number | null;
  token: string | null;
  deviceId: Buffer;
};

export type CreateDeviceWeb = {
  kind: DeviceKind.Web;
  userId: number | null;
  webPush: WebPushData | null;
  deviceId: Buffer;
}

export type CreateDeviceParams = CreateDeviceMobile | CreateDeviceWeb;

export const toDeviceKind = (channel: keyof typeof channelToDeviceKindMap): DeviceKind =>
  channelToDeviceKindMap[channel];

export const createDevice = (device: CreateDeviceParams) => {
  let token = device.kind === DeviceKind.Web
    ? (device.webPush ? 
      base64.encodeWithoutPadding(
        Buffer.from(JSON.stringify(device.webPush))
      ) : null)
    : device.token;

  return (db
    .prepare("INSERT INTO user_notification_destinations (kind, user_id, token, device_id) VALUES (?, ?, ?, ?) RETURNING id")
    .get(device.kind, device.userId, token, device.deviceId) as { id: number }).id;
}


type UpdatePushTokenForWeb = {
  kind: DeviceKind.Web;
  webPush: WebPushData;
}

type UpdatePushTokenForMobile = {
  kind: DeviceKind.Android | DeviceKind.Ios;
  token: string;
}

export type UpdatePushTokenForDevice = UpdatePushTokenForWeb | UpdatePushTokenForMobile;

export const updatePushTokenForDevice = (
  deviceId: Buffer,
  params: UpdatePushTokenForDevice
) => {
  let pushToken = params.kind === DeviceKind.Web
    ? base64.encodeWithoutPadding(Buffer.from(JSON.stringify(params.webPush)))
    : params.token;

  db.prepare("UPDATE user_notification_destinations SET token = ? WHERE device_id = ?").run(pushToken, deviceId);
}

export const getDevice = (id: number) => {
  return (db
    .prepare("SELECT id, kind, user_id as userId, token, device_id as deviceId FROM user_notification_destinations WHERE id = ?")
    .get(id) ?? null) as Device | null;
};

export const getDeviceByIds = (ids: number[]) => {
  return db
    .prepare("SELECT id, kind, user_id as userId, token, device_id as deviceId FROM user_notification_destinatoins WHERE id in ?")
    .get(ids) as Device[];
}

export const getDevicesForUser = (userId: number) => {
  return db
    .prepare("SELECT id, kind, user_id, token, device_id as deviceId FROM user_notification_destinations WHERE user_id = ?")
    .all(userId) as Device[];
}

export const getAllDevicesForUsers = (userIds: number[]) => {
  return db
    .prepare("SELECT id, kind, user_id as userId, token, device_id as deviceId FROM user_notification_destinations WHERE user_id IN ?")
    .all(userIds) as Device[];
}