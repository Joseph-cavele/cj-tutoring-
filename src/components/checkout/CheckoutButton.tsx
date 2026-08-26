'use client';

import { useState } from 'react';
import { Loader2, Lock } from 'lucide-react';

export default function CheckoutButton({ packageSlug }: { packageSlug: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ packageSlug }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.authorizationUrl) {
        setError(data.error ?? 'Could not start the payment. Please try again.');
        setBusy(false);
        return;
      }

      // Hand off to the hosted Paystack page: card details never touch this app.
      window.location.href = data.authorizationUrl;
    } catch {
      setError('No connection. Please check your network and try again.');
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={pay}
        disabled={busy}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-blue px-8 text-[15px] font-semibold text-white transition-colors hover:bg-brand-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue disabled:opacity-60"
      >
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Taking you to checkout
          </>
        ) : (
          <>
            <Lock className="size-4" aria-hidden="true" />
            Pay securely
          </>
        )}
      </button>

      {error && (
        <p role="alert" className="mt-3 text-[14px] font-semibold text-red-600">
          {error}
        </p>
      )}

      <p className="mt-3 text-center text-[13px] text-brand-slate">
        Payment is handled by Paystack. We never see your card details.
      </p>
    </div>
  );
}
