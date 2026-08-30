import { assessAttendance } from '@/services/zoom-webhook.service';

/**
 * The thresholds that turn a Zoom participant list into an attendance mark are
 * a judgement call, and they feed a percentage a parent reads. Worth pinning
 * down so nobody quietly changes what "present" means.
 */

const START = new Date('2026-09-01T12:00:00.000Z');

const at = (minutesAfterStart: number) =>
  new Date(START.getTime() + minutesAfterStart * 60_000);

describe('assessAttendance', () => {
  it('marks a student present when they attended most of the lesson', () => {
    const result = assessAttendance({
      participants: [
        { email: 'thabo@example.com', joinedAt: START, leftAt: at(58), minutes: 58 },
      ],
      studentEmail: 'thabo@example.com',
      bookedMinutes: 60,
      meetingStartedAt: START,
    });

    expect(result.status).toBe('present');
    expect(result.minutesAttended).toBe(58);
  });

  it('marks a student late when they joined well after the start', () => {
    const result = assessAttendance({
      participants: [
        { email: 'thabo@example.com', joinedAt: at(15), leftAt: at(60), minutes: 45 },
      ],
      studentEmail: 'thabo@example.com',
      bookedMinutes: 60,
      meetingStartedAt: START,
    });

    expect(result.status).toBe('late');
  });

  it('does not call a few minutes late "late"', () => {
    const result = assessAttendance({
      participants: [
        { email: 'thabo@example.com', joinedAt: at(5), leftAt: at(60), minutes: 55 },
      ],
      studentEmail: 'thabo@example.com',
      bookedMinutes: 60,
      meetingStartedAt: START,
    });

    expect(result.status).toBe('present');
  });

  it('marks a student absent when nobody recognisable joined', () => {
    const result = assessAttendance({
      participants: [{ email: 'someone.else@example.com', minutes: 60 }],
      studentEmail: 'thabo@example.com',
      bookedMinutes: 60,
      meetingStartedAt: START,
    });

    expect(result.status).toBe('absent');
    expect(result.minutesAttended).toBe(0);
  });

  it('marks a student absent when they barely appeared', () => {
    const result = assessAttendance({
      participants: [
        { email: 'thabo@example.com', joinedAt: START, leftAt: at(4), minutes: 4 },
      ],
      studentEmail: 'thabo@example.com',
      bookedMinutes: 60,
      meetingStartedAt: START,
    });

    expect(result.status).toBe('absent');
    // The minutes are still reported, so the tutor can see what happened and
    // override it if the student had connection trouble.
    expect(result.minutesAttended).toBe(4);
  });

  it('sums separate stints when a student drops and rejoins', () => {
    const result = assessAttendance({
      participants: [
        { email: 'thabo@example.com', joinedAt: START, leftAt: at(20), minutes: 20 },
        { email: 'thabo@example.com', joinedAt: at(25), leftAt: at(60), minutes: 35 },
      ],
      studentEmail: 'thabo@example.com',
      bookedMinutes: 60,
      meetingStartedAt: START,
    });

    expect(result.status).toBe('present');
    expect(result.minutesAttended).toBe(55);
    // Earliest join and latest leave across both stints.
    expect(result.joinedAt).toEqual(START);
    expect(result.leftAt).toEqual(at(60));
  });

  it('falls back to the display name when Zoom reports no email', () => {
    const result = assessAttendance({
      participants: [{ name: 'Thabo Mokoena', joinedAt: START, leftAt: at(60), minutes: 60 }],
      studentEmail: 'thabo@example.com',
      studentName: 'Thabo Mokoena',
      bookedMinutes: 60,
      meetingStartedAt: START,
    });

    expect(result.status).toBe('present');
  });

  it('matches email case-insensitively', () => {
    const result = assessAttendance({
      participants: [{ email: 'Thabo@Example.com ', minutes: 60 }],
      studentEmail: 'thabo@example.com',
      bookedMinutes: 60,
      meetingStartedAt: START,
    });

    expect(result.status).toBe('present');
  });

  it('does not mark absent when the booked duration is unknown', () => {
    const result = assessAttendance({
      participants: [{ email: 'thabo@example.com', joinedAt: START, minutes: 5 }],
      studentEmail: 'thabo@example.com',
      bookedMinutes: 0,
      meetingStartedAt: START,
    });

    expect(result.status).toBe('present');
  });
});
