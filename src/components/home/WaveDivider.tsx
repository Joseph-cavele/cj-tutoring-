type WaveDividerProps = {
  /** Colour the wave rises out of. */
  from: 'cream' | 'blue';
  className?: string;
};

/**
 * Design.md section 3: section transitions use two or three overlapping wave
 * paths in tints of blue, giving a sense of water depth.
 *
 * `from="cream"` flows the cream page down into the deep blue section;
 * `from="blue"` brings it back up again.
 */
export default function WaveDivider({ from, className }: WaveDividerProps) {
  const isFromCream = from === 'cream';

  return (
    <div
      aria-hidden="true"
      className={`${isFromCream ? 'bg-brand-cream' : 'bg-brand-blue'} ${className ?? ''}`}
    >
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        // Shorter on phones so the divider does not eat the viewport (section 9).
        className={`block h-12 w-full sm:h-20 lg:h-28 ${isFromCream ? '' : 'rotate-180'}`}
      >
        {/* Back layer, palest. */}
        <path
          d="M0 44c180 40 320 44 520 22s360-52 560-30 260 46 360 40v44H0Z"
          className="fill-brand-blue/40"
        />
        {/* Middle layer. */}
        <path
          d="M0 62c200 36 340 30 540 6s380-42 560-18 260 40 340 36v34H0Z"
          className="fill-brand-blue/70"
        />
        {/* Front layer, solid: this one meets the section below. */}
        <path
          d="M0 82c220 30 360 22 560 0s360-30 540-8 260 30 340 28v18H0Z"
          className="fill-brand-blue"
        />
      </svg>
    </div>
  );
}
