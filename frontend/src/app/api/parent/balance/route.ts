import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/middleware';
import { assertParentChildRelationship, OwnershipError } from '@/lib/auth/ownership';
import { connectDB } from '@/lib/mongodb';
import { Invoice, Parent, Payment } from '@/models';

/**
 * Parent-only route to view outstanding balances, payments, and invoices for linked children.
 * Verifies that the requested child is linked to the parent.
 */
export async function GET(request: Request) {
  const authCheck = await requireApiRole('parent');
  if (authCheck.response) return authCheck.response;

  await connectDB();

  const parent = await Parent.findOne({ user: authCheck.user.id }).select('_id students').lean();

  if (!parent) {
    return NextResponse.json({ error: 'Parent record not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');

  let filterStudentIds: string[] = [];

  if (studentId) {
    try {
      await assertParentChildRelationship(authCheck.user.id, studentId);
      filterStudentIds = [studentId];
    } catch (error) {
      if (error instanceof OwnershipError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else {
    filterStudentIds = (parent.students ?? []).map((id) => id.toString());
  }

  const [invoices, payments] = await Promise.all([
    Invoice.find({ student: { $in: filterStudentIds } })
      .sort({ createdAt: -1 })
      .lean(),
    Payment.find({
      $or: [{ parent: parent._id }, { student: { $in: filterStudentIds } }],
    })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const unpaidInvoices = invoices.filter((i) => !i.paidAt);
  const outstandingBalance = unpaidInvoices.reduce((acc, curr) => acc + (curr.total || 0), 0);

  return NextResponse.json({
    outstandingBalance,
    currency: 'ZAR',
    invoices,
    payments,
  });
}
