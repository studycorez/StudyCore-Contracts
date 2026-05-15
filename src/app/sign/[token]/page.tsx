import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { buildContractClauses } from "@/lib/contract-text";
import { formatDate, formatMoney } from "@/lib/format";
import type { Contract } from "@/lib/types";
import StudyCoreLogo from "@/components/StudyCoreLogo";
import SignAndPay from "./SignAndPay";
import FinalizeAfterRedirect from "./FinalizeAfterRedirect";

export const dynamic = "force-dynamic";

function redirectErrorFor(status: string | undefined): string | null {
  if (!status || status === "succeeded") return null;
  if (status === "processing") {
    return "Your payment is still processing. We'll email you once it confirms — you don't need to do anything else right now.";
  }
  if (status === "requires_payment_method" || status === "failed") {
    return "Payment was not completed. Please try again or use a different payment method.";
  }
  if (status === "requires_action" || status === "canceled") {
    return "Payment was not completed. Please try again.";
  }
  return "Payment was not completed. Please try again.";
}

// Inline-italic parser. Splits paragraph text on `*` markers and wraps the
// odd-indexed segments in <em>. Used for sub-headings inside clauses
// (e.g. "*Eligibility.* To qualify…").
function renderInlineItalic(text: string): React.ReactNode[] {
  const parts = text.split("*");
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <em key={i} className="italic">
        {part}
      </em>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default async function SignPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: {
    payment_intent?: string;
    payment_intent_client_secret?: string;
    redirect_status?: string;
    checkout?: string;
  };
}) {
  const admin = createAdminClient();
  const { data: contract } = await admin
    .from("contracts")
    .select("*")
    .eq("signing_token", params.token)
    .single();

  if (!contract) notFound();

  // Mark as viewed if first view
  if (contract.status === "sent") {
    await admin
      .from("contracts")
      .update({ status: "viewed" })
      .eq("id", contract.id);
    contract.status = "viewed";
  }

  const isComplete = contract.status === "completed" || contract.status === "signed";
  let dueAtSigningCents = Math.round(Number(contract.amount_due_at_signing) * 100);

  // If a separate Stripe Checkout was used (closer chose "payment first" or
  // "both"), the PI may already be paid before the parent ever opens the
  // signing UI. Detect that, mark the contract paid, and skip the in-page
  // payment block — they only need to sign.
  let alreadyPaidViaCheckout = false;
  if (
    !isComplete &&
    dueAtSigningCents > 0 &&
    contract.stripe_checkout_session_id &&
    !contract.paid_at
  ) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(
        contract.stripe_checkout_session_id
      );
      if (session.payment_status === "paid") {
        alreadyPaidViaCheckout = true;
        await admin
          .from("contracts")
          .update({ paid_at: new Date().toISOString() })
          .eq("id", contract.id);
        contract.paid_at = new Date().toISOString();
      }
    } catch {
      // ignore — fall through to standard payment UI
    }
  } else if (
    !isComplete &&
    dueAtSigningCents > 0 &&
    contract.paid_at
  ) {
    alreadyPaidViaCheckout = true;
  }

  if (alreadyPaidViaCheckout) {
    dueAtSigningCents = 0;
  }

  // The parent has just been redirected back to us from a Stripe redirect-based
  // payment method (Klarna, Affirm, etc.). The query params tell us how it
  // went. We re-verify the payment status server-side before honoring it.
  const returnedFromRedirect = !!searchParams.payment_intent && !!searchParams.redirect_status;
  let verifiedRedirectSucceeded = false;
  let redirectError: string | null = null;

  if (returnedFromRedirect && !isComplete) {
    if (searchParams.redirect_status === "succeeded") {
      try {
        const stripe = getStripe();
        const pi = await stripe.paymentIntents.retrieve(searchParams.payment_intent!);
        if (
          pi.status === "succeeded" &&
          pi.metadata?.contract_id === contract.id
        ) {
          verifiedRedirectSucceeded = true;
        } else {
          redirectError =
            "Payment did not confirm. Please try again or use a different payment method.";
        }
      } catch {
        redirectError =
          "We couldn't verify your payment. Please try again or contact support@studycore.net.";
      }
    } else {
      redirectError = redirectErrorFor(searchParams.redirect_status);
    }
  }

  // Set up Stripe payment intent if we have an amount due and not yet paid.
  // Skip when we already verified a successful redirect — we're about to
  // render the finalizing UI and would otherwise create a stray fresh PI
  // (since the existing PI is already in a `succeeded` state).
  let clientSecret: string | null = null;
  if (!isComplete && !verifiedRedirectSucceeded && dueAtSigningCents > 0) {
    const stripe = getStripe();
    if (contract.stripe_payment_intent_id) {
      try {
        const existing = await stripe.paymentIntents.retrieve(
          contract.stripe_payment_intent_id
        );
        if (
          existing.amount === dueAtSigningCents &&
          existing.status !== "succeeded" &&
          existing.status !== "canceled"
        ) {
          clientSecret = existing.client_secret;
        } else {
          const fresh = await stripe.paymentIntents.create({
            amount: dueAtSigningCents,
            currency: "usd",
            automatic_payment_methods: { enabled: true },
            description: `StudyCore SAT Agreement — ${contract.student_name}`,
            receipt_email: contract.parent_email,
            metadata: { contract_id: contract.id },
          });
          await admin
            .from("contracts")
            .update({ stripe_payment_intent_id: fresh.id })
            .eq("id", contract.id);
          clientSecret = fresh.client_secret;
        }
      } catch {
        const fresh = await stripe.paymentIntents.create({
          amount: dueAtSigningCents,
          currency: "usd",
          automatic_payment_methods: { enabled: true },
          description: `StudyCore SAT Agreement — ${contract.student_name}`,
          receipt_email: contract.parent_email,
          metadata: { contract_id: contract.id },
        });
        await admin
          .from("contracts")
          .update({ stripe_payment_intent_id: fresh.id })
          .eq("id", contract.id);
        clientSecret = fresh.client_secret;
      }
    } else {
      const created = await stripe.paymentIntents.create({
        amount: dueAtSigningCents,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        description: `StudyCore SAT Agreement — ${contract.student_name}`,
        receipt_email: contract.parent_email,
        metadata: { contract_id: contract.id },
      });
      await admin
        .from("contracts")
        .update({ stripe_payment_intent_id: created.id })
        .eq("id", contract.id);
      clientSecret = created.client_secret;
    }
  }

  const clauses = buildContractClauses(contract as Contract);

  if (isComplete) {
    return (
      <main className="doc-shell">
        <DocHeader />
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <div className="doc-eyebrow-accent">Signed &amp; Confirmed</div>
          <h1 className="doc-h1 mt-3">This agreement has been countersigned.</h1>
          <p className="mt-4 font-serif text-[15px] leading-[1.7] text-slate-700">
            You signed and paid for {contract.student_name}&apos;s enrollment. A copy was
            emailed to you. If you need it again, contact{" "}
            <a className="text-navy underline-offset-2 hover:underline" href="mailto:support@studycore.net">
              support@studycore.net
            </a>
            .
          </p>
          {contract.pdf_url && (
            <a
              href={contract.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="doc-btn-secondary mt-8"
            >
              Download signed PDF
            </a>
          )}
        </div>
      </main>
    );
  }

  // Successful redirect-method payment: render a "Finalizing..." UI that
  // POSTs the saved signature to /api/sign and then router.replace to
  // /welcome. The replace navigation strips Stripe's redirect query params
  // from the address bar.
  if (verifiedRedirectSucceeded) {
    return (
      <main className="doc-shell">
        <DocHeader />
        <div className="mx-auto max-w-lg px-6 py-24">
          <FinalizeAfterRedirect token={contract.signing_token} />
        </div>
      </main>
    );
  }

  return (
    <main className="doc-shell">
      <DocHeader />

      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        {/* Document identifier strip */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="doc-eyebrow-accent">SAT Tutoring Services Agreement</div>
            <h1 className="doc-h1 mt-2">
              For {contract.student_name}
            </h1>
            <p className="mt-1 font-serif text-[14px] text-slate-600">
              Issued to {contract.parent_name} &middot; Agreement dated{" "}
              {formatDate(contract.agreement_date)}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <div className="doc-meta-label">Reference</div>
            <div className="mt-1 font-mono text-[12px] text-slate-700">
              {contract.id.slice(0, 8).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Premium summary bar — flat, sharp, no shadow */}
        <section className="doc-pane mb-10 grid grid-cols-3 divide-x divide-slate-200">
          <SummaryCell
            label="Total Program"
            value={formatMoney(contract.total_price)}
          />
          <SummaryCell
            label="Due at Signing"
            value={formatMoney(contract.amount_due_at_signing)}
            accent
          />
          <SummaryCell
            label="Structure"
            value={contract.payment_structure}
            small
          />
        </section>

        {/* The legal document — fixed-height scrollable box. The signature
          * canvas, payment block, and Sign & Pay button below sit OUTSIDE
          * this container in normal page flow. Inline styles to make the
          * height/overflow constraints unmissable. */}
        <div
          style={{
            display: "block",
            boxSizing: "border-box",
            height: "500px",
            maxHeight: "500px",
            overflowY: "scroll",
            border: "1px solid #e5e7eb",
            background: "#ffffff",
            marginBottom: "40px",
          }}
        >
          <article className="px-6 py-10 sm:px-12 sm:py-14">
            <header className="mb-10 border-b border-slate-300/80 pb-8">
              <div className="doc-eyebrow-accent">StudyCore LLC</div>
              <h2 className="doc-h1 mt-2">SAT Tutoring Services Agreement</h2>
              <p className="mt-3 font-serif text-[14px] text-slate-600">
                Effective {formatDate(contract.agreement_date)} between StudyCore LLC and{" "}
                {contract.parent_name}, parent or legal guardian of {contract.student_name}.
              </p>
            </header>

            <div className="space-y-9">
              {clauses.map((clause) => (
                <ClauseBlock key={clause.heading} clause={clause} />
              ))}
            </div>

            <footer className="mt-12 border-t border-slate-200 pt-6 font-serif text-[12px] leading-relaxed text-slate-500">
              StudyCore LLC &nbsp;·&nbsp; San Ramon, California &nbsp;·&nbsp;{" "}
              support@studycore.net &nbsp;·&nbsp; studycore.net
            </footer>
          </article>
        </div>

        <SignAndPay
          contractId={contract.id}
          token={contract.signing_token}
          parentName={contract.parent_name}
          amountDueCents={dueAtSigningCents}
          stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
          stripeClientSecret={clientSecret}
          initialError={redirectError}
        />

        <p className="mt-10 text-center font-serif text-[12px] text-slate-500">
          By submitting, you acknowledge electronic signature has the same legal
          effect as a handwritten signature under the U.S. ESIGN Act.
        </p>
      </div>
    </main>
  );
}

function DocHeader() {
  return (
    <header className="doc-header">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <a href="https://studycore.net" className="flex items-center" aria-label="StudyCore">
          <StudyCoreLogo height={44} />
        </a>
        <div className="hidden items-center gap-6 text-right sm:flex">
          <div className="doc-eyebrow">Tutoring Services Agreement</div>
        </div>
      </div>
    </header>
  );
}

function SummaryCell({
  label,
  value,
  accent,
  small,
}: {
  label: string;
  value: string;
  accent?: boolean;
  small?: boolean;
}) {
  return (
    <div className="px-5 py-5 sm:px-6 sm:py-6">
      <div className="doc-meta-label">{label}</div>
      <div
        className={
          (small
            ? "mt-2 font-sans text-[14px] font-medium text-slate-800"
            : "mt-2 font-sans text-[20px] font-semibold tracking-tight ") +
          (accent ? " text-orange" : " text-navy")
        }
      >
        {value}
      </div>
    </div>
  );
}

function ClauseBlock({
  clause,
}: {
  clause: { heading: string; paragraphs: string[]; bullets?: string[] };
}) {
  // Heading shape is e.g. "1. PARTIES & PROGRAM DETAILS" — split it for the
  // refined two-tone heading style.
  const m = clause.heading.match(/^(\d+)\.\s*(.+)$/);
  const num = m?.[1];
  const title = m ? m[2] : clause.heading;
  return (
    <section>
      <h3 className="mb-4 flex items-baseline">
        {num && <span className="doc-section-num">{num.padStart(2, "0")}</span>}
        <span className="doc-h2">{title}</span>
      </h3>
      <div className="doc-body space-y-3">
        {clause.paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {renderInlineItalic(p)}
          </p>
        ))}
        {clause.bullets && clause.bullets.length > 0 && (
          <ul className="mt-2 space-y-2 pl-0">
            {clause.bullets.map((b, i) => (
              <li key={i} className="flex gap-3 text-slate-800">
                <span aria-hidden className="mt-[10px] h-px w-3 flex-shrink-0 bg-orange" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
