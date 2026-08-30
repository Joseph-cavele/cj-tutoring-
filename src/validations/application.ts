import { z } from 'zod';

/**
 * The tutor's decision on one application.
 *
 * The acting tutor is not part of this schema on purpose - it comes from the
 * session in the action, so no request body can claim to be someone else.
 */
export const applicationDecisionSchema = z.object({
  userId: z.string().min(1, 'Choose an application'),
  decision: z.enum(['approved', 'rejected']),
  // Shown to the applicant in their email, so keep it short and deliberate.
  note: z.string().trim().max(300, 'Keep the note under 300 characters').optional(),
});

export type ApplicationDecisionInput = z.infer<typeof applicationDecisionSchema>;
