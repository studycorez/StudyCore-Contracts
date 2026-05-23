import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";
import StatusBadge from "@/components/StatusBadge";
import DeliveryCell from "@/components/DeliveryCell";
import { formatDate, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await requireRole(["admin"]);
  const supabase = createClient();

  const { data: contracts } = await supabase
    .from("contracts")
    .select(
      "id, parent_name, student_name, test_type, status, total_price, amount_due_at_signing, created_at, closer_id, send_option, contract_sent_at, payment_link_sent_at"
    )
    .order("created_at", { ascending: false });

  const closerIds = Array.from(new Set((contracts ?? []).map((c) => c.closer_id)));
  let closerMap = new Map<string, string>();
  if (closerIds.length) {
    const { data: closers } = await supabase
      .from("users")
      .select("id,name")
      .in("id", closerIds);
    (closers ?? []).forEach((c) => closerMap.set(c.id, c.name));
  }

  const totals = (contracts ?? []).reduce(
    (acc, c) => {
      acc.total += 1;
      if (c.status === "completed") acc.completed += 1;
      if (c.status === "sent" || c.status === "viewed") acc.outstanding += 1;
      return acc;
    },
    { total: 0, completed: 0, outstanding: 0 }
  );

  return (
    <DashboardShell
      user={user}
      nav={[
        { href: "/admin", label: "Contracts" },
        { href: "/admin/users", label: "Closers" },
      ]}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">All Contracts</h1>
          <p className="text-sm text-slate-500">
            Every contract issued by every closer.
          </p>
        </div>
        <Link href="/admin/users" className="btn-secondary">
          Manage closers
        </Link>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Stat label="Total contracts" value={totals.total} />
        <Stat label="Completed" value={totals.completed} accent="emerald" />
        <Stat label="Awaiting signature" value={totals.outstanding} accent="orange" />
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Test</th>
              <th className="px-4 py-3">Closer</th>
              <th className="px-4 py-3">Parent</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Delivery</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {(contracts ?? []).map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3">
                  <TestBadge testType={(c.test_type as "SAT" | "ACT" | null) ?? "SAT"} />
                </td>
                <td className="px-4 py-3 font-medium text-slate-700">
                  {closerMap.get(c.closer_id) ?? "—"}
                </td>
                <td className="px-4 py-3">{c.parent_name}</td>
                <td className="px-4 py-3">{c.student_name}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.status as any} />
                </td>
                <td className="px-4 py-3">
                  <DeliveryCell
                    sendOption={(c.send_option as any) ?? "both"}
                    contractSentAt={c.contract_sent_at as string | null}
                    paymentLinkSentAt={c.payment_link_sent_at as string | null}
                  />
                </td>
                <td className="px-4 py-3 text-slate-500">{formatDate(c.created_at)}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">
                  {formatMoney(c.total_price)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/contracts/${c.id}`} className="btn-ghost">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {(!contracts || contracts.length === 0) && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                  No contracts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}

function TestBadge({ testType }: { testType: "SAT" | "ACT" }) {
  return (
    <span
      className={
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold " +
        (testType === "ACT"
          ? "bg-orange/10 text-orange-dark"
          : "bg-navy/10 text-navy")
      }
    >
      {testType}
    </span>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "orange";
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-600"
      : accent === "orange"
      ? "text-orange"
      : "text-navy";
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-2 text-3xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
