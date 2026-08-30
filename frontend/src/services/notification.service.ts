import { connectDB } from '@/lib/mongodb';
import { Booking, Package, Payment, User } from '@/models';
import type { Role } from '@/models/types';
import { CONTACT } from '@/lib/contact';
import { EmailNotConfiguredError, sendMail } from '@/lib/email/mailer';
import { appUrl, formatMoney, renderEmail, type EmailContent } from '@/lib/email/templates';
import { HOME_BY_ROLE } from '@/lib/routes';
import { formatBookingDate } from '@/types/booking';

/**
 * Transactional email for the three moments a customer expects to hear from
 * us (CLAUDE.md section 23): an account is created, a lesson is booked, and a
 * payment goes through.
 *
 * Every function here is best effort. The account, the booking and the payment
 * are all committed before a notification is attempted, so a Resend outage is
 * logged and swallowed rather than failing an operation the customer has
 * already completed. Nothing in this file may throw.
 */

const MODE_LABEL: Record<string, string> = {
  online: 'Online',
  in_person: 'In person',
  hybrid: 'Online or in person',
};

/** Sends and never throws. Returns whether the message actually went out. */
async function deliver(
  context: string,
  message: { to?: string; subject: string; content: EmailContent; replyTo?: string }
): Promise<boolean> {
  const { text, html } = renderEmail(message.content);

  try {
    await sendMail({
      to: message.to,
      subject: message.subject,
      text,
      html,
      replyTo: message.replyTo,
    });

    return true;
  } catch (error) {
    // A machine with no mail credentials is a normal development state, so it
    // is not worth a stack trace every time. Anything else is.
    if (!(error instanceof EmailNotConfiguredError)) {
      console.error(`[notify] ${context} failed`, error);
    }

    return false;
  }
}

/** Where this person should land when they follow a link from an email. */
function dashboardUrl(role: Role): string {
  const base = appUrl();
  return base ? `${base}${HOME_BY_ROLE[role]}` : '';
}

/** A call to action, or nothing when no absolute site URL is configured. */
function ctaFor(role: Role, label: string) {
  const url = dashboardUrl(role);
  return url ? { label, url } : undefined;
}

/* -------------------------------------------------------------------------- */
/* 1. A new account                                                            */
/* -------------------------------------------------------------------------- */

const WELCOME_BY_ROLE: Record<Role, string> = {
  student:
    'Thank you for applying to join CJ Private Tutoring as a student. Your tutor will review your application, and we will email you as soon as it is accepted. You can sign in and book your first lesson from that moment.',
  parent:
    'Thank you for applying to join CJ Private Tutoring as a parent. Your tutor will review your application, and we will email you as soon as it is accepted. You can then sign in, have your children linked and follow their lessons, attendance, results and invoices from one place.',
  tutor:
    'Thank you for registering as a tutor. Your details will be checked before your account is activated, and we will email you as soon as that is done.',
  admin: 'Your administrator account is ready.',
};

/**
 * Confirms a registration was received.
 *
 * Every self-registration is an application now, not a working account, so
 * this deliberately does not link to a dashboard - the link would lead to a
 * login that refuses them. The decision email carries the call to action
 * instead. An admin never arrives here, but the map covers the role anyway.
 */
export async function notifyAccountCreated(params: {
  to: string;
  name: string;
  role: Role;
}): Promise<boolean> {
  const awaitingApproval = params.role !== 'admin';

  return deliver('account created', {
    to: params.to,
    subject: awaitingApproval
      ? 'We have received your application'
      : 'Welcome to CJ Private Tutoring',
    content: {
      heading: awaitingApproval
        ? 'Application received'
        : `Welcome to CJ Private Tutoring, ${params.name}`,
      greeting: `Hi ${params.name},`,
      intro: [WELCOME_BY_ROLE[params.role]],
      details: [
        { label: 'Email', value: params.to },
        { label: 'Account type', value: params.role },
        ...(awaitingApproval
          ? [{ label: 'Status', value: 'Waiting for your tutor to review it' }]
          : []),
      ],
      cta: awaitingApproval ? undefined : ctaFor(params.role, 'Go to your dashboard'),
      outro: [
        'Keep this email for your records. If you did not create this account, please let us know.',
        `Any questions? Reply to this email or call us on ${CONTACT.phone.display}.`,
      ],
    },
  });
}

