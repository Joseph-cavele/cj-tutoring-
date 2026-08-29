import { appUrl, escapeHtml, formatMoney, renderEmail } from '../templates';

/**
 * Transactional emails carry names, notes and subjects that a customer typed,
 * so the escaping is the part worth pinning: a booking note containing markup
 * must never reach an inbox as markup.
 */

describe('escapeHtml', () => {
  it('neutralises tags, quotes and ampersands', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    );
    expect(escapeHtml("Tom & Jerry's")).toBe('Tom &amp; Jerry&#39;s');
  });
});

describe('renderEmail', () => {
  const content = {
    heading: 'We have your lesson request',
    greeting: 'Hi Thabo,',
    intro: ['Here are the details of the lesson you requested.'],
    details: [
      { label: 'Subject', value: 'Mathematics' },
      { label: 'Tutor', value: 'Ms <b>Nkosi</b>' },
    ],
    cta: { label: 'View your bookings', url: 'https://example.com/student/dashboard' },
    outro: ['We will email you again once your tutor accepts.'],
  };

  it('renders every part into the plain-text body', () => {
    const { text } = renderEmail(content);

    expect(text).toContain('Hi Thabo,');
    expect(text).toContain('We have your lesson request');
    expect(text).toContain('Mathematics');
    expect(text).toContain('View your bookings: https://example.com/student/dashboard');
    expect(text).toContain('We will email you again once your tutor accepts.');
    // The signature every email ends with.
    expect(text).toContain('CJ Private Tutoring');
  });

  it('escapes caller-supplied values in the HTML body', () => {
    const { html } = renderEmail(content);

    expect(html).not.toContain('<b>Nkosi</b>');
    expect(html).toContain('Ms &lt;b&gt;Nkosi&lt;/b&gt;');
  });

  it('omits the button when there is no call to action', () => {
    const { html } = renderEmail({ heading: 'Payment received' });

    expect(html).not.toContain('<a href="https://');
    expect(html).toContain('Payment received');
  });
});

describe('appUrl', () => {
  const original = process.env.NEXTAUTH_URL;

  afterEach(() => {
    process.env.NEXTAUTH_URL = original;
  });

  it('prefers the request origin and drops a trailing slash', () => {
    expect(appUrl('https://cj.example.com/')).toBe('https://cj.example.com');
  });

  it('falls back to the configured site URL', () => {
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
    expect(appUrl()).toBe('http://localhost:3000');
  });

  it('returns an empty string when nothing is configured, so links are dropped', () => {
    delete process.env.NEXTAUTH_URL;
    expect(appUrl()).toBe('');
  });
});

describe('formatMoney', () => {
  it('falls back to a plain amount for an unknown currency code', () => {
    expect(formatMoney(450, 'XYZ')).toContain('450');
  });
});
