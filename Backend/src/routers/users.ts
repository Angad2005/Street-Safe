import { Router } from "express";
import z from "zod";
import { generateSignedRandomBytes } from "~/lib/crypto/random";
import { getValidated, validate } from "~/lib/validation";
import { signedBlob } from "~/lib/validation/signed";

import { authenticate, getUserId } from "~/services/auth/middleware";
import { createDevice, CreateDeviceMobile, CreateDeviceParams, CreateDeviceWeb, DeviceKind, toDeviceKind, UpdatePushTokenForDevice, updatePushTokenForDevice } from "~/services/push-notifications/db";
import { webPushSchema } from "~/services/push-notifications/services/web-push";
import { userService } from "~/services/user";

const router = Router();

router.get(
  "/@me", 
  authenticate({ required: true }),
  async (req, res) => {
    const userId = getUserId(req)!;
    const user = (await userService.getById(userId))!;
    
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl
    });
  } 
  
);


router.get(
  "/getUser",
  authenticate({ required: true }),
  async (req, res) => {
    try {
      const id = Number(req.query.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      const user = await userService.getById(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl
      });
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  }
);


const createOrUpdateDeviceSchemaBase = z.object({ deviceId: signedBlob.nullable() });
const createOrUpdateDeviceSchemaMobileBase = createOrUpdateDeviceSchemaBase.extend({ notificationPushToken: z.string().optional() });

const createOrUpdateDeviceSchemaAndroid = createOrUpdateDeviceSchemaMobileBase.extend({ channel: z.literal("android") });
const createOrUpdateDeviceSchemaIos = createOrUpdateDeviceSchemaMobileBase.extend({ channel: z.literal("ios") });

const createOrUpdateDeviceSchemaWeb = createOrUpdateDeviceSchemaBase.extend({
  channel: z.literal("web"),
  webPush: webPushSchema.nullable()
});

const createOrUpdateDeviceSchema = z.discriminatedUnion("channel", [
  createOrUpdateDeviceSchemaAndroid,
  createOrUpdateDeviceSchemaIos,
  createOrUpdateDeviceSchemaWeb
]);

router.patch(
  "/@me/devices",
  authenticate({ required: false }),
  validate({ body: createOrUpdateDeviceSchema }),
  (req, res) => {
    const data = getValidated(req, createOrUpdateDeviceSchema);

    if (!data.deviceId) {
      const { raw, signed } = generateSignedRandomBytes(32); 

      const params: CreateDeviceParams = {
        userId: getUserId(req),
        deviceId: raw
      } as CreateDeviceParams;
      
      if (data.channel === "web") {
        (params as CreateDeviceWeb).kind = DeviceKind.Web;
        (params as CreateDeviceWeb).webPush = data.webPush ?? null;
      } else {
        (params as CreateDeviceMobile).kind = toDeviceKind(data.channel) as CreateDeviceMobile["kind"];
        (params as CreateDeviceMobile).token = data.notificationPushToken ?? null;
      }     
      
      createDevice(params);
      res.status(201).json({ deviceId: signed });
    } else {
      const pushToken: UpdatePushTokenForDevice | null  = data.channel === "web"
        ? (data.webPush ? { kind: DeviceKind.Web, webPush: data.webPush } : null)
        : (data.notificationPushToken ? { kind: toDeviceKind(data.channel) as DeviceKind.Ios | DeviceKind.Android, token: data.notificationPushToken } : null);
      
      if (pushToken) {
        updatePushTokenForDevice(
          data.deviceId!,
          pushToken
        );
      }

      // No useful data to return to client.
      res.status(204).end();
    }
  }
);

export default router;