import { useState, useEffect, useRef, useCallback } from 'react';
import {
  PSpinner,
  PText,
  PButton,
  PInlineNotification,
  PIcon,
} from '@porsche-design-system/components-react';
import {
  spacingStaticSmall,
  spacingStaticMedium,
  spacingFluidSmall,
  borderRadiusLarge,
  borderRadiusMedium,
  motionDurationShort,
  motionEasingBase,
} from '@porsche-design-system/components-react/styles';
import type { PaymentSessionResponse } from '../types';

interface PaymentFormProps {
  bookingId: string;
  bookingType: 'rental' | 'tour';
  amount: number;
  customerName: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}

declare global {
  interface Window {
    epay: {
      setSessionId: (id: string) => Window['epay'];
      setSessionKey: (key: string) => Window['epay'];
      setCallbacks: (callbacks: Record<string, (...args: unknown[]) => unknown>) => Window['epay'];
      init: () => void;
      mountFields: (id: string, config: Record<string, unknown>) => void;
      clearFields: (id: string) => void;
      createCardTransaction: () => void;
    };
  }
}

type FormState = 'loading' | 'ready' | 'processing' | 'error' | 'expired';

const FIELDS_CONTAINER_ID = 'epay-hosted-fields';
const HOSTED_FIELDS_TIMEOUT = 6000;

function waitForEpay(maxWait = 5000): Promise<Window['epay']> {
  return new Promise((resolve, reject) => {
    if (window.epay) { resolve(window.epay); return; }
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.epay) { clearInterval(interval); resolve(window.epay); }
      else if (Date.now() - start > maxWait) { clearInterval(interval); reject(new Error('Payment system failed to load')); }
    }, 50);
  });
}

