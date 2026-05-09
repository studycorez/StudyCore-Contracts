import Link from "next/link";
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
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500">Contract</div>
          <h1 className="text-2xl font-bold text-slate-900">{contract.student_name}</h1>
          <p className="text-sm text-slate-500">
            For {contract.parent_name} · Closer: {closerName}
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          {contract.status !== "completed" && (
            <Link href={signingUrl} target="_blank" className="btn-ghost">
              Open signing link
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Parties">
          <Row label="Parent" value={contract.parent_name} />
          <Row label="Email" value={contract.parent_email} />
          <Row label="Phone" value={contract.parent_phone} />
          <Row label="Agreement date" value={formatDate(contract.agreement_date)} />
          <Row label="Student" value={contract.student_name} />
          <Row label="Target SAT" value={String(contract.target_score)} />
        </Section>

        <Section title="Program">
          <Row label="Duration" value={contract.program_duration} />
          <Row label="Sessions / week" value={String(contract.sessions_per_week)} />
          <Row label="Session length" value={`${contract.session_length} hr`} />
          <Row label="Total hours" value={String(contract.total_hours)} />
          <Row label="Start" value={formatDate(contract.start_date)} />
          <Row label="Estimated end" value={formatDate(contract.end_date)} />
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
