import { CancelBooking } from '@/components/booking/BookingActions';
import PayNowButton from '@/components/booking/PayNowButton';
import type { BookingView } from '@/services/lesson-booking.service';

/**
 * What a student or parent can do with one of their own bookings.
 *
 * A lesson whose payment never completed still holds its slot, so the way out
 * is either to finish paying or to cancel and free the time - both are offered
 * together rather than leaving the booking stuck.
 */
export default function BookingOwnerActions({ booking }: { booking: BookingView }) {
  const needsPayment =
    booking.paymentStatus === 'pending' || booking.paymentStatus === 'failed';

  return (
    <div className="space-y-3">
      {needsPayment ? (
        <PayNowButton
          bookingId={booking.id}
          amount={booking.amount}
          currency={booking.currency}
        />
      ) : null}

      <CancelBooking bookingId={booking.id} />
    </div>
  );
}
