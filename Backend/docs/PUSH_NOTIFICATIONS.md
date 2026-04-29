# Push Notifications

Push Notifications are managed differently depending on the channel:
- `ios`: Push notifications via APNs (Apple Push Notification Servers).
- `android`: Push notifications via GCM (Google Cloud Messaging).
- `web`: Push notifications via Web Push.

## Server-side Usage

Server-side usage is relatively simple

```ts
import { pushNotificationService } from "~/services/push-notifications";

// Imagine we want to send notifications to provided user ids.
app.post(
  "/send-notifications",
  async (req, res) => {
    const userIds = req.body.userIds;

    await pushNotificationService.sendToUsers(userIds, {
      title: "Test Notification",
      body: "This is a test notification!",
      priority: NotificationPriorityKind.High
    });

    res.status(200).end("Delivered!");
  }
);
```

In reality, you may want to use this e.g., by getting all friends for a user and sending them a
notification if someone they are friends with deviates from their designated path.

## Client-side usage

On the client, we need a few steps:
- Ask the user for permission
- Get a push token from the device
- Register the push token (used to associate a device when sending notification) associated with the user and the device
- Continually update this token if it expires or is rotated (Which may happen at any time).

This is handled as part of `app/_layout.tsx` so it always runs on first load.

# Caveats and Notes

## iOS

Push notifications on iOS during a development build only work on a native device (i.e., build via XCode and then uploaded to a 
phyiscal device).

## Android

Push notifications on Android requires an emulator with Google Play Services installed and an account signed in, or a native device.

## Web

Web push requires a private key which is provided in `priv/id_ed25519`. The corresponding public key is in `id_ed25519.pub`.