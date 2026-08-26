'use client';

import { ChoiceCard, EmptyNote, ErrorNote, LoadingRow } from '@/components/booking/ui';
import { MODE_LABELS, type BookableTutor } from '@/types/booking';

/**
 * Step 3: the tutor.
 *
 * The list is fetched for the chosen subject, so only tutors who actually
 * teach it appear (brief section 6). Filtering happens on the server; this
 * component never sees a tutor it should hide.
 */
export default function StepTutor({
  tutors,
  loading,
  error,
  selectedId,
  onSelect,
}: {
  tutors: BookableTutor[];
  loading: boolean;
  error: string | null;
  selectedId: string;
  onSelect: (tutorId: string) => void;
}) {
  if (loading) return <LoadingRow label="Finding tutors for this subject&hellip;" />;

  if (error) return <ErrorNote message={error} />;

  if (tutors.length === 0) {
    return (
      <EmptyNote
        title="No tutors for that subject yet"
        body="Nobody is currently taking bookings for this subject. Try another subject, or contact the office and we will arrange someone."
      />
    );
  }

  return (
    <fieldset>
      <legend className="sr-only">Choose a tutor</legend>
      <div className="grid gap-2">
        {tutors.map((tutor) => (
          <ChoiceCard
            key={tutor.tutorId}
            selected={selectedId === tutor.tutorId}
            onSelect={() => onSelect(tutor.tutorId)}
            title={tutor.name}
            subtitle={
              tutor.bio
                ? tutor.bio.slice(0, 140)
                : tutor.teachingModes.map((mode) => MODE_LABELS[mode]).join(' · ')
            }
            meta={tutor.hourlyRate ? `R${tutor.hourlyRate}/hr` : undefined}
          />
        ))}
      </div>
    </fieldset>
  );
}
