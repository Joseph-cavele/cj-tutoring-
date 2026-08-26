import Image from 'next/image';
import { ImageIcon } from 'lucide-react';

type ImagePlaceholderProps = {
  /** Drop a file in /public and pass its path to swap the placeholder out. */
  src?: string;
  alt?: string;
  /** Any Tailwind aspect ratio, e.g. "aspect-video". */
  aspect?: string;
  /** Shown inside the empty state so it is obvious what belongs here. */
  label: string;
  /** Suggested dimensions, shown in the empty state. */
  hint?: string;
  sizes?: string;
  className?: string;
  /** Light copy for placement on the deep blue section. */
  tone?: 'light' | 'dark';
};

/**
 * A reserved image slot.
 *
 * Renders the real image once `src` is supplied, and until then draws a clearly
 * marked empty frame that holds the exact layout space, so adding the artwork
 * later cannot shift the section around it.
 */
export default function ImagePlaceholder({
  src,
  alt,
  aspect = 'aspect-video',
  label,
  hint,
  sizes = '(min-width: 1024px) 50vw, 92vw',
  className,
  tone = 'dark',
}: ImagePlaceholderProps) {
  const shell = `relative ${aspect} w-full overflow-hidden rounded-3xl ${className ?? ''}`;

  if (src) {
    return (
      <div className={shell}>
        <Image src={src} alt={alt ?? ''} fill sizes={sizes} className="object-cover" />
      </div>
    );
  }

  const isLight = tone === 'light';

  return (
    <div
      // Decorative until real content replaces it, so it is not announced.
      aria-hidden="true"
      className={`${shell} flex flex-col items-center justify-center gap-2 border-2 border-dashed ${
        isLight
          ? 'border-white/40 bg-white/10 text-white/80'
          : 'border-brand-blue-100 bg-brand-blue-50 text-brand-slate'
      }`}
    >
      <ImageIcon className="size-7" />
      <p className="px-4 text-center text-[13px] font-semibold">{label}</p>
      {hint && <p className="px-4 text-center text-[11px] opacity-80">{hint}</p>}
    </div>
  );
}
