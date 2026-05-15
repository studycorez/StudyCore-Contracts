import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";
import StatusBadge from "@/components/StatusBadge";
import DeliveryCell from "@/components/DeliveryCell";
import { formatDate, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CloserDashboard() {
  const user = await requireRole(["closer"]);
  const supabase = createClient();

  const { data: contracts } = await supabase
    .from("contracts")
    .select(
      "id, parent_name, student_name, status, total_price, amount_due_at_signing, created_at, send_option, contract_sent_at, payment_link_sent_at"
    )
    .eq("closer_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <DashboardShell
      user={user}
      nav={[
        { href: "/closer", label: "My Contracts" },
        { href: "/closer/new", label: "New Contract" },
      ]}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Contracts</h1>
          <p className="text-sm text-slate-500">
            Contracts you've sent to parents.
          </p>
        </div>
        <Link href="/closer/new" className="btn-primary">
          + New contract
        </Link>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Parent</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Delivery</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Due at signing</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {(contracts ?? []).map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{c.parent_name}</td>
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
                <td className="px-4 py-3">{formatMoney(c.total_price)}</td>
                <td className="px-4 py-3">{formatMoney(c.amount_due_at_signing)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/closer/contracts/${c.id}`} className="btn-ghost">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {(!contracts || contracts.length === 0) && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  No contracts yet. Create your first one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
