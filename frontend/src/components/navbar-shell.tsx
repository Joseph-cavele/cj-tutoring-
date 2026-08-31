'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Bell, GraduationCap, Menu, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useScrolled } from '@/hooks/use-scrolled';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  BRAND,
  LOGIN_LINK,
  NAV_LINKS,
  PRIMARY_CTA,
  REGISTER_LINK,
} from '@/components/nav-config';
import LogoutButton from '@/components/LogoutButton';

export type NavbarShellProps = {
  /** Resolved on the server from the session cookie. */
  isSignedIn: boolean;
  /** Unread notifications, counted on the server. Zero when signed out. */
  unreadCount: number;
};

/**
 * Header chrome for CJ Private Tutoring.
 *
 * Design.md section 7: logo left, links centre, one primary CTA right.
 * Design.md section 6: pill buttons, one primary per region, so when a primary
 * CTA is present Log In takes the secondary treatment.
 *
 * Auth state arrives as props rather than being read here, so the session
 * lookup stays on the server and this file ships no session logic.
 */
export function NavbarShell({ isSignedIn, unreadCount }: NavbarShellProps) {
  const pathname = usePathname();
  const isScrolled = useScrolled();
  const [isOpen, setIsOpen] = useState(false);

  // Exact match or a descendant, so /subjects/mathematics still marks Subjects.
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const closePanel = () => setIsOpen(false);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 bg-brand-cream/90 backdrop-blur-sm transition-shadow duration-200',
        // Lift the header away from the cream page only once it overlaps content.
        isScrolled && 'border-b border-brand-blue-100 shadow-[var(--shadow-soft)]'
      )}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:h-20 sm:px-6 lg:px-8"
      >
        <BrandMark />

        {/* Centre rail from md. The four links alone are about 300px, which a
            768px header carries comfortably once the auth buttons stay in the
            sheet; the gap opens back up at lg, where the whole row fits. */}
        <ul className="hidden min-w-0 flex-1 items-center justify-center gap-5 md:flex lg:gap-8">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={cn(
                  'rounded-sm text-[15px] font-medium transition-colors hover:text-brand-blue',
                  'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue',
                  isActive(link.href) ? 'text-brand-blue' : 'text-brand-navy'
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2 min-[940px]:ml-0">
          {isSignedIn ? (
            // No dashboard shortcut in the public header. The dashboard is
            // reached by signing in, never by a link sitting on every page.
            // The bell is the exception: it is how somebody finds out a lesson
            // was confirmed without opening their email.
            <>
              <Link
                href="/notifications"
                aria-label={
                  unreadCount > 0
                    ? `Notifications, ${unreadCount} unread`
                    : 'Notifications'
                }
                className="relative inline-flex size-11 items-center justify-center rounded-full text-brand-navy transition-colors hover:bg-brand-blue-50"
              >
                <Bell className="size-5" aria-hidden="true" />
                {unreadCount > 0 ? (
                  <span className="absolute top-1.5 right-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-brand-amber px-1 text-[10px] font-bold text-brand-navy">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                ) : null}
              </Link>
              <LogoutButton className="hidden sm:inline-flex" />
            </>
          ) : (
            <>
              {/* 940px, not a named breakpoint, because that is where the whole
                  row actually fits: brand, four links, these two and the CTA
                  measure about 880px, so md would overflow and lg would leave a
                  laptop at 975px looking at a hamburger with half the bar
                  empty. The trigger below hides at the same width, so the menu
                  disappears exactly when the last thing it held reaches the bar.
                  Log In is a plain link rather than a third pill, so the row
                  does not present three competing buttons. */}
              <Link
                href={LOGIN_LINK.href}
                className="hidden min-h-11 items-center px-2 text-[15px] font-medium text-brand-navy transition-colors hover:text-brand-blue focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue min-[940px]:inline-flex"
              >
                {LOGIN_LINK.label}
              </Link>
              <SecondaryLink href={REGISTER_LINK.href} className="hidden min-[940px]:inline-flex">
                {REGISTER_LINK.label}
              </SecondaryLink>
              <PrimaryLink href={PRIMARY_CTA.href} className="hidden sm:inline-flex">
                {PRIMARY_CTA.label}
              </PrimaryLink>
            </>
          )}

          {/* Base UI Dialog underneath: focus trap, scroll lock and Escape come
              from the primitive, so none of that is reimplemented here. */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger
              aria-label="Open menu"
              className="inline-flex size-11 items-center justify-center rounded-full text-brand-navy transition-colors hover:bg-brand-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue min-[940px]:hidden"
            >
              <Menu className="size-6" aria-hidden="true" />
            </SheetTrigger>

            <SheetContent
              side="right"
              showCloseButton={false}
              // The data-side prefix is load-bearing. SheetContent sets its own
              // three-quarter width behind that same attribute selector, so an
              // unprefixed width here would lose on specificity and would not be
              // deduped by tailwind-merge either. Matching the prefix wins both.
              className="data-[side=right]:w-[88vw] gap-0 border-l border-brand-blue-100 bg-brand-cream p-0 sm:max-w-sm"
            >
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-brand-blue-100 px-4">
                <SheetTitle className="font-sans text-base font-bold text-brand-navy">
                  Menu
                </SheetTitle>
                {/* Own close control: the primitive default is 28px, under the
                    44px minimum tap target in Design.md section 9. */}
                <SheetClose
                  aria-label="Close menu"
                  className="inline-flex size-11 items-center justify-center rounded-full text-brand-navy transition-colors hover:bg-brand-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
                >
                  <X className="size-6" aria-hidden="true" />
                </SheetClose>
              </div>

              <ul className="flex flex-col gap-1 overflow-y-auto p-4">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={closePanel}
                      aria-current={isActive(link.href) ? 'page' : undefined}
                      className={cn(
                        'block rounded-2xl px-4 py-3 transition-colors hover:bg-brand-blue-50',
                        isActive(link.href) && 'bg-brand-blue-50'
                      )}
                    >
                      <span
                        className={cn(
                          'block text-base font-semibold',
                          isActive(link.href) ? 'text-brand-blue' : 'text-brand-navy'
                        )}
                      >
                        {link.label}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-brand-slate">
                        {link.description}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-auto flex shrink-0 flex-col gap-3 border-t border-brand-blue-100 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                {isSignedIn ? (
                  <LogoutButton block onDone={closePanel} />
                ) : (
                  <>
                    <PrimaryLink href={PRIMARY_CTA.href} onClick={closePanel} block>
                      {PRIMARY_CTA.label}
                    </PrimaryLink>
                    <SecondaryLink href={REGISTER_LINK.href} onClick={closePanel} block>
                      {REGISTER_LINK.label}
                    </SecondaryLink>
                    <SecondaryLink href={LOGIN_LINK.href} onClick={closePanel} block>
                      {LOGIN_LINK.label}
                    </SecondaryLink>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}

/**
 * Logo lockup. The amber disc stands in for the octopus mascot in Design.md
 * section 5, so swap the icon for the artwork once that asset exists.
 */
function BrandMark() {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-2.5 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue"
    >
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-full bg-brand-amber text-brand-navy"
      >
        <GraduationCap className="size-6" strokeWidth={2.5} />
      </span>
      <span className="text-xl font-extrabold tracking-tight text-brand-blue sm:text-2xl">
        {BRAND.short}
      </span>
      {/* The header shows the short wordmark; assistive tech gets the full name. */}
      <span className="sr-only">{BRAND.full} home</span>
    </Link>
  );
}

type ActionLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  /** Full width inside the mobile panel. */
  block?: boolean;
};

/** Design.md section 6: solid blue, white text, pill radius, trailing arrow. */
function PrimaryLink({ href, children, className, onClick, block }: ActionLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'items-center gap-2 rounded-full bg-brand-blue px-6 text-[15px] font-semibold text-white transition-colors',
        // A pill is a fixed-height shape: let the label wrap and it breaks out
        // of min-h-11 instead of staying a button.
        'shrink-0 whitespace-nowrap',
        'hover:bg-brand-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue',
        // 44px minimum tap target, Design.md section 9.
        'min-h-11',
        block ? 'flex justify-center' : 'inline-flex',
        className
      )}
    >
      {children}
      <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
    </Link>
  );
}

/** Design.md section 6: transparent fill, 1.5px blue border, blue text, pill. */
function SecondaryLink({ href, children, className, onClick, block }: ActionLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'items-center justify-center gap-2 rounded-full border-[1.5px] border-brand-blue px-6 text-[15px] font-semibold text-brand-blue transition-colors',
        'shrink-0 whitespace-nowrap',
        'hover:bg-brand-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue',
        'min-h-11',
        block ? 'flex' : 'inline-flex',
        className
      )}
    >
      {children}
    </Link>
  );
}
