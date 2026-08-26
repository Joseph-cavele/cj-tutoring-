import { z } from 'zod';

export const subscribeSchema = z.object({
  email: z.email('Please enter a valid email address').max(200),
  /** Honeypot - see the note in validations/contact.ts. */
  company: z.string().max(200).optional(),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;
