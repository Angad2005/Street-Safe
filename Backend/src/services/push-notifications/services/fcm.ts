import { FCM_PROJECT_NAME, FCM_SERVER_KEY } from "~/lib/config";
import { NotificationPriorityKind, type Notification } from "../types";

export const FCM_DOMAIN = "fcm.googleapis.com";

export enum AndroidMessagePriorityKind {
  Normal = "NORMAL",
  High = "HIGH"
}

export enum AndroidNotificationPriorityKind {
  Unspecifeid = "PRIORITY_UNSPECIFIED",
  Minimum = "PRIORITY_MIN",
  Low = "PRIORITY_LOW",
  Default = "PRIORITY_DEFUALT",
  High = "PRIORITY_HIGH",
  Max = "PRIORITY_MAX"
}

export enum VisibilityKind {
  Unspecified = "PRIVATE",
  Private = "PRIVATE",
  Public = "PUBLIC",
  Secret = "SECRET"
}

export type Payload = {
  title: string;
  body: string; 
  collapse_key?: string;
  ttl?: string;
  priority?: AndroidMessagePriorityKind,
  notification_priority: AndroidNotificationPriorityKind,
  visibility?: VisibilityKind,
  notification_count: number,
};

export const send = async (
  deviceToken: string,
  payload: Payload
) => {
  // Reject the notification straight away if
  // the server is not setup to use fcm.
  if (!FCM_SERVER_KEY) {
    throw new Error("FCM credentials not configured");
  }

  const body = {
    message: {
      token: deviceToken,
      data: {
        android: payload
      }
    }
  };

  // TODO: Correct project id.
  const response = await fetch(
    `https://${FCM_DOMAIN}/v1/projects/${FCM_PROJECT_NAME}/messages:send`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FCM_SERVER_KEY}`,
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  // At least wait for a response from the server.
  const _ = await response.json();
}

export const toFcmNotification = (
  shared: Notification
): Payload => {
  const sharedPriorityToAndroidPriorty: Record<NotificationPriorityKind, AndroidNotificationPriorityKind> = {
    [NotificationPriorityKind.High]: AndroidNotificationPriorityKind.High,
    [NotificationPriorityKind.Medium]: AndroidNotificationPriorityKind.Default,
    [NotificationPriorityKind.Low]: AndroidNotificationPriorityKind.Low
  };

  return {
    body: shared.body,
    title: shared.title,
    notification_priority: sharedPriorityToAndroidPriorty[shared.priority],
    notification_count: 1
  };
}