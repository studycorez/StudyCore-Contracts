import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendContractEmail, sendPaymentLinkEmail } from "@/lib/email";
import { createCheckoutSessionForContract } from "@/lib/stripe";
import type { Contract, SendOption } from "@/lib/types";

const VALID_SEND_OPTIONS: SendOption[] = ["contract_only", "payment_only", "both"];

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://sign.studycore.net";
}

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me || me.role !== "closer" || !me.active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const required = [
    "parent_name",
    "parent_email",
    "parent_phone",
    "agreement_date",
    "student_name",
    "target_score",
    "program_duration",
    "sessions_per_week",
    "session_length",
    "total_hours",
    "start_date",
    "end_date",
    "test_date",
    "total_price",
    "payment_structure",
    "amount_due_at_signing",
    "guarantee_type",
    "trial_window",
  ];
  for (const k of required) {
    if (body[k] === undefined || body[k] === null || body[k] === "") {
      return NextResponse.json({ error: `Missing field: ${k}` }, { status: 400 });
    }
  }

  const sendOption: SendOption = VALID_SEND_OPTIONS.includes(body.send_option)
    ? body.send_option
    : "both";

  const dueCents = Math.round(Number(body.amount_due_at_signing) * 100);
  if ((sendOption === "payment_only" || sendOption === "both") && dueCents <= 0) {
    return NextResponse.json(
      {
        error:
          "A direct Stripe payment link can only be sent when there's an amount due at signing. Choose 'Contract only' for full-financing plans with $0 due now.",
      },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { send_option: _unused, ...rest } = body;
  const { data: inserted, error } = await admin
    .from("contracts")
    .insert({
      ...rest,
      closer_id: me.id,
      send_option: sendOption,
      status: "sent",
    })
    .select("*")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message ?? "Could not save contract." },
      { status: 400 }
    );
  }

  let contract = inserted as Contract;

  if (sendOption === "payment_only" || sendOption === "both") {
    try {
      const session = await createCheckoutSessionForContract({
        contract,
        appUrl: appUrl(),
      });
      const { data: updated } = await admin
        .from("contracts")
        .update({
          stripe_checkout_session_id: session.id,
          stripe_checkout_url: session.url,
          stripe_payment_intent_id:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
        })
        .eq("id", contract.id)
        .select("*")
        .single();
      if (updated) contract = updated as Contract;
    } catch (e: any) {
      return NextResponse.json(
        {
          id: contract.id,
          warning: `Contract saved but Stripe checkout failed: ${e?.message ?? "unknown error"}`,
        },
        { status: 207 }
      );
    }
  }

  const sentTimestamps: Record<string, string> = {};
  const now = new Date().toISOString();
  const warnings: string[] = [];

  if (sendOption === "contract_only" || sendOption === "both") {
    try {
      await sendContractEmail({ contract, closerName: me.name });
      sentTimestamps.contract_sent_at = now;
    } catch (e: any) {
      warnings.push(`Contract email failed: ${e?.message ?? "unknown error"}`);
    }
  }

  if (sendOption === "payment_only" || sendOption === "both") {
    if (!contract.stripe_checkout_url) {
      warnings.push("Payment link email skipped: missing checkout URL.");
    } else {
      try {
        await sendPaymentLinkEmail({
          contract,
          closerName: me.name,
          paymentUrl: contract.stripe_checkout_url,
        });
        sentTimestamps.payment_link_sent_at = now;
      } catch (e: any) {
        warnings.push(`Payment-link email failed: ${e?.message ?? "unknown error"}`);
      }
    }
  }

  if (Object.keys(sentTimestamps).length > 0) {
    await admin.from("contracts").update(sentTimestamps).eq("id", contract.id);
  }

  if (warnings.length > 0) {
    return NextResponse.json(
      { id: contract.id, warning: warnings.join(" ") },
      { status: 207 }
    );
  }

  return NextResponse.json({ id: contract.id });
}
