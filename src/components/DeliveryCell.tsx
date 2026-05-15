import type { SendOption } from "@/lib/types";

export default function DeliveryCell({
  sendOption,
  contractSentAt,
  paymentLinkSentAt,
}: {
  sendOption: SendOption;
  contractSentAt: string | null;
  paymentLinkSentAt: string | null;
}) {
  const contractDone = !!contractSentAt;
  const paymentDone = !!paymentLinkSentAt;
  return (
    <div className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-slate-700">{sendOptionLabel(sendOption)}</span>
      <div className="flex flex-wrap gap-1">
        <Pill done={contractDone} label="Contract" />
        <Pill done={paymentDone} label="Payment link" />
      </div>
    </div>
  );
}

function sendOptionLabel(opt: SendOption) {
  switch (opt) {
    case "contract_only":
      return "Contract first";
    case "payment_only":
      return "Payment first";
    case "both":
    default:
      return "Both together";
  }
}

function Pill({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium " +
        (done
          ? "bg-green-50 text-green-700"
          : "bg-slate-100 text-slate-500")
      }
    >
      <span
        className={
          "h-1.5 w-1.5 rounded-full " + (done ? "bg-green-500" : "bg-slate-400")
        }
        aria-hidden
      />
      {label}
      {done ? " sent" : " pending"}
    </span>
  );
}
