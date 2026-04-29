export enum NotificationPriorityKind {
  Low,
  Medium,
  High
}

export type Notification = {
  title: string;
  body: string;
  priority: NotificationPriorityKind
}