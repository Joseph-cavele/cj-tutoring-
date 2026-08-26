'use client';

import { ChoiceCard, EmptyNote } from '@/components/booking/ui';
import type { BookableStudent } from '@/types/booking';
import AddChildForm from './AddChildForm';

/**
 * Step 1: who the lesson is for.
 *
 * A student booking for themselves has exactly one option, so the step still
 * renders (the trail stays five steps for everyone) but reads as a
 * confirmation rather than a choice. A parent can add a child here without
 * leaving the flow (brief section 4).
 */
export default function StepStudent({
  students,
  selectedId,
  role,
  onSelect,
  onChildAdded,
}: {
  students: BookableStudent[];
  selectedId: string;
  role: string;
  onSelect: (studentId: string) => void;
  onChildAdded: (studentId: string, name: string) => void;
}) {
  const isParent = role === 'parent';

  if (students.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyNote
          title={isParent ? 'No children on your account yet' : 'No student profile yet'}
          body={
            isParent
              ? 'Add your child below and you can book their first lesson straight away.'
              : 'Your student profile is still being set up. Please contact the office.'
          }
        />

        {isParent ? <AddChildForm onAdded={onChildAdded} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="sr-only">Choose the student</legend>
        <div className="grid gap-2">
          {students.map((student) => (
            <ChoiceCard
              key={student.studentId}
              selected={selectedId === student.studentId}
              onSelect={() => onSelect(student.studentId)}
              title={student.name}
              subtitle={
                !isParent && students.length === 1 ? 'This lesson is for you' : undefined
              }
            />
          ))}
        </div>
      </fieldset>

      {isParent ? <AddChildForm onAdded={onChildAdded} /> : null}
    </div>
  );
}
