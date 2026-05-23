import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { renderContractPdf } from "@/lib/pdf/render";
import { sendCompletionEmails } from "@/lib/email";
import type { Contract, ContractStatus } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { token, signature_data_url } = await req.json();
  if (!token || !signature_data_url || !signature_data_url.startsWith("data:image/")) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: contract, error: loadError } = await admin
    .from("contracts")
    .select("*")
    .eq("signing_token", token)
    .single();

  if (loadError || !contract) {
    return NextResponse.json({ error: "Contract not found." }, { status: 404 });
  }

  if (contract.status === "completed") {
    return NextResponse.json({ ok: true, alreadyComplete: true });
  }

  // Resolve payment status. The closer's send_option determines whether
  // payment must be verified at sign time:
  //   - "contract_only": closer is sending the payment link separately. Allow
  //     signing now; record payment later when it arrives.
  //   - "payment_only" / "both": payment may have happened via the separately
  //     emailed Stripe Checkout link, via the inline PaymentElement, or not
  //     yet. Check both Checkout session and PaymentIntent before failing.
  const dueCents = Math.round(Number(contract.amount_due_at_signing) * 100);
  let paidAt: string | null = contract.paid_at ?? null;
  const paymentHandledSeparately = contract.send_option === "contract_only";

  if (dueCents > 0 && !paidAt && !paymentHandledSeparately) {
    const stripe = getStripe();

    if (contract.stripe_checkout_session_id) {
      try {
        const session = await stripe.checkout.sessions.retrieve(
          contract.stripe_checkout_session_id
        );
        if (session.payment_status === "paid") {
          paidAt = new Date().toISOString();
        }
      } catch {
        // fall through to PaymentIntent check
      }
    }

    if (!paidAt && contract.stripe_payment_intent_id) {
      const pi = await stripe.paymentIntents.retrieve(
        contract.stripe_payment_intent_id
      );
      if (pi.status === "succeeded") {
        paidAt = new Date().toISOString();
      } else {
        return NextResponse.json(
          { error: `Payment status is ${pi.status}; please complete payment first.` },
          { status: 400 }
        );
      }
    }

    if (!paidAt) {
      return NextResponse.json(
        { error: "Payment is required before signing. Please complete payment first." },
        { status: 400 }
      );
    }
  }

  const signedAt = new Date().toISOString();
  const fullyPaid = dueCents === 0 || !!paidAt;
  const newStatus: ContractStatus = fullyPaid ? "completed" : "signed";

  // Render the signed PDF
  const pdfBuffer = await renderContractPdf(
    contract as Contract,
    signature_data_url,
    signedAt
  );

  // Upload to Supabase storage
  const filename = `signed/${contract.id}.pdf`;
  const { error: uploadError } = await admin.storage
    .from("contracts")
    .upload(filename, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadError) {
    return NextResponse.json(
      { error: `PDF upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const { data: pub } = admin.storage.from("contracts").getPublicUrl(filename);
  const pdfUrl = pub.publicUrl;

  // Update contract record
  const { error: updateError } = await admin
    .from("contracts")
    .update({
      status: newStatus,
      signed_at: signedAt,
      paid_at: paidAt,
      pdf_url: pdfUrl,
      signature_data: signature_data_url,
    })
    .eq("id", contract.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Look up closer email for the notification
  const { data: closer } = await admin
    .from("users")
    .select("email,name")
    .eq("id", contract.closer_id)
    .single();

  // Fire and forget emails (but await so we surface errors)
  try {
    await sendCompletionEmails({
      contract: { ...contract, pdf_url: pdfUrl, signed_at: signedAt, paid_at: paidAt } as Contract,
      closerEmail: closer?.email ?? null,
      closerName: closer?.name ?? null,
      pdfBuffer,
    });
  } catch (e: any) {
    // Don't fail the user — contract is already complete. Log via response.
    return NextResponse.json({ ok: true, emailWarning: e?.message ?? "Email send failed" });
  }

  return NextResponse.json({ ok: true });
}
