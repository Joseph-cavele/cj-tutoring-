'use client';

import { useEffect, useState } from 'react';

/**
 * True once the window has scrolled past `threshold` pixels.
 * Used to lift the header with a border and shadow away from the page.
 */
export function useScrolled(threshold = 8): boolean {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > threshold);

    // Run once so a page restored mid-scroll starts in the right state.
    onScroll();

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return isScrolled;
}
