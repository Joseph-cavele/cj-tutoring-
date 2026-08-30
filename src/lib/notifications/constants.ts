/**
 * Notification kinds (brief section 26).
 *
 * No database driver here, so the bell and the notification list - both client
 * components - can label and colour an entry without pulling Mongoose into the
 * browser bundle. Same reason as the booking and assessment constants.
 *
 * `type` is stored as a plain string on the model rather than an enum, so an
 * old row whose kind has since been renamed still renders. Anything unknown
 * falls back to the neutral styling below rather than throwing.
 */

export const NOTIFICATION_TYPES = [
  'booking_requested',
  'booking_accepted',
  'booking_rejected',
  'booking_cancelled',
  'payment_received',
  'payment_failed',
  'test_published',
  'test_result',
  'account',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNELS = ['in_app', 'email', 'whatsapp'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/**
 * How each kind reads in the list. `tone` maps to the palette already used by
 * the booking cards, so a confirmed lesson looks the same wherever it appears.
 */
export const NOTIFICATION_TONE: Record<string, 'blue' | 'amber' | 'red' | 'slate'> = {
  booking_requested: 'amber',
  booking_accepted: 'blue',
  booking_rejected: 'red',
  booking_cancelled: 'red',
  payment_received: 'blue',
  payment_failed: 'red',
  test_published: 'amber',
  test_result: 'blue',
  account: 'slate',
};

export function toneFor(type: string): 'blue' | 'amber' | 'red' | 'slate' {
  return NOTIFICATION_TONE[type] ?? 'slate';
}
