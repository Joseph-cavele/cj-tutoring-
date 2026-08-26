import type { DeliveryMode } from '@/models/types';

/**
 * Shapes the booking UI works with.
 *
 * Kept free of Mongoose types so client components can import them without
 * dragging the database driver into the browser bundle.
 */

export type BookableStudent = {
  studentId: string;
  name: string;
};

export type BookableSubject = {
  subjectId: string;
  name: string;
  slug: string;
  defaultDurationMinutes: number;
};

export type BookableTutor = {
  tutorId: string;
  name: string;
  bio?: string;
  hourlyRate?: number;
  profileImage?: string;
  teachingModes: DeliveryMode[];
};

export type TimeSlot = {
  startTime: string;
  endTime: string;
};

/** What the wizard collects, before it is sent to the server for checking. */
export type BookingDraft = {
  studentId: string;
  subjectId: string;
  tutorId: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  teachingMode: DeliveryMode;
  notes: string;
};

export const EMPTY_DRAFT: BookingDraft = {
  studentId: '',
  subjectId: '',
  tutorId: '',
  date: '',
  startTime: '',
  durationMinutes: 60,
  teachingMode: 'online',
  notes: '',
};

export const WIZARD_STEPS = [
  { key: 'student', label: 'Student' },
  { key: 'subject', label: 'Subject' },
  { key: 'tutor', label: 'Tutor' },
  { key: 'schedule', label: 'Date & Time' },
  { key: 'confirm', label: 'Confirm' },
] as const;

export type WizardStepKey = (typeof WIZARD_STEPS)[number]['key'];

export const MODE_LABELS: Record<DeliveryMode, string> = {
  online: 'Online',
  in_person: 'In person',
  hybrid: 'Online or in person',
};

/** "90" -> "1 hr 30 min", the way a duration reads on a card. */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} hr`;
  return `${hours} hr ${rest} min`;
}

/** "2026-08-25" -> "Tuesday, 25 August", in South African form. */
export function formatBookingDate(isoDate: string): string {
  if (!isoDate) return '';

  return new Intl.DateTimeFormat('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00.000Z`));
}
