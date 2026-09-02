/**
 * Money and mode, formatted for display, with no database driver attached.
 *
 * These used to live in `pricing.service.ts`, which opens a Mongoose
 * connection. A client component importing a formatter from there drags the
 * whole MongoDB driver into the browser bundle and fails the build
 * (CLAUDE.md section 33) - so the pure formatting lives here and the service
 * re-exports it, leaving one definition and one place to change it.
 */

/**
 * Rands, whole numbers. Intl puts a space after the symbol for en-ZA, which
 * reads oddly next to a large heading, so it is removed while keeping the
 * space as the thousands separator, as South African convention expects.
 */
export function formatPrice(amount: number, currency = 'ZAR'): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace(/^(\D+)\s/, '$1');
}

/** How a lesson is delivered, in words a parent would use. */
export function formatMode(mode: string): string {
  if (mode === 'in_person') return 'In person';
  if (mode === 'hybrid') return 'Online or in person';
  return 'Online';
}
