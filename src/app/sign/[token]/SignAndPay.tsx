"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SignatureCanvas from "react-signature-canvas";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import {
  loadStripe,
  type Stripe,
  type StripeElements,
} from "@stripe/stripe-js";

interface Props {
  contractId: string;
  token: string;
  parentName: string;
  amountDueCents: number;
  stripePublishableKey: string;
  stripeClientSecret: string | null;
  initialError?: string | null;
  // e.g. "SAT Tutoring Services Agreement" or "ACT Tutoring Services Agreement"
  agreementTitle: string;
}

export const SIGNATURE_STORAGE_KEY = (token: string) => `studycore.sig.${token}`;

export default function SignAndPay(props: Props) {
  const stripePromise = useMemo<Promise<Stripe | null> | null>(() => {
    if (!props.stripePublishableKey) return null;
    return loadStripe(props.stripePublishableKey);
  }, [props.stripePublishableKey]);

  if (props.amountDueCents > 0 && props.stripeClientSecret && stripePromise) {
    return (
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret: props.stripeClientSecret,
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#1A3C6B",
              colorText: "#0f172a",
              borderRadius: "10px",
              fontFamily: "Inter, system-ui, sans-serif",
            },
          },
        }}
      >
        <PaymentBoundForm {...props} />
      </Elements>
    );
  }
  // No payment due (e.g. `contract_only` send mode, or already paid via
  // Stripe Checkout). Skip the Elements provider entirely — calling
  // useStripe / useElements outside an <Elements> tree throws.
  return <InnerForm {...props} stripe={null} elements={null} />;
}

// Thin shim that lives inside <Elements> so the Stripe hooks have a
// provider. Forwards the resolved stripe + elements down to InnerForm.
function PaymentBoundForm(props: Props) {
  const stripe = useStripe();
  const elements = useElements();
  return <InnerForm {...props} stripe={stripe} elements={elements} />;
}