export function PaymentForm({
  bookingId, bookingType, amount, customerName, onSuccess, onError,
}: PaymentFormProps) {
  const [state, setState] = useState<FormState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [, setInputValid] = useState(false);
  const [paymentWindowUrl, setPaymentWindowUrl] = useState<string | null>(null);
  const [usePaymentWindow, setUsePaymentWindow] = useState(false);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const abortRef = useRef(false);
  const fieldsReadyRef = useRef(false);
  const fieldsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef(false);

  const cleanup = useCallback(() => {
    if (fieldsTimeoutRef.current) { clearTimeout(fieldsTimeoutRef.current); fieldsTimeoutRef.current = null; }
    if (scriptRef.current) { scriptRef.current.remove(); scriptRef.current = null; }
    pollingRef.current = false;
    delete (window as Partial<Window>).epay;
  }, []);

  const initPaymentSession = useCallback(async () => {
    setState('loading');
    setErrorMsg('');
    abortRef.current = false;
    fieldsReadyRef.current = false;

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/initialize-payment`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ booking_id: bookingId, booking_type: bookingType }),
      });

      if (abortRef.current) return;

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to start payment' }));
        throw new Error(err.error || 'Failed to initialize payment');
      }

      const data: PaymentSessionResponse = await res.json();
      setPaymentWindowUrl(data.paymentWindowUrl);

      cleanup();

      fieldsTimeoutRef.current = setTimeout(() => {
        if (!fieldsReadyRef.current && !abortRef.current) {
          setUsePaymentWindow(true);
          setState('ready');
        }
      }, HOSTED_FIELDS_TIMEOUT);

      const script = document.createElement('script');
      script.type = 'module';
      script.src = data.javascriptUrl;
      script.onerror = () => {
        if (!abortRef.current) {
          setUsePaymentWindow(true);
          setState('ready');
        }
      };
      document.head.appendChild(script);
      scriptRef.current = script;

      const epay = await waitForEpay();
      if (abortRef.current) return;

      setupEpayClient(epay, data);
    } catch (err) {
      if (abortRef.current) return;
      const msg = err instanceof Error ? err.message : 'Failed to initialize payment';
      setErrorMsg(msg);
      setState('error');
      onError(msg);
    }
  // onAuthorized intentionally excluded -- stable callback, avoids re-init loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, bookingType, onError, cleanup]);

  function setupEpayClient(epay: Window['epay'], session: PaymentSessionResponse) {
    epay
      .setSessionId(session.sessionId)
      .setSessionKey(session.sessionKey)
      .setCallbacks({
        clientReady: () => {
          fieldsReadyRef.current = true;
          if (fieldsTimeoutRef.current) { clearTimeout(fieldsTimeoutRef.current); fieldsTimeoutRef.current = null; }
          setState('ready');
        },
        invalidSession: () => {
          setErrorMsg('Payment session is invalid. Please try again.');
          setState('error');
        },
        transactionAccepted: () => {
          setState('processing');
          verifyPayment();
        },
        transactionDeclined: (data: unknown) => {
          const msg = (data as { message?: string })?.message || 'Your card was declined. Please try a different card.';
          setErrorMsg(msg);
          setState('ready');
          try { epay.clearFields(FIELDS_CONTAINER_ID); } catch { /* ignore */ }
        },
        invalidInput: () => { setInputValid(false); },
        inputValidity: (data: unknown) => {
          const validity = data as { valid?: boolean };
          setInputValid(validity?.valid === true);
        },
        sessionExpired: () => { setState('expired'); return false; },
        error: (data: unknown) => {
          const msg = (data as { message?: string })?.message || 'A payment error occurred';
          setErrorMsg(msg);
          setState('error');
        },
      })
      .init();

    epay.mountFields(FIELDS_CONTAINER_ID, {
      theme: 'default',
      language: 'en',
      fields: {
        name: { enabled: true, value: customerName },
        pan: { focus: true, showSupportedSchemes: true, showBrandSelector: true },
      },
      loader: { backgroundColor: 'transparent', borderStyle: 'none', height: '150px' },
      variables: {
        colorText: '#010205',
        borderRadius: '8px',
        borderColor: '#D8D8DB',
        fontFamily: "'Porsche Next','Arial Narrow',Arial,sans-serif",
        inputBorderColor: '#D8D8DB',
        inputFocusBorderColor: '#010205',
        inputBorderRadius: '8px',
        inputFontSize: '16px',
        inputPadding: '10px 12px',
        inputBackgroundColor: '#FFFFFF',
        inputPlaceholderColor: '#6B6D70',
        labelColor: '#010205',
        labelFontSize: '14px',
        labelFontWeight: '400',
        labelMarginBottom: '4px',
        gridRowSpacing: '12px',
        gridColumnSpacing: '12px',
        windowPadding: '0',
        windowBackgroundColor: 'transparent',
        windowBorderStyle: 'none',
        colorDanger: '#E50000',
        colorPrimary: '#010205',
      },
    });
  }

  async function verifyPayment() {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-payment-status`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };
      const body = JSON.stringify({ booking_id: bookingId, booking_type: bookingType });

      const res = await fetch(apiUrl, { method: 'POST', headers, body });
      if (res.ok) {
        const data = await res.json();
        if (data.payment_status === 'authorized' || data.payment_status === 'captured') { onSuccess(); return; }
      }

      await new Promise((r) => setTimeout(r, 2000));

      const res2 = await fetch(apiUrl, { method: 'POST', headers, body });
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2.payment_status === 'authorized' || data2.payment_status === 'captured') { onSuccess(); return; }
      }

      onSuccess();
    } catch {
      onSuccess();
    }
  }

  function startPolling() {
    if (pollingRef.current) return;
    pollingRef.current = true;

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-payment-status`;
    const headers = {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    };
    const body = JSON.stringify({ booking_id: bookingId, booking_type: bookingType });
    let attempts = 0;
    const maxAttempts = 60;

    const poll = async () => {
      if (abortRef.current || !pollingRef.current) return;
      attempts++;
      try {
        const res = await fetch(apiUrl, { method: 'POST', headers, body });
        if (res.ok) {
          const data = await res.json();
          if (data.payment_status === 'authorized' || data.payment_status === 'captured') { onSuccess(); return; }
          if (data.payment_status === 'failed') { setErrorMsg('Payment was declined. Please try again.'); setState('ready'); pollingRef.current = false; return; }
        }
      } catch { /* continue */ }

      if (attempts < maxAttempts) { setTimeout(poll, 3000); }
      else { setErrorMsg('Payment verification timed out. If you completed payment, your booking will be confirmed shortly.'); setState('error'); pollingRef.current = false; }
    };

    setTimeout(poll, 5000);
  }

  useEffect(() => {
    initPaymentSession();
    return () => { abortRef.current = true; cleanup(); };
  }, [initPaymentSession, cleanup]);

  function handlePay() {
    if (usePaymentWindow && paymentWindowUrl) {
      setState('processing');
      window.open(paymentWindowUrl, '_blank');
      startPolling();
      return;
    }
    if (!window.epay) return;
    setState('processing');
    window.epay.createCardTransaction();
  }

  const fieldsVisible = (state === 'ready' || state === 'processing') && !usePaymentWindow;

  if (state === 'expired') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacingStaticMedium, padding: spacingStaticMedium }}>
        <PIcon name="clock" size="medium" color="contrast-medium" />
        <PText color="contrast-medium">Your payment session has expired.</PText>
        <PButton variant="secondary" onClick={initPaymentSession}>Try Again</PButton>
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid var(--p-color-contrast-low)', borderRadius: borderRadiusLarge, overflow: 'hidden' }}>
      <div style={{ backgroundColor: 'var(--p-color-background-surface)', padding: `${spacingStaticSmall} ${spacingStaticMedium}`, display: 'flex', alignItems: 'center', gap: spacingStaticSmall }}>
        <PIcon name="lock" size="small" color="primary" />
        <PText size="small" weight="semi-bold">Secure Card Payment</PText>
      </div>

      <div style={{ padding: spacingStaticMedium }}>
        {state === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacingStaticMedium, padding: spacingStaticMedium }}>
            <PSpinner size="medium" aria={{ 'aria-label': 'Preparing payment form' }} />
            <PText size="small" color="contrast-medium">Preparing secure payment...</PText>
          </div>
        )}

        {state === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacingFluidSmall }}>
            <PInlineNotification state="error" heading="Payment Error" description={errorMsg} dismissButton={false} />
            <PButton variant="secondary" onClick={initPaymentSession}>Try Again</PButton>
          </div>
        )}

        {!usePaymentWindow && (
          <div
            id={FIELDS_CONTAINER_ID}
            style={{
              minHeight: fieldsVisible ? '180px' : '1px',
              opacity: fieldsVisible ? 1 : 0,
              pointerEvents: fieldsVisible ? 'auto' : 'none',
              transition: 'opacity 200ms ease',
            }}
          />
        )}

        {errorMsg && state === 'ready' && (
          <PInlineNotification state="error" description={errorMsg} dismissButton onDismiss={() => setErrorMsg('')} style={{ marginTop: spacingStaticSmall }} />
        )}

        {usePaymentWindow && state === 'ready' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacingStaticSmall }}>
            <PText size="small" color="contrast-medium">
              You will be taken to a secure payment page to complete your payment.
            </PText>
            <PButton onClick={handlePay} icon="external" style={{ width: '100%' }}>
              Pay {amount.toLocaleString()} DKK
            </PButton>
            <SecuredByLine />
          </div>
        )}

        {fieldsVisible && (
          <div style={{ marginTop: spacingStaticMedium }}>
            <PButton onClick={handlePay} loading={state === 'processing'} disabled={state === 'processing'} icon="lock" style={{ width: '100%' }}>
              {state === 'processing' ? 'Processing...' : `Pay ${amount.toLocaleString()} DKK`}
            </PButton>
            <SecuredByLine />
          </div>
        )}

        {usePaymentWindow && state === 'processing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacingStaticSmall, marginTop: spacingStaticMedium, padding: spacingStaticMedium, borderRadius: borderRadiusMedium, backgroundColor: 'var(--p-color-notification-info-soft)' }}>
            <PSpinner size="medium" aria={{ 'aria-label': 'Waiting for payment' }} />
            <PText size="small" weight="semi-bold">Waiting for payment...</PText>
            <PText size="x-small" color="contrast-medium">
              Complete the payment in the new window. This page will update automatically.
            </PText>
          </div>
        )}

        {!usePaymentWindow && state === 'processing' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacingStaticSmall, marginTop: spacingStaticMedium, padding: spacingStaticSmall, borderRadius: borderRadiusMedium, backgroundColor: 'var(--p-color-notification-info-soft)', transition: `opacity ${motionDurationShort} ${motionEasingBase}` }}>
            <PSpinner size="small" aria={{ 'aria-label': 'Verifying payment' }} />
            <PText size="small">Verifying your payment...</PText>
          </div>
        )}
      </div>
    </div>
  );
}

function SecuredByLine() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacingStaticSmall, marginTop: spacingStaticSmall }}>
      <PIcon name="lock" size="x-small" color="contrast-medium" />
      <PText size="x-small" color="contrast-medium">Secured by ePay. Your card details never touch our servers.</PText>
    </div>
  );
}
