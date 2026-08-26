import { z } from 'zod';

/**
 * Shared by the form and the route handler, so the browser and the server
 * enforce exactly the same rules (CLAUDE.md section 27: validate all API input).
 */
export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Please enter your name')
    .max(80, 'Name is too long'),

  email: z.email('Please enter a valid email address').max(200),

  subject: z
    .string()
    .trim()
    .min(3, 'Please enter a subject')
    .max(150, 'Subject is too long'),

  message: z
    .string()
    .trim()
    .min(10, 'Please give us a little more detail')
    .max(2000, 'Message is too long'),

  /**
   * Honeypot. Real people never see this field, so anything in it is a bot.
   * Deliberately NOT rejected here: a validation error would name the field and
   * teach a bot to leave it alone. The route accepts it, answers 200 and sends
   * nothing, so the caller cannot tell it was filtered.
   */
  company: z.string().max(200).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;
