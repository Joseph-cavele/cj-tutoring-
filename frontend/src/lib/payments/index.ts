import { paystackGateway } from '@/lib/payments/paystack-gateway';
import { registerGateway } from '@/lib/payments/provider';

/**
 * Gateway registry entry point.
 *
 * Importing this module is what makes a provider available, so services import
 * from here rather than from `provider.ts` directly - otherwise the registry
 * would be empty and every payment would look unconfigured.
 */
registerGateway(paystackGateway);

export {
  getGateway,
  isPaymentConfigured,
  type CheckoutSession,
  type PaymentGateway,
  type VerifiedPayment,
} from '@/lib/payments/provider';
