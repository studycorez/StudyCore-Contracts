import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendContractEmail, sendPaymentLinkEmail } from "@/lib/email";
import { createCheckoutSessionForContract } from "@/lib/stripe";
import type { Contract } from "@/lib/types";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://sign.studycore.net";
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const me = await getSessionUser();
  if (!me || !me.active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (me.role !== "closer" && me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const type = body.type;
  if (type !== "contract" && type !== "payment_link") {
    return NextResponse.json(
      { error: "Body must include type: 'contract' or 'payment_link'." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: loaded } = await admin
    .from("contracts")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!loaded) {
    return NextResponse.json({ error: "Contract not found." }, { status: 404 });
  }
  let contract = loaded as Contract;
  if (me.role === "closer" && contract.closer_id !== me.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: closer } = await admin
    .from("users")
    .select("name")
    .eq("id", contract.closer_id)
    .single();
  const closerName = closer?.name ?? me.name;

  const now = new Date().toISOString();

  if (type === "contract") {
    try {
      await sendContractEmail({ contract, closerName });
    } catch (e: any) {
      return NextResponse.json(
        { error: `Contract email failed: ${e?.message ?? "unknown error"}` },
        { status: 502 }
      );
    }
    await admin
      .from("contracts")
      .update({ contract_sent_at: now })
      .eq("id", contract.id);
    return NextResponse.json({ ok: true, contract_sent_at: now });
  }

  // payment_link
  const dueCents = Math.round(Number(contract.amount_due_at_signing) * 100);
  if (dueCents <= 0) {
    return NextResponse.json(
      {
        error:
          "This contract has $0 due at signing — no payment link to send.",
      },
      { status: 400 }
    );
  }

  let checkoutUrl = contract.stripe_checkout_url;
  if (!checkoutUrl) {
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
            contract.stripe_payment_intent_id ??
            (typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null),
        })
        .eq("id", contract.id)
        .select("*")
        .single();
      if (updated) contract = updated as Contract;
      checkoutUrl = session.url;
    } catch (e: any) {
      return NextResponse.json(
        { error: `Stripe checkout failed: ${e?.message ?? "unknown error"}` },
        { status: 502 }
      );
    }
  }

  if (!checkoutUrl) {
    return NextResponse.json(
      { error: "Could not produce a Stripe checkout URL." },
      { status: 500 }
    );
  }

  try {
    await sendPaymentLinkEmail({
      contract,
      closerName,
      paymentUrl: checkoutUrl,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `Payment-link email failed: ${e?.message ?? "unknown error"}` },
      { status: 502 }
    );
  }

  await admin
    .from("contracts")
    .update({ payment_link_sent_at: now })
    .eq("id", contract.id);

  return NextResponse.json({ ok: true, payment_link_sent_at: now });
}
