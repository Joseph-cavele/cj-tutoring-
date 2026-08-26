/**
 * Header content for CJ Private Tutoring.
 *
 * Kept out of the component so the server half and the client half agree on
 * one list, and so copy changes never require touching markup.
 */

export const BRAND = {
  /** Full legal name - used for accessible names and metadata. */
  full: 'CJ Private Tutoring',
  /** Short wordmark - what actually fits in a 375px-wide header. */
  short: 'CJ Tutoring',
} as const;

export type NavLink = {
  label: string;
  href: string;
  /** Announced to screen readers in the mobile panel, where there is room. */
  description: string;
};

/**
 * Public marketing links. Grades and subjects follow CLAUDE.md section 4:
 * Mathematics grades 8-12, Physical Science grades 10-12.
 */
export const NAV_LINKS: readonly NavLink[] = [
  {
    label: 'Subjects',
    href: '/subjects',
    description: 'Mathematics and Physical Science, Grade 8 to 12',
  },
  {
    label: 'Pricing',
    href: '/pricing',
    description: 'Hourly rates, monthly packages and exam preparation',
  },
  {
    label: 'About',
    href: '/about',
    description: 'Who we are and how we teach',
  },
  {
    // Jumps to the Get In Touch section at the foot of the home page, so it
    // works from any route rather than only from the home page itself.
    label: 'Contact',
    href: '/#contact',
    description: 'Phone, email, WhatsApp and the enquiry form',
  },
] as const;

/**
 * Primary call to action. Points at the booking page: a first-time visitor
 * asks for a trial lesson before they have any reason to create an account.
 */
export const PRIMARY_CTA = { label: 'Book a Lesson', href: '/booking' } as const;

export const LOGIN_LINK = { label: 'Log In', href: '/login' } as const;

export const REGISTER_LINK = { label: 'Sign Up', href: '/register' } as const;

