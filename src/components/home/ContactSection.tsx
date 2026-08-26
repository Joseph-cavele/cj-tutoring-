import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';

import { CONTACT, mailtoHref, telHref, whatsappHref } from '@/lib/contact';
import ContactForm from './ContactForm';

/**
 * Get In Touch, following the reference layout: centred heading, then a card
 * split between a filled contact panel and the form.
 *
 * Server component; only the form itself is interactive.
 */
export default function ContactSection() {
  return (
    // scroll-mt clears the sticky header when the nav Contact link jumps here.
    <section id="contact" className="scroll-mt-24 bg-brand-cream pb-16 lg:pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
            Get In Touch
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-brand-slate sm:text-[17px]">
            Tell us the grade and subject, and what your child is finding
            difficult. We will come back to you with a plan and a starting point.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-soft)] lg:mt-14">
          <div className="grid lg:grid-cols-[minmax(0,22rem)_1fr]">
            {/* Filled information panel */}
            <div className="relative isolate overflow-hidden bg-brand-blue p-6 text-white sm:p-8 lg:p-10">
              {/* Soft circle, echoing the reference panel. */}
              <div
                aria-hidden="true"
                className="absolute -right-16 -bottom-20 -z-10 size-56 rounded-full bg-white/10"
              />

              <h3 className="text-xl font-bold sm:text-2xl">Contact Information</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-white/70">
                Reach us directly if you would rather talk it through.
              </p>

              <ul className="mt-8 space-y-6">
                <li>
                  <a
                    href={telHref}
                    className="flex items-start gap-4 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  >
                    <IconTile>
                      <Phone className="size-4" />
                    </IconTile>
                    <span>
                      <span className="block text-[12px] tracking-wide text-white/60 uppercase">
                        Phone
                      </span>
                      <span className="text-[15px] text-white/90">
                        {CONTACT.phone.display}
                      </span>
                    </span>
                  </a>
                </li>

                <li>
                  <a
                    href={mailtoHref}
                    className="flex items-start gap-4 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  >
                    <IconTile>
                      <Mail className="size-4" />
                    </IconTile>
                    <span className="min-w-0">
                      <span className="block text-[12px] tracking-wide text-white/60 uppercase">
                        Email
                      </span>
                      <span className="block text-[15px] break-all text-white/90">
                        {CONTACT.email}
                      </span>
                    </span>
                  </a>
                </li>

                <li>
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-4 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  >
                    <IconTile>
                      <MessageCircle className="size-4" />
                    </IconTile>
                    <span>
                      <span className="block text-[12px] tracking-wide text-white/60 uppercase">
                        WhatsApp
                      </span>
                      <span className="text-[15px] text-white/90">
                        Message us
                        <span className="sr-only"> (opens in a new tab)</span>
                      </span>
                    </span>
                  </a>
                </li>

                <li className="flex items-start gap-4">
                  <IconTile>
                    <MapPin className="size-4" />
                  </IconTile>
                  <span>
                    <span className="block text-[12px] tracking-wide text-white/60 uppercase">
                      Where we teach
                    </span>
                    {/* Replace with the centre address once there is one to publish. */}
                    <span className="text-[15px] text-white/90">
                      Online across South Africa, in person by arrangement
                    </span>
                  </span>
                </li>
              </ul>
            </div>

            {/* Form */}
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-brand-amber"
    >
      {children}
    </span>
  );
}
