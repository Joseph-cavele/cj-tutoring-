import { NextResponse } from 'next/server';

import { getAuthorizedUser } from '@/lib/auth/guard';
import { isCloudinaryConfigured, signUpload } from '@/lib/cloudinary';
import { HOUR, MINUTE, checkRateLimit, tooManyRequests } from '@/lib/rate-limit';

/**
 * Mints a signature for one direct browser upload.
 *
 * The API secret never leaves the server: what goes back is a signature over
 * a folder and timestamp we chose, which authorises exactly one upload into
 * our own materials folder and nothing else.
 *
 * Tutors and admins only, and rate limited - a signature is permission to
 * write to our Cloudinary account, so it is not handed out freely.
 */
const SIGN_RULES = [
  { name: 'burst', limit: 10, windowMs: MINUTE },
  { name: 'hourly', limit: 60, windowMs: HOUR },
];

export async function POST() {
  const user = await getAuthorizedUser(['tutor', 'admin']);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rate = await checkRateLimit(`sign:${user.id}`, SIGN_RULES);

  if (!rate.allowed) return tooManyRequests(rate);

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: 'File uploads are not switched on. Set the Cloudinary keys.' },
      { status: 503 }
    );
  }

  try {
    return NextResponse.json(signUpload());
  } catch (error) {
    console.error('[api/materials/sign] failed', error);
    return NextResponse.json({ error: 'Could not prepare the upload' }, { status: 500 });
  }
}
