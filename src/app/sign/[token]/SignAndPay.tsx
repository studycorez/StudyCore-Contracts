"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SignatureCanvas from "react-signature-canvas";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";

interface Props {
  contractId: string;
  token: string;
  parentName: string;
  amountDueCents: number;
  stripePublishableKey: string;
  stripeClientSecret: string | null;
  initialError?: string | null;
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
              colorTextSecondary: "#64748b",
              colorBackground: "#ffffff",
              borderRadius: "0px",
              fontFamily: "Inter, system-ui, sans-serif",
              fontSizeBase: "14px",
              spacingUnit: "4px",
            },
            rules: {
              ".Input": {
                border: "1px solid #cbd5e1",
                boxShadow: "none",
                padding: "10px 12px",
              },
              ".Input:focus": {
                border: "1px solid #1A3C6B",
                boxShadow: "0 0 0 2px rgba(26,60,107,0.15)",
              },
              ".Label": {
                fontSize: "11px",
                fontWeight: "600",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#64748b",
              },
              ".Tab": {
                border: "1px solid #cbd5e1",
                boxShadow: "none",
              },
              ".Tab--selected": {
                border: "1px solid #1A3C6B",
                boxShadow: "none",
              },
            },
          },
        }}
      >
        <InnerForm {...props} />
      </Elements>
    );
  }
  return <InnerForm {...props} />;
}

function InnerForm(props: Props) {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
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
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Signature panel */}
      <section className="doc-pane">
        <div className="flex items-center justify-between border-b border-slate-200 px-7 py-5">
          <div className="flex items-baseline gap-3">
            <span className="doc-section-num">§ 17</span>
            <h3 className="doc-h2">Client Signature</h3>
          </div>
          <button
            type="button"
            onClick={clearSignature}
            className="doc-link-subtle"
          >
            Clear
          </button>
        </div>
        <div className="px-7 pb-7 pt-6">
          <p className="mb-5 font-serif text-[13.5px] leading-[1.6] text-slate-500">
            Sign as{" "}
            <span className="font-semibold text-slate-700">{props.parentName}</span>{" "}
            below. Draw within the box using your finger, stylus, or mouse.
          </p>
          <div
            ref={wrapRef}
            className="border border-slate-300 bg-[#fcfbf7]"
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
          <div className="mt-4 flex items-baseline justify-between border-t border-slate-200 pt-3">
            <span className="font-serif text-[13px] italic text-slate-500">
              x &nbsp; {props.parentName}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
              Parent / Guardian
            </span>
          </div>
        </div>
      </section>

      {showPay && (
        <section className="doc-pane">
          <div className="flex items-center justify-between border-b border-slate-200 px-7 py-5">
            <div className="flex items-baseline gap-3">
              <span className="doc-section-num">§ 18</span>
              <h3 className="doc-h2">Payment Due at Signing</h3>
            </div>
            <span className="font-serif text-[18px] font-semibold tracking-[-0.01em] text-navy">
              ${(props.amountDueCents / 100).toFixed(2)}
            </span>
          </div>
          <div className="px-7 py-7">
            {props.stripeClientSecret ? (
              <PaymentElement />
            ) : (
              <div className="border-l-2 border-amber-500 bg-amber-50 px-4 py-3 font-serif text-[13px] text-amber-800">
                Payment is currently unavailable. Please refresh and try again.
              </div>
            )}
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Processed securely by Stripe &middot; Card is charged on submit
            </p>
          </div>
        </section>
      )}

      {/* Consent + submit */}
      <section className="doc-pane px-7 py-6">
        <label className="flex items-start gap-3 font-serif text-[14px] leading-[1.65] text-slate-700">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="doc-input-checkbox"
          />
          <span>
            I have read and agree to the StudyCore SAT Tutoring Services Agreement
            above, and I authorize StudyCore LLC to charge my payment method as
            described.
          </span>
        </label>

        {error && (
          <div className="mt-5 border-l-2 border-red-500 bg-red-50 px-4 py-3 font-serif text-[13px] leading-[1.6] text-red-800">
            {error}
          </div>
        )}

        <button type="submit" className="doc-btn-primary mt-6" disabled={submitting}>
          {submitting
            ? "Processing…"
            : showPay
            ? "Sign & Submit Payment"
            : "Sign Agreement"}
        </button>
        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
          Secured by Stripe &nbsp;·&nbsp; 256-bit SSL
        </p>
      </section>
    </form>
  );
}
