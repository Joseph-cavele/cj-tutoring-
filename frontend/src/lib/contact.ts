/**
 * Contact details for CJ Private Tutoring.
 *
 * Single source: the footer, contact page, transactional emails and WhatsApp
 * templates all read from here, so a number only ever changes in one place.
 */
export const CONTACT = {
  email: 'support@cjprivatetutoring.co.za',

  phone: {
    /** How it reads on the page, in the usual South African grouping. */
    display: '071 083 6571',
    /** tel: links need E.164, so the local leading 0 becomes +27. */
    e164: '+27710836571',
    /** wa.me takes the same digits with no plus. */
    whatsapp: '27710836571',
  },
} as const;

export const mailtoHref = `mailto:${CONTACT.email}`;
export const telHref = `tel:${CONTACT.phone.e164}`;
export const whatsappHref = `https://wa.me/${CONTACT.phone.whatsapp}`;
