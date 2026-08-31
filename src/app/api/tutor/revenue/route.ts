import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/mongodb';
import { Payment } from '@/models';

/**
 * Tutor-only route to view revenue analytics and business financial totals.
 * Rejects student and parent roles with 403 Forbidden.
 */
export async function GET() {
  const authCheck = await requireApiRole('tutor');
  if (authCheck.response) return authCheck.response;

  await connectDB();

  const successfulPayments = await Payment.find({ status: 'successful' }).lean();

  const totalRevenue = successfulPayments.reduce(
    (acc, curr) => acc + (curr.amount || 0),
    0
  );

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthlyRevenue = successfulPayments
    .filter((p) => p.createdAt && new Date(p.createdAt) >= startOfMonth)
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  return NextResponse.json({
    totalRevenue,
    monthlyRevenue,
    successfulTransactionsCount: successfulPayments.length,
    currency: 'ZAR',
  });
}
