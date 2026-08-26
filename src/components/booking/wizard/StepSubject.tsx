'use client';

import { ChoiceCard, EmptyNote } from '@/components/booking/ui';
import type { BookableSubject } from '@/types/booking';

/** Step 2: the subject. Only active subjects reach here. */
export default function StepSubject({
  subjects,
  selectedId,
  onSelect,
}: {
  subjects: BookableSubject[];
  selectedId: string;
  onSelect: (subjectId: string) => void;
}) {
  if (subjects.length === 0) {
    return (
      <EmptyNote
        title="No subjects available"
        body="No subjects are open for booking at the moment. Please contact the office."
      />
    );
  }

  return (
    <fieldset>
      <legend className="sr-only">Choose a subject</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {subjects.map((subject) => (
          <ChoiceCard
            key={subject.subjectId}
            selected={selectedId === subject.subjectId}
            onSelect={() => onSelect(subject.subjectId)}
            title={subject.name}
          />
        ))}
      </div>
    </fieldset>
  );
}
