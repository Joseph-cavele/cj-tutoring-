import type { PaymentProvider } from '@/models/types';

/**
 * The gateway abstraction.
 *
 * Booking logic must not know which provider is in use, so it talks to this
 * interface and never imports Paystack directly. Adding PayPal later means
 * adding an adapter here, not touching the booking service
 * (brief section 1, "payment-service abstraction").
 *
 * Server-only: every implementation reads a secret key, so nothing in this
 * folder may be imported from a client component.
 */

export type CheckoutSession = {
  /** Where to send the payer to complete the payment. */
  redirectUrl: string;
  /** Our own reference, which the webhook echoes back. */
  reference: string;
};

export type VerifiedPayment = {
  reference: string;
  /** Provider's own view of the outcome, already normalised. */
  status: 'successful' | 'failed' | 'pending';
  /** In major units (Rand), never subunits. */
  amount: number;
  currency: string;
  raw: unknown;
};

export interface PaymentGateway {
  readonly name: PaymentProvider;
  /** True when the keys needed to charge are actually present. */
  isConfigured(): boolean;
  createCheckout(params: {
    email: string;
    amount: number;
    currency: string;
    reference: string;
    callbackUrl: string;
    metadata?: Record<string, unknown>;
  }): Promise<CheckoutSession>;
  /** Server-to-server confirmation. The browser's word is never enough. */
  verify(reference: string): Promise<VerifiedPayment>;
  /** Confirms a webhook really came from the provider. */
  verifyWebhook(rawBody: string, headers: Headers): boolean;
  /** Pulls the reference and outcome out of a provider-shaped event. */
  parseWebhookEvent(rawBody: string): {
    reference: string | null;
    status: 'successful' | 'failed' | 'pending' | 'ignored';
    amount: number;
    raw: unknown;
  };
}

/** Registered gateways, in the order they are preferred. */
const gateways: PaymentGateway[] = [];

export function registerGateway(gateway: PaymentGateway) {
  if (!gateways.some((existing) => existing.name === gateway.name)) {
    gateways.push(gateway);
  }
}

export function getGateway(name?: PaymentProvider): PaymentGateway | null {
  if (name) {
    return gateways.find((gateway) => gateway.name === name) ?? null;
  }

  return gateways.find((gateway) => gateway.isConfigured()) ?? null;
}

/**
 * Whether the platform can take money at all.
 *
 * When it cannot, bookings are created as `not_required` rather than being
 * marked paid: an unconfigured gateway must never look like a settled payment.
 */
export function isPaymentConfigured(): boolean {
  return gateways.some((gateway) => gateway.isConfigured());
}
