import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { buildContractClauses, type ContractClause } from "@/lib/contract-text";
import { formatDate, formatMoney } from "@/lib/format";
import type { Contract } from "@/lib/types";
import StudyCoreLogo from "@/components/StudyCoreLogo";
import SignAndPay from "./SignAndPay";
import FinalizeAfterRedirect from "./FinalizeAfterRedirect";

export const dynamic = "force-dynamic";

function errorForPiStatus(status: string): string {
  if (status === "processing") {
    return "Your payment is still processing. We'll email you once it confirms — you don't need to do anything else right now.";
  }
  if (status === "requires_payment_method") {
    return "Payment was not completed. Please try again or use a different payment method.";
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

  if (contract.status === "sent") {
    await admin
      .from("contracts")
      .update({ status: "viewed" })
      .eq("id", contract.id);
    contract.status = "viewed";
  }

  const isComplete = contract.status === "completed" || contract.status === "signed";
  const dueAtSigningCents = Math.round(Number(contract.amount_due_at_signing) * 100);

  // The parent has just been redirected back from a Stripe redirect-based
  // payment method (Klarna, Affirm, etc.). The URL params are not trustworthy
  // on their own — always re-verify the PaymentIntent status against the id we
  // stored at creation time.
  const returnedFromRedirect =
    !!searchParams.payment_intent || !!searchParams.payment_intent_client_secret;
  let verifiedRedirectSucceeded = false;
  let redirectError: string | null = null;

  if (returnedFromRedirect && !isComplete && contract.stripe_payment_intent_id) {
    try {
      const stripe = getStripe();
      const pi = await stripe.paymentIntents.retrieve(contract.stripe_payment_intent_id);
      if (pi.status === "succeeded") {
        verifiedRedirectSucceeded = true;
      } else {
        redirectError = errorForPiStatus(pi.status);
      }
    } catch {
      redirectError =
        "We couldn't verify your payment. Please try again or contact support@studycore.net.";
    }
  } else if (returnedFromRedirect && !isComplete) {
    redirectError = "Payment was not completed. Please try again.";
  }

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
          <h1 className="doc-h1 mt-4">This agreement has been countersigned.</h1>
          <p className="mt-5 text-[15px] leading-[1.7] text-slate-600">
            You signed and paid for {contract.student_name}&apos;s enrollment. A copy
            was emailed to you. If you need it again, contact{" "}
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
  const signatureClauseNumber = clauses.length + 1;

  return (
    <main className="doc-shell">
      <DocHeader reference={reference} />

      {/* Horizontal payment summary — full-bleed bar, not a card. */}
      <SummaryBar
        total={formatMoney(contract.total_price)}
        dueNow={formatMoney(contract.amount_due_at_signing)}
        structure={contract.payment_structure}
      />

      <div className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
        {/* Document opener */}
        <div className="mb-14">
          <div className="doc-eyebrow-muted">SAT Tutoring Services Agreement</div>
          <h1 className="doc-h1 mt-4">Prepared for {contract.student_name}</h1>
          <p className="mt-3 text-[14.5px] leading-[1.7] text-slate-600">
            Issued to {contract.parent_name} &middot; Effective{" "}
            {formatDate(contract.agreement_date)} &middot; Reference{" "}
            <span className="font-mono text-[12.5px] text-slate-500">{reference}</span>
          </p>
        </div>

        {/* The legal document — fixed-height scrollable box. The signature
          * canvas and Sign & Pay button below sit OUTSIDE this container in
          * normal page flow. */}
        <div
          style={{
            height: "500px",
            overflowY: "scroll",
            border: "1px solid #e5e7eb",
            background: "#ffffff",
          }}
        >
          <article
            className="px-6 py-10 sm:px-10 sm:py-12"
            tabIndex={0}
            aria-label="SAT Tutoring Services Agreement"
          >
            <header className="mb-12 border-b border-slate-200 pb-10">
              <div className="doc-eyebrow-muted">StudyCore LLC</div>
              <h2 className="doc-h1 mt-3">SAT Tutoring Services Agreement</h2>
              <p className="mt-4 max-w-prose text-[14.5px] leading-[1.75] text-slate-600">
                Effective {formatDate(contract.agreement_date)} between StudyCore LLC and{" "}
                {contract.parent_name}, parent or legal guardian of {contract.student_name}.
              </p>
            </header>

            <div className="space-y-12">
              {clauses.map((clause, idx) => (
                <ClauseBlock key={idx} number={idx + 1} clause={clause} />
              ))}
            </div>

            <footer className="mt-16 border-t border-slate-200 pt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">
              StudyCore LLC &middot; San Ramon, California &middot; support@studycore.net
            </footer>
          </article>
        </div>

        <div className="mt-16">
          <SignAndPay
            contractId={contract.id}
            token={contract.signing_token}
            parentName={contract.parent_name}
            amountDueCents={dueAtSigningCents}
            stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
            stripeClientSecret={clientSecret}
            initialError={redirectError}
            signatureClauseNumber={signatureClauseNumber}
          />
        </div>

        <p className="mt-14 text-center text-[12.5px] leading-[1.7] text-slate-500">
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
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <a href="https://studycore.net" className="flex items-center" aria-label="StudyCore">
          <StudyCoreLogo height={26} />
        </a>
        <div className="flex items-center gap-6">
          {reference && (
            <div className="hidden text-right sm:block">
              <div className="doc-meta-label">Reference</div>
              <div className="mt-0.5 font-mono text-[11.5px] text-slate-600">
                {reference}
              </div>
            </div>
          )}
          <span aria-hidden className="hidden h-6 w-px bg-slate-200 sm:block" />
          <div className="doc-eyebrow">Tutoring Agreement</div>
        </div>
      </div>
    </header>
  );
}

function SummaryBar({
  total,
  dueNow,
  structure,
}: {
  total: string;
  dueNow: string;
  structure: string;
}) {
  return (
    <section className="border-b border-slate-200 bg-slate-50/60">
      <div className="mx-auto flex max-w-5xl flex-col divide-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-10 sm:divide-x">
        <SummaryItem label="Total Program" value={total} />
        <SummaryItem label="Due at Signing" value={dueNow} accent />
        <SummaryItem label="Payment Structure" value={structure} muted />
      </div>
    </section>
  );
}

function SummaryItem({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3 py-1.5 sm:flex-1 sm:gap-4 sm:py-0 sm:pl-8 sm:first:pl-0">
      <span className="doc-meta-label whitespace-nowrap">{label}</span>
      <span
        className={
          "font-semibold tracking-[-0.01em] " +
          (muted
            ? "text-[14px] text-slate-700"
            : "text-[18px] text-navy")
        }
      >
        {value}
        {accent && (
          <span
            aria-hidden
            className="ml-2 inline-block h-1.5 w-1.5 -translate-y-[3px] bg-navy align-middle"
          />
        )}
      </span>
    </div>
  );
}

function ClauseBlock({
  number,
  clause,
}: {
  number: number;
  clause: ContractClause;
}) {
  const num = String(number).padStart(2, "0");
  return (
    <section>
      <h3 className="mb-5 flex items-baseline">
        <span className="doc-section-num">§ {num}</span>
        <span className="doc-h2">{clause.title}</span>
      </h3>
      <div className="doc-body">
        {clause.paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
        {clause.bullets && clause.bullets.length > 0 && (
          <ul className="mt-5 space-y-2.5 pl-0">
            {clause.bullets.map((b, i) => (
              <li key={i} className="flex gap-3 text-slate-700">
                <span aria-hidden className="mt-[12px] h-px w-3 flex-shrink-0 bg-slate-400" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