/**
 * Tells an applicant the tutor's answer.
 *
 * Acceptance is the first email that links to a dashboard, because it is the
 * first moment the person can actually sign in. A decline says so plainly and
 * still leaves a way to reach a human, since a rejected application is exactly
 * the case where somebody wants to ask why.
 */
export async function notifyApplicationDecision(params: {
  to: string;
  name: string;
  role: Role;
  approved: boolean;
  note?: string;
}): Promise<boolean> {
  const intro = params.approved
    ? [
        'Good news - your application has been accepted, and your account is now open.',
        'You can sign in with the email address and password you chose when you registered.',
      ]
    : [
        'Thank you for your interest in CJ Private Tutoring. Your application has not been accepted at this time, so the account cannot be used to sign in.',
        'If you think this is a mistake, or you would like to talk it through, please reply to this email or give us a call.',
      ];

  return deliver('application decision', {
    to: params.to,
    subject: params.approved
      ? 'Your CJ Private Tutoring account is open'
      : 'About your CJ Private Tutoring application',
    content: {
      heading: params.approved
        ? `Welcome to CJ Private Tutoring, ${params.name}`
        : 'About your application',
      greeting: `Hi ${params.name},`,
      intro,
      details: [
        { label: 'Email', value: params.to },
        { label: 'Account type', value: params.role },
        ...(params.note ? [{ label: 'Note from your tutor', value: params.note }] : []),
      ],
      cta: params.approved ? ctaFor(params.role, 'Sign in to your dashboard') : undefined,
      outro: [`Any questions? Reply to this email or call us on ${CONTACT.phone.display}.`],
    },
  });
}

/* -------------------------------------------------------------------------- */
/* 1b. Sign-in details changed                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Tells someone their email address or password was changed.
 *
 * Deliberately has no "undo" link and no call to action. Its whole job is to
 * reach a human who did not make the change, and a one-click link in that
 * email would be one more thing for an attacker to aim at. The instruction is
 * to phone us, which cannot be forged.
 *
 * For an email change this is sent to the old address too, since that is the
 * only inbox the rightful owner still controls afterwards.
 */
export async function notifyCredentialChange(params: {
  to: string;
  name: string;
  change: 'email' | 'password';
  newEmail?: string;
}): Promise<boolean> {
  const isEmail = params.change === 'email';

  return deliver('credential change', {
    to: params.to,
    subject: isEmail
      ? 'The email address on your account was changed'
      : 'Your password was changed',
    content: {
      heading: isEmail ? 'Email address changed' : 'Password changed',
      greeting: `Hi ${params.name},`,
      intro: [
        isEmail
          ? 'The email address used to sign in to your CJ Private Tutoring account has just been changed. You will need the new address to sign in from now on.'
          : 'The password on your CJ Private Tutoring account has just been changed. You will need the new password to sign in from now on.',
        'If this was you, there is nothing to do.',
      ],
      details: [
        ...(isEmail && params.newEmail
          ? [{ label: 'New email address', value: params.newEmail }]
          : []),
        { label: 'When', value: new Date().toLocaleString('en-ZA') },
      ],
      outro: [
        `If this was NOT you, call us straight away on ${CONTACT.phone.display} so we can secure the account.`,
      ],
    },
  });
}

/* -------------------------------------------------------------------------- */
/* 2. A lesson is booked                                                       */
/* -------------------------------------------------------------------------- */

type BookingParties = {
  booking: {
    id: string;
    date: Date;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    teachingMode: string;
    amount: number;
    currency: string;
    paymentStatus: string;
    notes?: string | null;
  };
  subjectName: string;
  studentName: string;
  studentEmail?: string;
  tutorName: string;
  tutorEmail?: string;
  /** Set only when a parent placed the booking. */
  parentName?: string;
  parentEmail?: string;
};

