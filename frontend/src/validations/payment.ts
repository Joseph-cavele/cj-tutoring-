import { z } from 'zod';

/**
 * Only the package is accepted from the browser. The amount is looked up
 * server-side (CLAUDE.md section 19: never trust frontend payment input).
 */
export const checkoutSchema = z.object({
  packageSlug: z.string().trim().min(1, 'Choose a package').max(80),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
