import { z } from 'zod';

import { ROLES } from '@/models/types';
import { objectId } from '@/validations/lesson-booking';

/**
 * Admin user management (brief section 12).
 *
 * Every one of these is admin-only. The service repeats the role check and
 * adds the guards that a schema cannot express - not locking yourself out,
 * not removing the last administrator.
 */

export const userQuerySchema = z.object({
  role: z.enum(ROLES).optional(),
  /** Matched against name and email. */
  query: z.string().trim().max(120).optional(),
});

export const linkParentSchema = z.object({
  parentId: objectId,
  studentId: objectId,
});

export const setUserActiveSchema = z.object({
  userId: objectId,
  isActive: z.boolean(),
});

export const changeRoleSchema = z.object({
  userId: objectId,
  role: z.enum(ROLES),
});

export type UserQueryInput = z.infer<typeof userQuerySchema>;
