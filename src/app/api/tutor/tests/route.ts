import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/mongodb';
import { Test } from '@/models';

/**
 * Tutor-only route to list all tests and exams.
 * Rejects student and parent roles with 403 Forbidden.
 */
export async function GET() {
  const authCheck = await requireApiRole('tutor');
  if (authCheck.response) return authCheck.response;

  await connectDB();

  const tests = await Test.find()
    .populate<{ subject: { name: string } }>('subject', 'name')
    .populate<{ grade: { name: string } }>('grade', 'name')
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ tests });
}
