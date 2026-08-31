import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/mongodb';
import { Payment } from '@/models';

/**
 * Tutor-only route to list and manage all incoming payments and transactions.
 * Rejects student and parent roles with 403 Forbidden.
 */
export async function GET() {
  const authCheck = await requireApiRole('tutor');
  if (authCheck.response) return authCheck.response;

  await connectDB();

  const payments = await Payment.find()
    .populate<{ student: { user: { name: string; email: string } } }>({
      path: 'student',
      populate: { path: 'user', select: 'name email' },
    })
    .populate<{ parent: { user: { name: string; email: string } } }>({
      path: 'parent',
      populate: { path: 'user', select: 'name email' },
    })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return NextResponse.json({ payments });
}
