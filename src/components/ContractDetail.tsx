"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { Contract } from "@/lib/types";

export default function ContractDetail({
  contract,
  closerName,
  signingUrl,
}: {
  contract: Contract;
  closerName: string;
  signingUrl: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"contract" | "payment_link" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isComplete = contract.status === "completed";

  async function send(type: "contract" | "payment_link") {
    setBusy(type);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/contracts/${contract.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Send failed.");
      } else {
        setInfo(
          type === "contract"
            ? "Contract email sent."
            : "Payment link email sent."
        );
        router.refresh();
      }
    } catch (e: any) {
      setError(e?.message ?? "Send failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500">
            {contract.test_type} Contract
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{contract.student_name}</h1>
          <p className="text-sm text-slate-500">
            For {contract.parent_name} · Closer: {closerName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={
              "inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wider " +
              (contract.test_type === "ACT"
                ? "bg-orange/10 text-orange-dark"
                : "bg-navy/10 text-navy")
            }
          >
            {contract.test_type}
          </span>
          <StatusBadge status={contract.status} />
          {contract.pdf_url && (
            <a
              href={contract.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              Signed PDF
            </a>
          )}
          {!isComplete && (
            <Link href={signingUrl} target="_blank" className="btn-ghost">
              Open signing link
            </Link>
          )}
        </div>
      </div>

      {!isComplete && (
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Delivery
          </h2>
          <p className="mb-4 text-sm text-slate-600">
            Original send method:{" "}
            <span className="font-medium text-slate-800">
              {sendOptionLabel(contract.send_option)}
            </span>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <DeliveryRow
              title="Contract email"
              sentAt={contract.contract_sent_at}
              actionLabel={
                contract.contract_sent_at ? "Resend contract" : "Send contract now"
              }
              onAction={() => send("contract")}
              busy={busy === "contract"}
              disabled={busy !== null}
            />
            <DeliveryRow
              title="Stripe payment link"
              sentAt={contract.payment_link_sent_at}
              actionLabel={
                contract.payment_link_sent_at
                  ? "Resend payment link"
                  : "Send payment link now"
              }
              onAction={() => send("payment_link")}
              busy={busy === "payment_link"}
              disabled={
                busy !== null || Number(contract.amount_due_at_signing) <= 0
              }
              suffix={
                Number(contract.amount_due_at_signing) <= 0
                  ? "No amount due — not applicable"
                  : null
              }
            />
          </div>
          {contract.stripe_checkout_url && (
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Direct Stripe link
              </div>
              <code className="mt-1 block break-all rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-700">
                {contract.stripe_checkout_url}
              </code>
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {info && (
            <div className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              {info}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Parties">
          <Row label="Parent" value={contract.parent_name} />
          <Row label="Email" value={contract.parent_email} />
          <Row label="Phone" value={contract.parent_phone} />
          <Row label="Agreement date" value={formatDate(contract.agreement_date)} />
          <Row label="Student" value={contract.student_name} />
          <Row label={`Target ${contract.test_type}`} value={String(contract.target_score)} />
        </Section>

        <Section title="Program">
          <Row label="Duration" value={contract.program_duration} />
          <Row label="Sessions / week" value={String(contract.sessions_per_week)} />
          <Row label="Session length" value={`${contract.session_length} hr`} />
          <Row label="Total hours" value={String(contract.total_hours)} />
          <Row label="Target test date" value={formatDate(contract.test_date)} />
        </Section>

        <Section title="Payment">
          <Row label="Total" value={formatMoney(contract.total_price)} />
          <Row label="Structure" value={contract.payment_structure} />
          {contract.upfront_amount != null && (
            <Row label="Upfront" value={formatMoney(contract.upfront_amount)} />
          )}
          {contract.remaining_balance != null && (
            <Row label="Remaining" value={formatMoney(contract.remaining_balance)} />
          )}
          {contract.financing_details && (
            <Row label="Financing" value={contract.financing_details} />
          )}
          <Row label="Due at signing" value={formatMoney(contract.amount_due_at_signing)} />
        </Section>

        <Section title="Guarantee & Cancellation">
          <Row label="Guarantee" value={contract.guarantee_type} />
          <Row label="3-session trial window" value={contract.trial_window ? "Yes" : "No"} />
          <Row
            label="Cancellation refund terms"
            value={contract.show_cancellation_refund_terms ? "Yes" : "No"}
          />
        </Section>

        <Section title="Lifecycle">
          <Row label="Created" value={formatDateTime(contract.created_at)} />
          <Row
            label="Contract emailed"
            value={formatDateTime(contract.contract_sent_at)}
          />
          <Row
            label="Payment link emailed"
            value={formatDateTime(contract.payment_link_sent_at)}
          />
          <Row label="Signed" value={formatDateTime(contract.signed_at)} />
          <Row label="Paid" value={formatDateTime(contract.paid_at)} />
          {contract.stripe_payment_intent_id && (
            <Row label="Stripe PI" value={contract.stripe_payment_intent_id} />
          )}
        </Section>

        <Section title="Signing link">
          <p className="text-xs text-slate-500">
            Anyone with this link can view and sign this contract. Don't share publicly.
          </p>
          <code className="mt-2 block break-all rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-700">
            {signingUrl}
          </code>
        </Section>
      </div>
    </div>
  );
}

function sendOptionLabel(opt: Contract["send_option"]) {
  switch (opt) {
    case "contract_only":
      return "Contract only — payment link later";
    case "payment_only":
      return "Payment link first — contract later";
    case "both":
    default:
      return "Contract & payment link together";
  }
}

function DeliveryRow({
  title,
  sentAt,
  actionLabel,
  onAction,
  busy,
  disabled,
  suffix,
}: {
  title: string;
  sentAt: string | null;
  actionLabel: string;
  onAction: () => void;
  busy: boolean;
  disabled?: boolean;
  suffix?: string | null;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="text-sm font-medium text-slate-800">{title}</div>
      <div className="mt-1 text-xs text-slate-500">
        {sentAt
          ? `Sent ${formatDateTime(sentAt)}`
          : suffix ?? "Not yet sent"}
      </div>
      {!suffix && (
        <button
          type="button"
          onClick={onAction}
          disabled={disabled}
          className="btn-secondary mt-3 text-sm"
        >
          {busy ? "Sending…" : actionLabel}
        </button>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}
