'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2, Plus, X } from 'lucide-react';

import { updateTutorProfileAction } from '@/actions/tutor.actions';
import type { DeliveryMode } from '@/models/types';
import { MODE_LABELS } from '@/types/booking';
import { ErrorNote, FIELD_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/booking/ui';

/**
 * A tutor's own profile.
 *
 * Rate and subjects are here rather than in an admin-only screen because they
 * are what makes a tutor bookable at all, and the tutor is the person who
 * knows them. Approval is deliberately absent - it belongs to the admin, and
 * the action this form calls validates against a schema that has no such
 * field.
 */

const MODE_CHOICES: DeliveryMode[] = ['online', 'in_person', 'hybrid'];

export default function ProfileEditor({
  initial,
  subjects,
  grades,
}: {
  initial: {
    bio: string;
    qualifications: string[];
    hourlyRate: number | null;
    subjectIds: string[];
    gradeIds: string[];
    teachingModes: DeliveryMode[];
    profileImage: string;
  };
  subjects: { subjectId: string; name: string }[];
  grades: { gradeId: string; name: string }[];
}) {
  const [bio, setBio] = useState(initial.bio);
  const [qualifications, setQualifications] = useState<string[]>(initial.qualifications);
  const [newQualification, setNewQualification] = useState('');
  const [hourlyRate, setHourlyRate] = useState<number>(initial.hourlyRate ?? 250);
  const [subjectIds, setSubjectIds] = useState<string[]>(initial.subjectIds);
  const [gradeIds, setGradeIds] = useState<string[]>(initial.gradeIds);
  const [teachingModes, setTeachingModes] = useState<DeliveryMode[]>(
    initial.teachingModes.length ? initial.teachingModes : ['online']
  );
  const [profileImage, setProfileImage] = useState(initial.profileImage);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const touch = () => {
    setSaved(false);
    setError(null);
  };

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

  const save = () => {
    setError(null);

    startTransition(async () => {
      const result = await updateTutorProfileAction({
        bio: bio || undefined,
        qualifications,
        hourlyRate,
        subjectIds,
        gradeIds,
        teachingModes,
        profileImage: profileImage || '',
      });

      if (!result.ok) {
        setError(
          result.issues?.length ? result.issues[0].message : result.error
        );
        return;
      }

      setSaved(true);
    });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <h2 className="text-[18px] font-extrabold text-brand-navy">What you teach</h2>
        <p className="mt-1 text-[14px] text-brand-slate">
          Students only see you when they pick one of these subjects.
        </p>

        <fieldset className="mt-4">
          <legend className="text-[13px] font-semibold text-brand-navy">Subjects</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {subjects.map((subject) => {
              const selected = subjectIds.includes(subject.subjectId);

              return (
                <button
                  key={subject.subjectId}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    touch();
                    setSubjectIds((current) => toggle(current, subject.subjectId));
                  }}
                  className={`min-h-11 rounded-full border-[1.5px] px-4 text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue ${
                    selected
                      ? 'border-brand-blue bg-brand-blue text-white'
                      : 'border-brand-blue-100 bg-white text-brand-navy hover:bg-brand-blue-50'
                  }`}
                >
                  {subject.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-[13px] font-semibold text-brand-navy">
            Grades (optional)
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {grades.map((grade) => {
              const selected = gradeIds.includes(grade.gradeId);

              return (
                <button
                  key={grade.gradeId}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    touch();
                    setGradeIds((current) => toggle(current, grade.gradeId));
                  }}
                  className={`min-h-11 rounded-full border-[1.5px] px-4 text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue ${
                    selected
                      ? 'border-brand-blue bg-brand-blue text-white'
                      : 'border-brand-blue-100 bg-white text-brand-navy hover:bg-brand-blue-50'
                  }`}
                >
                  {grade.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-[13px] font-semibold text-brand-navy">
            Teaching format
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {MODE_CHOICES.map((mode) => {
              const selected = teachingModes.includes(mode);

              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    touch();
                    setTeachingModes((current) => toggle(current, mode));
                  }}
                  className={`min-h-11 rounded-full border-[1.5px] px-4 text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue ${
                    selected
                      ? 'border-brand-blue bg-brand-blue text-white'
                      : 'border-brand-blue-100 bg-white text-brand-navy hover:bg-brand-blue-50'
                  }`}
                >
                  {MODE_LABELS[mode]}
                </button>
              );
            })}
          </div>
        </fieldset>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <h2 className="text-[18px] font-extrabold text-brand-navy">Your rate</h2>
        <p className="mt-1 text-[14px] text-brand-slate">
          What a one-hour lesson costs. A booking is priced from this at the
          moment it is made, so changing it later does not alter lessons
          already sold.
        </p>

        <label className="mt-4 block max-w-48">
          <span className="block text-[13px] font-semibold text-brand-navy">
            Rand per hour
          </span>
          <input
            type="number"
            min={1}
            max={10000}
            value={hourlyRate}
            onChange={(event) => {
              touch();
              setHourlyRate(Number(event.target.value));
            }}
            className={`${FIELD_CLASS} mt-1`}
          />
        </label>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <h2 className="text-[18px] font-extrabold text-brand-navy">About you</h2>
        <p className="mt-1 text-[14px] text-brand-slate">
          Shown to students choosing a tutor.
        </p>

        <label className="mt-4 block">
          <span className="block text-[13px] font-semibold text-brand-navy">Bio</span>
          <textarea
            rows={4}
            value={bio}
            onChange={(event) => {
              touch();
              setBio(event.target.value);
            }}
            maxLength={2000}
            placeholder="I have taught Grade 10 to 12 Mathematics for eight years, with a focus on getting the basics solid before exam technique."
            className={`${FIELD_CLASS} mt-1 py-2`}
          />
        </label>

        <div className="mt-4">
          <p className="text-[13px] font-semibold text-brand-navy">Qualifications</p>

          {qualifications.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {qualifications.map((qualification, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span className="flex-1 rounded-xl bg-brand-blue-50/60 px-3 py-2 text-[14px] text-brand-navy">
                    {qualification}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${qualification}`}
                    onClick={() => {
                      touch();
                      setQualifications((current) =>
                        current.filter((_, position) => position !== index)
                      );
                    }}
                    className="rounded-full p-2 text-red-700 hover:bg-red-50"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-2 flex gap-2">
            <input
              value={newQualification}
              onChange={(event) => setNewQualification(event.target.value)}
              placeholder="BSc Mathematics, University of Pretoria"
              maxLength={160}
              aria-label="Add a qualification"
              className={FIELD_CLASS}
            />
            <button
              type="button"
              disabled={newQualification.trim().length < 2 || qualifications.length >= 10}
              onClick={() => {
                touch();
                setQualifications((current) => [...current, newQualification.trim()]);
                setNewQualification('');
              }}
              className={SECONDARY_BUTTON}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add
            </button>
          </div>
        </div>

        <label className="mt-4 block">
          <span className="block text-[13px] font-semibold text-brand-navy">
            Photo URL (optional)
          </span>
          <input
            value={profileImage}
            onChange={(event) => {
              touch();
              setProfileImage(event.target.value);
            }}
            placeholder="https://res.cloudinary.com/..."
            maxLength={500}
            className={`${FIELD_CLASS} mt-1`}
          />
        </label>
      </section>

      {error ? <ErrorNote message={error} /> : null}

      {saved ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-green-50 p-3 text-[14px] font-medium text-green-800"
        >
          <Check className="size-4" aria-hidden="true" />
          Profile saved.
        </p>
      ) : null}

      <button type="button" onClick={save} disabled={pending} className={PRIMARY_BUTTON}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Saving&hellip;
          </>
        ) : (
          'Save profile'
        )}
      </button>
    </div>
  );
}
