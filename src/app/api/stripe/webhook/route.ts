import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentReceivedEmail } from "@/lib/email";
import type { Contract, ContractStatus } from "@/lib/types";

export const runtime = "nodejs";
// Stripe signature verification requires the raw request body untouched by
// Next's body parser. Force-dynamic + raw text read below handles that.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET not configured." },
      { status: 500 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Signature verification failed: ${err?.message ?? "unknown"}` },
      { status: 400 }
    );
  }

  let contractId: string | null = null;
  let paid = false;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      contractId = (session.metadata?.contract_id as string | undefined) ?? null;
      paid = session.payment_status === "paid";
      break;
    }
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      contractId = (session.metadata?.contract_id as string | undefined) ?? null;
      paid = true;
      break;
    }
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      contractId = (pi.metadata?.contract_id as string | undefined) ?? null;
      paid = true;
      break;
    }
    default:
      // Ignore other events — return 200 so Stripe doesn't retry.
      return NextResponse.json({ received: true, ignored: event.type });
  }

  if (!contractId || !paid) {
    return NextResponse.json({ received: true, noop: true });
  }

  const admin = createAdminClient();
  const { data: contract } = await admin
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .single();

  if (!contract) {
    // Contract may have been deleted; ack so Stripe stops retrying.
    return NextResponse.json({ received: true, missing: true });
  }

  // Idempotent: nothing to do if already marked paid.
  if (contract.paid_at) {
    return NextResponse.json({ received: true, alreadyPaid: true });
  }

  const paidAt = new Date().toISOString();
  const wasSigned = contract.status === "signed";
  const newStatus: ContractStatus = wasSigned ? "completed" : contract.status;

  const { error: updateError } = await admin
    .from("contracts")
    .update({ paid_at: paidAt, status: newStatus })
    .eq("id", contract.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // If the parent signed first and is only now paying, send the
  // "payment received — enrollment confirmed" follow-up. The signed PDF was
  // already emailed at sign time, so this is a short confirmation only.
  if (wasSigned) {
    const { data: closer } = await admin
      .from("users")
      .select("email,name")
      .eq("id", contract.closer_id)
      .single();
    try {
      await sendPaymentReceivedEmail({
        contract: { ...contract, paid_at: paidAt, status: newStatus } as Contract,
        closerEmail: closer?.email ?? null,
        closerName: closer?.name ?? null,
      });
    } catch (e: any) {
      // Don't fail the webhook — payment is recorded. Surface the warning.
      return NextResponse.json({
        received: true,
        emailWarning: e?.message ?? "Email send failed",
      });
    }
  }

  return NextResponse.json({ received: true, ok: true });
}
