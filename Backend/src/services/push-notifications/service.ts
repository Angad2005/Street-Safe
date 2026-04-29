import { groupBy } from "~/lib/group-by";
import { Device, DeviceKind, getAllDevicesForUsers, getDevice, getDevicesForUser, init as initDb } from "./db";

import { send as fcmSend, toFcmNotification } from "./services/fcm";
import { send as apnsSend, toApnsNotification } from "./services/apns";
import { send as webPushSend, toWebPushNotification } from "./services/web-push"

import type { Notification } from "./types";

import * as base64 from "~/lib/base64";

export interface SendOptions {
  ignoreNoDevices?: boolean
};

const defaultSendOptions: SendOptions = {
  ignoreNoDevices: true
}

const sendToUser = async (userId: number, notification: Notification, options: SendOptions = defaultSendOptions) => {
  const devices = getDevicesForUser(userId);

  if (options.ignoreNoDevices !== undefined && !options.ignoreNoDevices) {
    throw new Error(`User ${userId} has no devices registered`)
  }

  return await sendToDevices(devices, notification);
}

const sendToUsers = async (userIds: number[], notification: Notification) => {
  const devices = getAllDevicesForUsers(userIds);
  return await sendToDevices(devices, notification);
}

const sendToDevice = async (deviceId: number, notification: Notification, options: SendOptions = defaultSendOptions) => {
  const device = getDevice(deviceId);

  if (!device) {
    if (options.ignoreNoDevices !== undefined && !options.ignoreNoDevices) {
      throw new Error(`Device with id ${deviceId} doesn't exist`);
    }

    return;
  }

  return await sendToDevices([device], notification);
}

const sendToDevices = async (
  devices: Device[],
  notification: Notification
) => {
  const byKind = groupBy(
    devices,
    (device) => device.kind
  );
  
  const android = (byKind[DeviceKind.Android] ?? [])
    .filter((device) => device.token !== null)
    .map((device) => fcmSend(device.token!, toFcmNotification(notification)));

  const ios = (byKind[DeviceKind.Ios] ?? [])
    .filter((device) => device.token !== null)
    .map((device) => apnsSend(device.token!, toApnsNotification(notification)));

  const web = (byKind[DeviceKind.Web] ?? [])
    .filter((device) => device.token !== null)
    .map((device) => webPushSend(
      JSON.parse(base64.decode(device.token!).toString()), 
      toWebPushNotification(notification)
    ));
  
  // We want to wait for both types to be delivered, so we
  // wrap both in Promise.allSettled. This way, if a single promise
  // in either type fails, the rest are not interrupted.
  //
  // Promise.allSettled never `reject`s, so this is fine.
  const [androidResult, iosResult, webResult] = await Promise.all([
    Promise.allSettled(android),
    Promise.allSettled(ios),
    Promise.allSettled(web)
  ]);

  const countFulfilled = <T>(it: PromiseSettledResult<T>[]) => {
    return it.filter((it) => it.status === "fulfilled").length;
  }

  const breakdown = <T>(it: PromiseSettledResult<T>[]) => {
    return {
      total: it.length,
      acknowledged: countFulfilled(it)
    }
  }

  const androidAcknowledged = countFulfilled(androidResult);
  const iosAcknowledged = countFulfilled(iosResult);
  const webAcknowledged = countFulfilled(webResult);
  const total = androidResult.length + iosResult.length + webResult.length;

  return {
    acknowledged: androidAcknowledged + iosAcknowledged + webAcknowledged,
    total,
    platforms: {
      ios: breakdown(iosResult),
      android: breakdown(iosResult),
      web: breakdown(webResult)
    }
  }
}

export const init = () => {
  initDb();
}

export const pushNotificationService = {
  sendToUser,
  sendToUsers,
  sendToDevice,
  sendToDevices
};