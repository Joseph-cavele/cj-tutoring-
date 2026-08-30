import { z } from 'zod';

import { objectId } from '@/validations/lesson-booking';

/**
 * Parent invitation codes (brief section 2).
 *
 * The redeem schema deliberately does NOT try to validate the shape of a code.
 * `normaliseInviteCode` in the service repairs the misreads a parent actually
 * makes - O for zero, a missing hyphen, lower case - and a strict regex here
 * would reject those before the repair could run. The schema only bounds the
 * length so nothing absurd reaches the hash.
 */

export const createParentInviteSchema = z.object({
  studentId: objectId,
});

export const revokeParentInviteSchema = z.object({
  inviteId: objectId,
});

export const redeemParentInviteSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Please enter the code your tutor gave you')
    .max(40, 'That is too long to be an invitation code'),
});

export type CreateParentInviteInput = z.infer<typeof createParentInviteSchema>;
export type RevokeParentInviteInput = z.infer<typeof revokeParentInviteSchema>;
export type RedeemParentInviteInput = z.infer<typeof redeemParentInviteSchema>;
