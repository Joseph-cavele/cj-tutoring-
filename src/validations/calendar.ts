import { z } from 'zod';

/**
 * Calendar and time-off input (brief section 27).
 *
 * The date is a plain "YYYY-MM-DD" string rather than a coerced Date: the
 * whole app keys days on that string, and letting Zod build a Date here would
 * introduce the browser's timezone into a value that must stay a calendar day.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date')
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()), 'Choose a date');

export const timeOffSchema = z.object({
  isoDate,
  reason: z.string().trim().max(120, 'Keep the reason short').optional(),
});

export const removeTimeOffSchema = z.object({ isoDate });

export type TimeOffInput = z.infer<typeof timeOffSchema>;
