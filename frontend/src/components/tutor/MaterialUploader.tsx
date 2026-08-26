'use client';

import { useState, useTransition } from 'react';
import { Check, CloudUpload, Loader2, X } from 'lucide-react';

import { createMaterialAction } from '@/actions/material.actions';
import { ErrorNote, Field, FIELD_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/booking/ui';

/**
 * Uploading a study material (CLAUDE.md section 16).
 *
 * Two steps. The file goes straight from the browser to Cloudinary using a
 * signature the server mints, so a 20 MB past paper never passes through our
 * own server. Only then is the result recorded - and the server re-checks that
 * file with Cloudinary before storing it, so what this component reports back
 * is treated as a claim rather than a fact.
 */

type SignResponse = {
  timestamp: number;
  signature: string;
  apiKey: string;
  folder: string;
  uploadUrl: string;
  maxBytes: number;
};

/** Cloudinary classifies by endpoint; we ask for `auto` and record what it says. */
type UploadResult = {
  publicId: string;
  resourceType: 'image' | 'video' | 'raw';
  fileName: string;
};

export default function MaterialUploader({
  subjects,
  grades,
}: {
  subjects: { subjectId: string; name: string }[];
  grades: { gradeId: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [gradeId, setGradeId] = useState(grades[0]?.gradeId ?? '');
  const [subjectId, setSubjectId] = useState(subjects[0]?.subjectId ?? '');
  const [topicName, setTopicName] = useState('');
  const [publishNow, setPublishNow] = useState(true);
  const [file, setFile] = useState<File | null>(null);

  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setTitle('');
    setDescription('');
    setTopicName('');
    setFile(null);
    setProgress(null);
  };

  /** Sends the file to Cloudinary and returns what it created. */
  const uploadToCloudinary = async (chosen: File): Promise<UploadResult> => {
    const signResponse = await fetch('/api/materials/sign', { method: 'POST' });
    const signed: SignResponse & { error?: string } = await signResponse.json();

    if (!signResponse.ok) {
      throw new Error(signed.error ?? 'Could not prepare the upload');
    }

    if (chosen.size > signed.maxBytes) {
      throw new Error(
        `That file is ${formatBytes(chosen.size)}. The limit is ${formatBytes(signed.maxBytes)}.`
      );
    }

    const body = new FormData();
    body.append('file', chosen);
    body.append('api_key', signed.apiKey);
    body.append('timestamp', String(signed.timestamp));
    body.append('folder', signed.folder);
    body.append('signature', signed.signature);

    const upload = await fetch(signed.uploadUrl, { method: 'POST', body });
    const result = await upload.json().catch(() => ({}));

    if (!upload.ok || !result.public_id) {
      throw new Error(result.error?.message ?? 'The upload was rejected');
    }

    return {
      publicId: result.public_id as string,
      resourceType: (result.resource_type as UploadResult['resourceType']) ?? 'raw',
      fileName: chosen.name,
    };
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (!file) {
      setError('Choose a file to upload.');
      return;
    }

    startTransition(async () => {
      let uploaded: UploadResult;

      try {
        setProgress('Uploading the file…');
        uploaded = await uploadToCloudinary(file);
      } catch (uploadError) {
        setProgress(null);
        setError(
          uploadError instanceof Error ? uploadError.message : 'The upload failed'
        );
        return;
      }

      setProgress('Saving…');

      const result = await createMaterialAction({
        title,
        description: description || undefined,
        gradeId,
        subjectId,
        topicName: topicName || undefined,
        publicId: uploaded.publicId,
        resourceType: uploaded.resourceType,
        fileName: uploaded.fileName,
        isPublished: publishNow,
      });

      setProgress(null);

      if (!result.ok) {
        setError(result.issues?.length ? result.issues[0].message : result.error);
        return;
      }

      setSaved(true);
      setOpen(false);
      reset();
    });
  };

  if (subjects.length === 0 || grades.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-brand-blue-100 bg-brand-blue-50/30 p-6 text-center">
        <p className="text-[15px] font-semibold text-brand-navy">
          Subjects and grades are not set up yet
        </p>
        <p className="mx-auto mt-1.5 max-w-sm text-[14px] text-brand-slate">
          An administrator needs to add at least one subject and grade before
          materials can be uploaded.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="space-y-3">
        {saved ? (
          <p
            role="status"
            className="flex items-center gap-2 rounded-xl bg-green-50 p-3 text-[14px] font-medium text-green-800"
          >
            <Check className="size-4" aria-hidden="true" />
            Material uploaded.
          </p>
        ) : null}

        <button type="button" onClick={() => setOpen(true)} className={PRIMARY_BUTTON}>
          <CloudUpload className="size-4" aria-hidden="true" />
          Upload a material
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="rounded-3xl bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-extrabold text-brand-navy">
          Upload a study material
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cancel"
          className="rounded-full p-2 text-brand-slate hover:bg-brand-blue-50"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Title" htmlFor="material-title">
            <input
              id="material-title"
              required
              maxLength={140}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Integration notes"
              className={FIELD_CLASS}
            />
          </Field>
        </div>

        <Field label="Grade" htmlFor="material-grade">
          <select
            id="material-grade"
            value={gradeId}
            onChange={(event) => setGradeId(event.target.value)}
            className={FIELD_CLASS}
          >
            {grades.map((grade) => (
              <option key={grade.gradeId} value={grade.gradeId}>
                {grade.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Subject" htmlFor="material-subject">
          <select
            id="material-subject"
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            className={FIELD_CLASS}
          >
            {subjects.map((subject) => (
              <option key={subject.subjectId} value={subject.subjectId}>
                {subject.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="sm:col-span-2">
          <Field
            label="Topic"
            htmlFor="material-topic"
            hint="Optional. Students browse by topic, and a new one is created if it does not exist yet."
          >
            <input
              id="material-topic"
              maxLength={120}
              value={topicName}
              onChange={(event) => setTopicName(event.target.value)}
              placeholder="Calculus"
              className={FIELD_CLASS}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Description" htmlFor="material-description">
            <textarea
              id="material-description"
              rows={2}
              maxLength={1000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Worked examples for the November paper."
              className={`${FIELD_CLASS} py-2`}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field
            label="File"
            htmlFor="material-file"
            hint="PDF, image, video or worksheet. Up to 20 MB."
          >
            <input
              id="material-file"
              type="file"
              required
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full text-[14px] text-brand-navy file:mr-3 file:min-h-11 file:rounded-full file:border-0 file:bg-brand-blue-50 file:px-4 file:text-[14px] file:font-semibold file:text-brand-blue"
            />
          </Field>

          {file ? (
            <p className="mt-1.5 text-[13px] text-brand-slate">
              {file.name} · {formatBytes(file.size)}
            </p>
          ) : null}
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-[14px] text-brand-navy">
        <input
          type="checkbox"
          checked={publishNow}
          onChange={(event) => setPublishNow(event.target.checked)}
          className="size-4 rounded border-brand-blue-100 text-brand-blue focus:ring-brand-blue"
        />
        Make it visible to students straight away
      </label>

      {error ? (
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending || !file || title.trim().length < 2}
          className={PRIMARY_BUTTON}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {progress ?? 'Working…'}
            </>
          ) : (
            <>
              <CloudUpload className="size-4" aria-hidden="true" />
              Upload
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className={SECONDARY_BUTTON}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Bytes to something a person can read. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
