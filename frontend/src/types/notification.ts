export type NotificationPreferenceKey =
  | "productUpdates"
  | "gameReminders"
  | "securityAlerts"
  | "marketing";

export interface NotificationPreferences {
  productUpdates: boolean;
  gameReminders: boolean;
  securityAlerts: boolean;
  marketing: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  productUpdates: true,
  gameReminders: true,
  securityAlerts: true,
  marketing: false,
};

export const NOTIFICATION_PREFERENCE_LABELS: Record<
  NotificationPreferenceKey,
  { label: string; description: string }
> = {
  productUpdates: {
    label: "Product updates",
    description: "Release notes, beta access, and feature launches.",
  },
  gameReminders: {
    label: "Game reminders",
    description: "Notifications for upcoming tournaments and quests.",
  },
  securityAlerts: {
    label: "Security alerts",
    description: "Suspicious activity and account security notices.",
  },
  marketing: {
    label: "Marketing offers",
    description: "Promotions, partner offers, and newsletters.",
  },
};