/** Loads the people and the facts an email about a lesson needs. */
async function loadBookingParties(bookingId: string): Promise<BookingParties | null> {
  await connectDB();

  const booking = await Booking.findById(bookingId)
    .populate<{ subject: { name?: string } }>('subject', 'name')
    .populate({
      path: 'student',
      select: 'user',
      populate: { path: 'user', select: 'name email' },
    })
    .populate({
      path: 'parent',
      select: 'user',
      populate: { path: 'user', select: 'name email' },
    })
    .populate({
      path: 'tutor',
      select: 'user',
      populate: { path: 'user', select: 'name email' },
    })
    .lean();

  if (!booking) return null;

  type Party = { user?: { name?: string; email?: string } } | null | undefined;

  const student = booking.student as unknown as Party;
  const parent = booking.parent as unknown as Party;
  const tutor = booking.tutor as unknown as Party;

  return {
    booking: {
      id: String(booking._id),
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      durationMinutes: booking.durationMinutes,
      teachingMode: booking.teachingMode,
      amount: booking.amount,
      currency: booking.currency,
      paymentStatus: booking.paymentStatus,
      notes: booking.notes,
    },
    subjectName: booking.subject?.name ?? 'Tutoring',
    studentName: student?.user?.name ?? 'Student',
    studentEmail: student?.user?.email,
    tutorName: tutor?.user?.name ?? 'Your tutor',
    tutorEmail: tutor?.user?.email,
    parentName: parent?.user?.name,
    parentEmail: parent?.user?.email,
  };
}

function lessonDetails(parties: BookingParties) {
  const { booking } = parties;

  return [
    { label: 'Subject', value: parties.subjectName },
    { label: 'Tutor', value: parties.tutorName },
    { label: 'Date', value: formatBookingDate(booking.date.toISOString().slice(0, 10)) },
    {
      label: 'Time',
      value: `${booking.startTime} - ${booking.endTime} (${booking.durationMinutes} min)`,
    },
    { label: 'Format', value: MODE_LABEL[booking.teachingMode] ?? booking.teachingMode },
    { label: 'Amount', value: formatMoney(booking.amount, booking.currency) },
  ];
}

/**
 * Confirms a lesson request to whoever placed it, and tells the tutor and the
 * office about it.
 *
 * A request is not a confirmed lesson: the tutor still has to accept it, and
 * where a gateway is configured it only reaches the tutor once it is paid for.
 * The wording says so, rather than promising a lesson that nobody has agreed
 * to yet.
 */
export async function notifyBookingCreated(bookingId: string): Promise<void> {
  let parties: BookingParties | null;

  try {
    parties = await loadBookingParties(bookingId);
  } catch (error) {
    console.error('[notify] could not load booking', bookingId, error);
    return;
  }

  if (!parties) return;

  const { booking } = parties;
  const awaitingPayment = booking.paymentStatus === 'pending';
  const details = lessonDetails(parties);

  const nextStep = awaitingPayment
    ? 'Your lesson is being held for you. Once payment is complete the request goes to your tutor to accept, and we will email you again.'
    : 'Your request has gone to your tutor. We will email you as soon as they accept it.';

  // The booker is the parent when one placed it, otherwise the student.
  const bookerEmail = parties.parentEmail ?? parties.studentEmail;
  const bookerName = parties.parentEmail ? parties.parentName : parties.studentName;
  const bookerRole: Role = parties.parentEmail ? 'parent' : 'student';

  if (bookerEmail) {
    await deliver('booking confirmation', {
      to: bookerEmail,
      subject: `Lesson request received: ${parties.subjectName}`,
      content: {
        heading: 'We have your lesson request',
        greeting: `Hi ${bookerName ?? 'there'},`,
        intro: [
          parties.parentEmail
            ? `Here are the details of the lesson you requested for ${parties.studentName}.`
            : 'Here are the details of the lesson you requested.',
        ],
        details,
        cta: ctaFor(bookerRole, 'View your bookings'),
        outro: [nextStep, 'Need to change something? Reply to this email or call us.'],
      },
    });
  }

  if (parties.tutorEmail) {
    await deliver('booking tutor notice', {
      to: parties.tutorEmail,
      subject: `New lesson request from ${parties.studentName}`,
      content: {
        heading: 'You have a new lesson request',
        greeting: `Hi ${parties.tutorName},`,
        intro: [
          awaitingPayment
            ? `${parties.studentName} has requested a lesson. It will appear in your dashboard to accept once the payment clears.`
            : `${parties.studentName} has requested a lesson. Please accept or decline it from your dashboard.`,
        ],
        details: [{ label: 'Student', value: parties.studentName }, ...details],
        cta: ctaFor('tutor', 'Open your dashboard'),
        outro: booking.notes ? [`Note from the student: ${booking.notes}`] : undefined,
      },
    });
  }

  // The office copy, so a booking is visible without opening the admin area.
  await deliver('booking office notice', {
    subject: `New booking: ${parties.studentName} - ${parties.subjectName}`,
    content: {
      heading: 'New lesson booking',
      details: [
        { label: 'Student', value: parties.studentName },
        ...(parties.parentName ? [{ label: 'Booked by', value: parties.parentName }] : []),
        ...details,
        { label: 'Payment', value: booking.paymentStatus },
        { label: 'Reference', value: booking.id },
      ],
    },
  });
}

