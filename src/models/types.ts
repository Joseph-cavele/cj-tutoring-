// Shared enums and helpers for all models.

export const ROLES = ['student', 'parent', 'tutor', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const CLASS_STATUS = ['scheduled', 'live', 'completed', 'cancelled'] as const;
export type ClassStatus = (typeof CLASS_STATUS)[number];

export const ATTENDANCE_STATUS = ['present', 'absent', 'late', 'excused'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[number];

export const SUBMISSION_STATUS = ['pending', 'submitted', 'late', 'graded'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUS)[number];

export const PAYMENT_STATUS = ['pending', 'successful', 'failed', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const PAYMENT_PROVIDERS = ['paystack', 'paypal'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const SUBSCRIPTION_STATUS = ['active', 'expired', 'cancelled', 'pending'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[number];

export const DELIVERY_MODES = ['online', 'in_person', 'hybrid'] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

// Question types moved to @/lib/assessment/constants so client components can
// read them without importing a model. Re-exported so the barrel keeps working.
export { QUESTION_TYPES, type QuestionType } from '@/lib/assessment/constants';

/**
 * A file stored in Cloudinary. public_id is kept alongside the URL because
 * deleting or transforming the asset later requires it.
 */
export const cloudinaryFileFields = {
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  fileName: { type: String },
  fileType: { type: String },
  bytes: { type: Number },
} as const;

/**
 * How an offer is priced, from CLAUDE.md section 5. Kept as a field rather than
 * inferred, so the pricing page can group without guessing from the name.
 */
export const PACKAGE_CATEGORIES = ['monthly', 'exam_prep', 'hourly'] as const;
export type PackageCategory = (typeof PACKAGE_CATEGORIES)[number];
