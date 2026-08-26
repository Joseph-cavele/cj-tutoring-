'use client';

import { useState, useTransition } from 'react';
import { Download, Eye, EyeOff, FileText, Loader2, Trash2 } from 'lucide-react';

import {
  deleteMaterialAction,
  recordDownloadAction,
  setMaterialPublishedAction,
} from '@/actions/material.actions';
import type { MaterialView } from '@/services/material.service';
import { ErrorNote } from '@/components/booking/ui';
import { formatBytes } from '@/components/tutor/MaterialUploader';

/**
 * One study material.
 *
 * The file itself lives on Cloudinary and its URL is public - anyone holding
 * the link can open it. What is protected is discovery: the URL only reaches
 * students whose grade the material was published to, because the service
 * filters by the grade on their own record.
 */
export default function MaterialCard({
  material,
  /** Tutors get publish and delete; students get download only. */
  canManage = false,
}: {
  material: MaterialView;
  canManage?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (removed) return null;

  const togglePublished = () => {
    setError(null);

    startTransition(async () => {
      const result = await setMaterialPublishedAction({
        materialId: material.materialId,
        isPublished: !material.isPublished,
      });

      if (!result.ok) setError(result.error);
    });
  };

  const remove = () => {
    setError(null);

    startTransition(async () => {
      const result = await deleteMaterialAction({ materialId: material.materialId });

      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }

      setRemoved(true);
    });
  };

  return (
    <article className="rounded-2xl border border-brand-blue-100 bg-white p-4 sm:p-5">
      <div className="flex gap-3">
        <FileText
          className="mt-0.5 size-5 shrink-0 text-brand-blue"
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 text-[16px] font-bold text-brand-navy">
            {material.title}
            {canManage && !material.isPublished ? (
              <span className="rounded-full bg-brand-amber/15 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-brand-amber-text uppercase">
                Draft
              </span>
            ) : null}
          </h3>

          {material.description ? (
            <p className="mt-1 text-[14px] leading-relaxed text-brand-slate">
              {material.description}
            </p>
          ) : null}

          <p className="mt-1.5 text-[13px] text-brand-slate">
            {material.gradeName} · {material.subjectName} · {material.topicName}
            {material.fileType ? ` · ${material.fileType.toUpperCase()}` : ''}
            {material.bytes ? ` · ${formatBytes(material.bytes)}` : ''}
          </p>

          {canManage ? (
            <p className="mt-1 text-[13px] text-brand-slate">
              {material.downloads} download{material.downloads === 1 ? '' : 's'} ·
              uploaded by {material.uploadedByName}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href={material.url}
          target="_blank"
          rel="noopener noreferrer"
          // Fire and forget: the count is a nicety, and waiting on it would
          // delay opening the file the student actually wants.
          onClick={() => {
            void recordDownloadAction({ materialId: material.materialId });
          }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand-blue px-4 text-[14px] font-semibold text-white transition-colors hover:bg-brand-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
        >
          <Download className="size-4" aria-hidden="true" />
          Open
        </a>

        {canManage ? (
          <>
            <button
              type="button"
              onClick={togglePublished}
              disabled={pending}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-brand-blue-100 px-4 text-[14px] font-semibold text-brand-navy transition-colors hover:bg-brand-blue-50 disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : material.isPublished ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
              {material.isPublished ? 'Hide from students' : 'Publish'}
            </button>

            {confirming ? (
              <span className="inline-flex items-center gap-2">
                <button
                  type="button"
                  onClick={remove}
                  disabled={pending}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-red-600 px-4 text-[14px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Delete for good
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={pending}
                  className="text-[14px] font-semibold text-brand-slate underline underline-offset-2"
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold text-red-700 transition-colors hover:bg-red-50"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Delete
              </button>
            )}
          </>
        ) : null}
      </div>

      {error ? (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      ) : null}
    </article>
  );
}
