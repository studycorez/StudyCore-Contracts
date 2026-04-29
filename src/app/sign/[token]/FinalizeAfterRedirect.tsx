"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SIGNATURE_STORAGE_KEY } from "./SignAndPay";

export default function FinalizeAfterRedirect({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    // Strip the Stripe redirect query params from the address bar immediately,
    // before we do anything else. This keeps payment_intent and
    // payment_intent_client_secret out of the URL while the "finalizing" UI
    // shows, and avoids re-triggering the redirect-finalize flow on refresh.
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

    (async () => {
      let signatureDataUrl: string | null = null;
      try {
        signatureDataUrl = sessionStorage.getItem(SIGNATURE_STORAGE_KEY(token));
      } catch {
        signatureDataUrl = null;
      }

      if (!signatureDataUrl) {
        setError(
          "We received your payment but couldn't find the signature in this browser. Please re-open the contract from your email on the same device to finish signing — or contact support@studycore.net."
        );
        return;
      }

      try {
        const res = await fetch("/api/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, signature_data_url: signatureDataUrl }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Could not finalize signing. Please contact support.");
          return;
        }
      } catch {
        setError(
          "We couldn't reach the server to finalize signing. Please try again or contact support."
        );
        return;
      }

      try {
        sessionStorage.removeItem(SIGNATURE_STORAGE_KEY(token));
      } catch {}

      // router.replace navigates to /welcome and replaces history, so the
      // payment_intent / payment_intent_client_secret / redirect_status query
      // params are not visible in the address bar.
      router.replace("/welcome");
    })();
  }, [router, token]);

  if (error) {
    return (
      <div className="border border-slate-200 bg-white px-7 py-8">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-red-600">
          Couldn&apos;t finalize
        </div>
        <p className="mt-4 text-[14.5px] leading-[1.7] text-slate-700">{error}</p>
        <a href={`/sign/${token}`} className="doc-btn-secondary mt-7">
          Back to contract
        </a>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 bg-white px-7 py-14 text-center">
      <div className="mx-auto mb-6 h-7 w-7 animate-spin rounded-full border-[1.5px] border-slate-300 border-t-navy" />
      <div className="text-[16px] font-semibold tracking-[-0.01em] text-navy">
        Finalizing your enrollment…
      </div>
      <p className="mt-2 text-[13.5px] leading-[1.6] text-slate-500">
        Confirming your payment and saving your signed agreement.
      </p>
    </div>
  );
}
