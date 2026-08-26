import { z } from 'zod';

import { objectId } from '@/validations/lesson-booking';

/** Study materials (CLAUDE.md section 16). */

export const createMaterialSchema = z.object({
  title: z.string().trim().min(2, 'Give the material a title').max(140),
  description: z.string().trim().max(1000).optional(),
  gradeId: objectId,
  subjectId: objectId,
  /**
   * Free text. The service finds or creates the Topic for this grade and
   * subject, so browsing by topic works without a separate admin screen.
   */
  topicName: z.string().trim().max(120).optional(),
  /** What the browser says it uploaded. Verified against Cloudinary. */
  publicId: z.string().trim().min(3).max(300),
  resourceType: z.enum(['image', 'video', 'raw']),
  fileName: z.string().trim().max(200).optional(),
  isPublished: z.boolean(),
});

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;

export const materialIdSchema = z.object({ materialId: objectId });

export const togglePublishSchema = z.object({
  materialId: objectId,
  isPublished: z.boolean(),
});

export const materialFilterSchema = z.object({
  gradeId: objectId.optional(),
  subjectId: objectId.optional(),
  topicId: objectId.optional(),
});