/**
 * Acknowledges a trial lesson request from the public booking form.
 *
 * These come from visitors with no account, so the email is the only record
 * they get that the request arrived.
 */
export async function notifyTrialRequestReceived(params: {
  to: string;
  name: string;
  subjectName: string;
  grade: number | string;
  mode: string;
  preferredDate: string;
  preferredTime: string;
}): Promise<boolean> {
  return deliver('trial acknowledgement', {
    to: params.to,
    subject: `We have your trial lesson request: ${params.subjectName}`,
    content: {
      heading: 'Thank you, we have your request',
      greeting: `Hi ${params.name},`,
      intro: [
        'We have received your trial lesson request and one of our team will contact you shortly to confirm a time.',
      ],
      details: [
        { label: 'Subject', value: params.subjectName },
        { label: 'Grade', value: String(params.grade) },
        { label: 'Format', value: MODE_LABEL[params.mode] ?? params.mode },
        { label: 'Preferred', value: `${params.preferredDate} at ${params.preferredTime}` },
      ],
      outro: [`If you would rather speak to someone now, call us on ${CONTACT.phone.display}.`],
    },
  });
}

/* -------------------------------------------------------------------------- */
/* 3. A payment succeeds                                                       */
/* -------------------------------------------------------------------------- */

type ReceiptPayload = {
  to?: string;
  name: string;
  role: Role;
  reference: string;
  amount: number;
  currency: string;
  paidAt: Date;
  what: string;
  lesson?: { label: string; value: string }[];
};

/**
 * Emails a receipt for a settled payment, and copies the office.
 *
 * Called from the fulfilment path, which only runs after the provider has
 * confirmed the charge, never from the browser saying it paid. Fulfilment is
 * idempotent and this sits inside it, so a retried webhook does not produce a
 * second receipt.
 */
export async function notifyPaymentReceived(paymentId: string): Promise<void> {
  let payload: ReceiptPayload;

  try {
    await connectDB();

    const payment = await Payment.findById(paymentId)
      .select('reference amount currency paidAt paidBy booking package')
      .lean();

    if (!payment) return;

    const payer = payment.paidBy
      ? await User.findById(payment.paidBy).select('name email role').lean()
      : null;

    let what = 'Tutoring';
    let lesson: { label: string; value: string }[] | undefined;

    if (payment.booking) {
      const parties = await loadBookingParties(String(payment.booking));

      if (parties) {
        what = `${parties.subjectName} lesson`;
        // The amount is already its own line further down the receipt.
        lesson = lessonDetails(parties).filter((detail) => detail.label !== 'Amount');
      }
    } else if (payment.package) {
      const pkg = await Package.findById(payment.package).select('name').lean();
      what = pkg?.name ? `${pkg.name} package` : 'Lesson package';
    }

    payload = {
      to: payer?.email,
      name: payer?.name ?? 'there',
      role: (payer?.role as Role) ?? 'student',
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      paidAt: payment.paidAt ?? new Date(),
      what,
      lesson,
    };
  } catch (error) {
    console.error('[notify] could not load payment', paymentId, error);
    return;
  }

  const money = formatMoney(payload.amount, payload.currency);

  const receiptDetails = [
    { label: 'Paid for', value: payload.what },
    ...(payload.lesson ?? []),
    { label: 'Amount', value: money },
    { label: 'Reference', value: payload.reference },
    {
      label: 'Date',
      value: new Intl.DateTimeFormat('en-ZA', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'Africa/Johannesburg',
      }).format(payload.paidAt),
    },
  ];

  if (payload.to) {
    await deliver('payment receipt', {
      to: payload.to,
      subject: `Payment received - ${money}`,
      content: {
        heading: 'Thank you, your payment was successful',
        greeting: `Hi ${payload.name},`,
        intro: [
          `We have received your payment of ${money}. Your invoice is available in your dashboard.`,
        ],
        details: receiptDetails,
        cta: ctaFor(payload.role, 'View your invoices'),
        outro: ['This email is your confirmation of payment. Please keep it for your records.'],
      },
    });
  }

  await deliver('payment office notice', {
    subject: `Payment received: ${money} (${payload.reference})`,
    content: {
      heading: 'Payment received',
      details: [{ label: 'From', value: payload.name }, ...receiptDetails],
    },
  });
}
