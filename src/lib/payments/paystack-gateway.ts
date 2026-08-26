import {
  fromSubunits,
  initializeTransaction,
  isValidWebhookSignature,
  verifyTransaction,
} from '@/lib/payments/paystack';
import type { PaymentGateway } from '@/lib/payments/provider';

/**
 * Paystack, behind the gateway interface.
 *
 * All Paystack-specific knowledge - subunits, the `x-paystack-signature`
 * header, the `charge.success` event name - stops here. The booking and
 * payment services above never see any of it.
 */
export const paystackGateway: PaymentGateway = {
  name: 'paystack',

  isConfigured() {
    const key = process.env.PAYSTACK_SECRET_KEY;
    // Placeholder values from .env.example count as unconfigured, otherwise a
    // fresh checkout fails deep inside the API call instead of up front.
    return Boolean(key && !key.startsWith('your_'));
  },

  async createCheckout(params) {
    const result = await initializeTransaction({
      email: params.email,
      amountInRands: params.amount,
      reference: params.reference,
      callbackUrl: params.callbackUrl,
      metadata: params.metadata,
    });

    return { redirectUrl: result.authorizationUrl, reference: result.reference };
  },

  async verify(reference) {
    const result = await verifyTransaction(reference);

    return {
      reference: result.reference,
      status:
        result.status === 'success'
          ? 'successful'
          : result.status === 'failed' || result.status === 'abandoned'
            ? 'failed'
            : 'pending',
      amount: result.amountInRands,
      currency: 'ZAR',
      raw: result.raw,
    };
  },

  verifyWebhook(rawBody, headers) {
    try {
      return isValidWebhookSignature(rawBody, headers.get('x-paystack-signature'));
    } catch {
      // Secret missing: refuse rather than accept an unverified event.
      return false;
    }
  },

  parseWebhookEvent(rawBody) {
    let event: { event?: string; data?: { reference?: string; amount?: number } };

    try {
      event = JSON.parse(rawBody);
    } catch {
      return { reference: null, status: 'ignored', amount: 0, raw: null };
    }

    const reference = event.data?.reference ?? null;
    const amount = fromSubunits(event.data?.amount ?? 0);

    if (event.event === 'charge.success') {
      return { reference, status: 'successful', amount, raw: event.data };
    }

    if (event.event === 'charge.failed') {
      return { reference, status: 'failed', amount, raw: event.data };
    }

    return { reference, status: 'ignored', amount, raw: event.data };
  },
};
