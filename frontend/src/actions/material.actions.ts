'use server';

import { revalidatePath } from 'next/cache';

import { getAuthorizedUser, getCapableUser } from '@/lib/auth/guard';
import {
  MaterialError,
  createMaterial,
  deleteMaterial,
  recordDownload,
  setMaterialPublished,
} from '@/services/material.service';
import {
  createMaterialSchema,
  materialIdSchema,
  togglePublishSchema,
} from '@/validations/material';
import type { ActionResult } from '@/actions/booking.actions';

/**
 * Study material actions (CLAUDE.md section 16).
 *
 * Uploading is two steps - the browser sends the file straight to Cloudinary,
 * then calls this to record it - and the recording step verifies the file with
 * Cloudinary before storing anything.
 */

function fromError(error: unknown): ActionResult<never> {
  if (error instanceof MaterialError) return { ok: false, error: error.message };

  console.error('[material action] unexpected error', error);
  return { ok: false, error: 'Something went wrong. Please try again.' };
}

function refresh() {
  revalidatePath('/tutor/materials');
  revalidatePath('/student/materials');
}

export async function createMaterialAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('materials:manage');

  if (!user) return { ok: false, error: 'Only a tutor can upload materials' };

  const parsed = createMaterialSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please check the details and try again',
      issues: parsed.error.issues.map((issue) => ({
        field: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    };
  }

  try {
    await createMaterial(user, parsed.data);
    refresh();
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

export async function setMaterialPublishedAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('materials:manage');

  if (!user) return { ok: false, error: 'Only a tutor can publish materials' };

  const parsed = togglePublishSchema.safeParse(input);

  if (!parsed.success) return { ok: false, error: 'That request is not valid' };

  try {
    await setMaterialPublished(user, parsed.data);
    refresh();
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

export async function deleteMaterialAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('materials:manage');

  if (!user) return { ok: false, error: 'Only a tutor can delete materials' };

  const parsed = materialIdSchema.safeParse(input);

  if (!parsed.success) return { ok: false, error: 'That request is not valid' };

  try {
    await deleteMaterial(user, parsed.data.materialId);
    refresh();
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

/** Counts a download. Any signed-in user, since the file URL is public anyway. */
export async function recordDownloadAction(input: unknown): Promise<ActionResult> {
  const user = await getAuthorizedUser();

  if (!user) return { ok: false, error: 'Please sign in' };

  const parsed = materialIdSchema.safeParse(input);

  if (!parsed.success) return { ok: false, error: 'That request is not valid' };

  try {
    await recordDownload(parsed.data.materialId);
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}
