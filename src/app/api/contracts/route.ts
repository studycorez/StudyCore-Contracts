import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendContractEmail } from "@/lib/email";

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

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contracts")
    .insert({
      ...body,
      closer_id: me.id,
      status: "sent",
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not save contract." },
      { status: 400 }
    );
  }

  try {
    await sendContractEmail({
      contract: data,
      closerName: me.name,
    });
  } catch (e: any) {
    // Roll back? We keep the contract so admin can resend, but report.
    return NextResponse.json(
      {
        id: data.id,
        warning: `Contract saved but email failed: ${e?.message ?? "unknown error"}`,
      },
      { status: 207 }
    );
  }

  return NextResponse.json({ id: data.id });
}
