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

export default async function SignPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: {
    payment_intent?: string;
    payment_intent_client_secret?: string;
    redirect_status?: string;
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
  const dueAtSigningCents = Math.round(Number(contract.amount_due_at_signing) * 100);

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
        <div className="mx-auto max-w-xl px-6 py-24 text-center">
          <div className="doc-eyebrow-accent">Signed &amp; Confirmed</div>
          <h1 className="doc-h1 mt-3">This agreement has been countersigned.</h1>
          <p className="mt-5 font-serif text-[15px] leading-[1.72] text-slate-600">
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
              className="doc-btn-secondary mt-10"
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

  const reference = contract.id.slice(0, 8).toUpperCase();

  return (
    <main className="doc-shell">
      <DocHeader reference={reference} />

      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        {/* Document identifier strip — restrained, archive-style */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="doc-eyebrow-muted">SAT Tutoring Services Agreement</div>
            <h1 className="doc-h1 mt-3">
              Prepared for {contract.student_name}
            </h1>
            <p className="mt-2 font-serif text-[14px] leading-[1.6] text-slate-500">
              Issued to {contract.parent_name} &middot; Effective{" "}
              {formatDate(contract.agreement_date)}
            </p>
          </div>
        </div>

        {/* Premium summary — minimal grid, no dividers, single bottom rule */}
        <section className="mb-12 border-y border-slate-200 bg-white">
          <dl className="grid grid-cols-1 sm:grid-cols-3">
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
              label="Payment Structure"
              value={contract.payment_structure}
              small
            />
          </dl>
        </section>

        {/* The legal document itself — clean, generous, paper-like */}
        <article className="doc-pane mb-12 px-6 py-12 sm:px-14 sm:py-16">
          <header className="mb-12 border-b border-slate-200 pb-10">
            <div className="doc-eyebrow-muted">StudyCore LLC</div>
            <h2 className="doc-h1 mt-3">SAT Tutoring Services Agreement</h2>
            <p className="mt-4 max-w-prose font-serif text-[14.5px] leading-[1.7] text-slate-600">
              Effective {formatDate(contract.agreement_date)} between StudyCore LLC and{" "}
              {contract.parent_name}, parent or legal guardian of {contract.student_name}.
            </p>
          </header>

          <div className="space-y-10">
            {clauses.map((clause) => (
              <ClauseBlock key={clause.heading} clause={clause} />
            ))}
          </div>

          <footer className="mt-14 border-t border-slate-200 pt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
            StudyCore LLC &nbsp;·&nbsp; San Ramon, California &nbsp;·&nbsp;{" "}
            support@studycore.net
          </footer>
        </article>

        <SignAndPay
          contractId={contract.id}
          token={contract.signing_token}
          parentName={contract.parent_name}
          amountDueCents={dueAtSigningCents}
          stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
          stripeClientSecret={clientSecret}
          initialError={redirectError}
        />

        <p className="mt-12 text-center font-serif text-[12.5px] leading-[1.7] text-slate-500">
          By submitting, you acknowledge electronic signature has the same legal
          effect as a handwritten signature under the U.S. ESIGN Act.
        </p>
      </div>
    </main>
  );
}

function DocHeader({ reference }: { reference?: string }) {
  return (
    <header className="doc-header">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
        <a href="https://studycore.net" className="flex items-center" aria-label="StudyCore">
          <StudyCoreLogo height={24} />
        </a>
        <div className="flex items-center gap-5 text-right">
          <div className="hidden sm:block">
            <div className="doc-eyebrow-muted">Document</div>
            <div className="mt-0.5 font-mono text-[11px] text-slate-600">
              {reference ?? "—"}
            </div>
          </div>
          <span aria-hidden className="hidden h-6 w-px bg-slate-200 sm:block" />
          <div className="doc-eyebrow">Tutoring Agreement</div>
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
    <div className="border-b border-slate-200 px-5 py-6 sm:border-b-0 sm:border-r sm:px-7 sm:py-7 [&:last-child]:border-r-0">
      <dt className="doc-meta-label">{label}</dt>
      <dd className="mt-2.5">
        {small ? (
          <span className="font-sans text-[14px] font-medium leading-snug text-slate-800">
            {value}
          </span>
        ) : (
          <span className="font-serif text-[24px] font-semibold leading-none tracking-[-0.01em] text-navy">
            {value}
            {accent && (
              <span
                aria-hidden
                className="ml-2 inline-block h-1.5 w-1.5 -translate-y-[3px] bg-orange align-middle"
              />
            )}
          </span>
        )}
      </dd>
    </div>
  );
}

function ClauseBlock({
  clause,
}: {
  clause: { heading: string; paragraphs: string[]; bullets?: string[] };
}) {
  const m = clause.heading.match(/^(\d+)\.\s*(.+)$/);
  const num = m?.[1];
  const title = m ? m[2] : clause.heading;
  return (
    <section>
      <h3 className="mb-4 flex items-baseline">
        {num && <span className="doc-section-num">§ {num.padStart(2, "0")}</span>}
        <span className="doc-h2">{title}</span>
      </h3>
      <div className="doc-body">
        {clause.paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
        {clause.bullets && clause.bullets.length > 0 && (
          <ul className="mt-4 space-y-2 pl-0">
            {clause.bullets.map((b, i) => (
              <li key={i} className="flex gap-3 text-slate-800">
                <span aria-hidden className="mt-[11px] h-px w-3 flex-shrink-0 bg-slate-400" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