function InnerForm(
  props: Props & {
    stripe: Stripe | null;
    elements: StripeElements | null;
  }
) {
  const router = useRouter();
  const { stripe, elements } = props;
  const sigRef = useRef<SignatureCanvas | null>(null);
  const [mounted, setMounted] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(props.initialError ?? null);

  useEffect(() => {
    setMounted(true);
    // If we returned here from a Stripe redirect with a non-success status, the
    // server passed us an error message. Strip the Stripe query params from the
    // URL so the address bar is clean and a refresh doesn't re-show the banner.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const stripeParams = [
        "payment_intent",
        "payment_intent_client_secret",
        "redirect_status",
        "source_redirect_slug",
      ];
      let dirty = false;
      for (const p of stripeParams) {
        if (url.searchParams.has(p)) {
          url.searchParams.delete(p);
          dirty = true;
        }
      }
      if (dirty) {
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
    }
  }, []);

  // Resize signature canvas to its parent (avoid blurry strokes on mobile)
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mounted) return;
    function resize() {
      if (!wrapRef.current || !sigRef.current) return;
      const canvas = sigRef.current.getCanvas();
      const ratio = window.devicePixelRatio || 1;
      const width = wrapRef.current.clientWidth;
      const height = 180;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.getContext("2d")?.scale(ratio, ratio);
      sigRef.current.clear();
      setHasSigned(false);
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [mounted]);

  function clearSignature() {
    sigRef.current?.clear();
    setHasSigned(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!hasSigned || !sigRef.current || sigRef.current.isEmpty()) {
      setError("Please sign in the box above before submitting.");
      return;
    }
    if (!agree) {
      setError("Please confirm you agree to the terms.");
      return;
    }

    setSubmitting(true);

    // Capture the signature data URL once now — for redirect-based payment
    // methods (Klarna, Affirm, etc.) the page will fully reload before we get
    // back here, so we stash it in sessionStorage to survive the round-trip.
    const signatureDataUrl = sigRef.current
      .getTrimmedCanvas()
      .toDataURL("image/png");

    try {
      if (props.amountDueCents > 0) {
        if (!stripe || !elements) {
          throw new Error("Payment is still loading. Please wait a moment and try again.");
        }
        const { error: submitError } = await elements.submit();
        if (submitError) throw submitError;

        // Save signature before triggering payment confirmation. Redirect
        // methods will navigate the browser away and come back to return_url.
        try {
          sessionStorage.setItem(SIGNATURE_STORAGE_KEY(props.token), signatureDataUrl);
        } catch {
          // sessionStorage can be unavailable in privacy modes; we'll just
          // fall back to the inline-confirm path below for non-redirect methods.
        }

        const returnUrl = `${window.location.origin}/sign/${props.token}`;
        const { error: payError, paymentIntent } = await stripe.confirmPayment({
          elements,
          redirect: "if_required",
          confirmParams: { return_url: returnUrl },
        });
        // If we get here, no redirect happened (typically a card payment).
        if (payError) throw payError;
        if (!paymentIntent || paymentIntent.status !== "succeeded") {
          throw new Error("Payment was not completed. Please try again.");
        }
      }

      // Submit signature to server, which verifies the PaymentIntent again,
      // renders & stores the PDF, and sends confirmation emails.
      const res = await fetch("/api/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: props.token,
          signature_data_url: signatureDataUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not finalize signing.");

      try {
        sessionStorage.removeItem(SIGNATURE_STORAGE_KEY(props.token));
      } catch {}

      router.replace("/welcome");
    } catch (err: any) {
      try {
        sessionStorage.removeItem(SIGNATURE_STORAGE_KEY(props.token));
      } catch {}
      setError(err?.message ?? "Payment was not completed. Please try again.");
      setSubmitting(false);
    }
  }

  const showPay = props.amountDueCents > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Signature panel */}
      <section className="border border-slate-300/80 bg-white">
        <div className="flex items-baseline justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="doc-eyebrow-accent">17</div>
            <h3 className="doc-h2 mt-1">Client Signature</h3>
          </div>
          <button
            type="button"
            onClick={clearSignature}
            className="doc-link-subtle"
          >
            Clear
          </button>
        </div>
        <div className="px-6 pb-6 pt-5">
          <p className="mb-4 font-serif text-[13px] text-slate-500">
            Sign as <span className="font-semibold text-slate-700">{props.parentName}</span>{" "}
            below. Use your finger or mouse to draw within the box.
          </p>
          <div
            ref={wrapRef}
            className="border border-slate-300 bg-[#fbfaf6]"
          >
            {mounted ? (
              <SignatureCanvas
                ref={(el) => {
                  sigRef.current = el;
                }}
                penColor="#0f172a"
                onEnd={() => setHasSigned(true)}
                canvasProps={{ className: "w-full h-[180px]" }}
              />
            ) : (
              <div className="h-[180px] w-full" />
            )}
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-slate-300 pt-3">
            <span className="font-serif text-[13px] italic text-slate-500">
              {props.parentName}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
              Parent / Guardian
            </span>
          </div>
        </div>
      </section>

      {showPay && (
        <section className="border border-slate-300/80 bg-white">
          <div className="flex items-baseline justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <div className="doc-eyebrow-accent">Payment</div>
              <h3 className="doc-h2 mt-1">Due at Signing</h3>
            </div>
            <span className="font-sans text-[18px] font-semibold tracking-tight text-navy">
              ${(props.amountDueCents / 100).toFixed(2)}
            </span>
          </div>
          <div className="px-6 py-6">
            {props.stripeClientSecret ? (
              <PaymentElement />
            ) : (
              <div className="border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
                Payment is currently unavailable. Please refresh and try again.
              </div>
            )}
            <p className="mt-4 font-serif text-[12px] text-slate-500">
              Processed securely by Stripe. Your card is only charged once you submit.
            </p>
          </div>
        </section>
      )}

      {/* Consent + submit */}
      <section className="border border-slate-300/80 bg-white px-6 py-5">
        <label className="flex items-start gap-3 font-serif text-[14px] leading-relaxed text-slate-700">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-[5px] h-4 w-4 flex-shrink-0 rounded-none border-slate-400 text-navy focus:ring-2 focus:ring-navy/30"
          />
          <span>
            I have read and agree to the StudyCore {props.agreementTitle} above,
            and I authorize StudyCore LLC to charge my payment method as described.
          </span>
        </label>

        {error && (
          <div className="mt-4 border-l-2 border-red-500 bg-red-50 px-4 py-3 font-serif text-[13px] text-red-800">
            {error}
          </div>
        )}

        <button type="submit" className="doc-btn-primary mt-5" disabled={submitting}>
          {submitting
            ? "Processing…"
            : showPay
            ? "Sign & Submit Payment"
            : "Sign Agreement"}
        </button>
        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
          Secured by Stripe &nbsp;·&nbsp; 256-bit SSL
        </p>
      </section>
    </form>
  );
}
