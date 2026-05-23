import "server-only";
import { Resend } from "resend";
import type { Contract } from "@/lib/types";
import { formatMoney } from "@/lib/format";

const FROM = "StudyCore <contracts@studycore.net>";
const ADMIN_NOTIFICATION_TO = "contracts@studycore.net";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://sign.studycore.net";
}

interface InitialEmailArgs {
  contract: Contract;
  closerName: string;
}

export async function sendContractEmail({ contract, closerName }: InitialEmailArgs) {
  const resend = getResend();
  const link = `${appUrl()}/sign/${contract.signing_token}`;
  const programSummary = `${contract.program_duration} · ${contract.sessions_per_week}x/week · ${contract.session_length}-hr sessions · ${contract.total_hours} total hours`;
  const due = formatMoney(contract.amount_due_at_signing);

  const html = brandedEmail({
    preheader: `Your StudyCore SAT Agreement for ${contract.student_name} is ready to review and sign.`,
    title: `Your StudyCore SAT Agreement`,
    intro: `Hi ${escapeHtml(contract.parent_name)},`,
    paragraphs: [
      `${escapeHtml(closerName)} from StudyCore has prepared an SAT Tutoring Services Agreement for <strong>${escapeHtml(
        contract.student_name
      )}</strong>. Please review the full agreement, sign it, and submit your payment of <strong>${due}</strong> due at signing to lock in your start date.`,
      `<strong>Program summary:</strong> ${escapeHtml(programSummary)}`,
    ],
    buttonLabel: "Review & sign agreement",
    buttonHref: link,
    afterButton: `If the button doesn't work, copy and paste this link into your browser:<br><a href="${link}" style="color:#1A3C6B;word-break:break-all;">${link}</a>`,
    footer: `Questions? Reply to this email or write to support@studycore.net.`,
  });

  await resend.emails.send({
    from: FROM,
    to: contract.parent_email,
    subject: "Your StudyCore SAT Agreement — Action Required",
    html,
    replyTo: "support@studycore.net",
  });
}

interface PaymentLinkEmailArgs {
  contract: Contract;
  closerName: string;
  paymentUrl: string;
}

export async function sendPaymentLinkEmail({
  contract,
  closerName,
  paymentUrl,
}: PaymentLinkEmailArgs) {
  const resend = getResend();
  const due = formatMoney(contract.amount_due_at_signing);

  const html = brandedEmail({
    preheader: `Your secure StudyCore payment link for ${contract.student_name} is ready.`,
    title: `Reserve ${contract.student_name}'s start date`,
    intro: `Hi ${escapeHtml(contract.parent_name)},`,
    paragraphs: [
      `${escapeHtml(closerName)} from StudyCore has prepared your enrollment for <strong>${escapeHtml(
        contract.student_name
      )}</strong>. Click below to securely submit your <strong>${due}</strong> deposit via Stripe and lock in your start date.`,
      `Your full SAT Tutoring Services Agreement will follow in a separate email for review and signature.`,
    ],
    buttonLabel: "Pay deposit via Stripe",
    buttonHref: paymentUrl,
    afterButton: `If the button doesn't work, copy and paste this link into your browser:<br><a href="${paymentUrl}" style="color:#1A3C6B;word-break:break-all;">${paymentUrl}</a>`,
    footer: `Questions? Reply to this email or write to support@studycore.net.`,
  });

  await resend.emails.send({
    from: FROM,
    to: contract.parent_email,
    subject: "StudyCore — Payment Link for SAT Enrollment",
    html,
    replyTo: "support@studycore.net",
  });
}

interface CompletionEmailArgs {
  contract: Contract;
  closerEmail?: string | null;
  closerName?: string | null;
  pdfBuffer: Buffer;
}

export async function sendCompletionEmails({
  contract,
  closerEmail,
  closerName,
  pdfBuffer,
}: CompletionEmailArgs) {
  const resend = getResend();
  const filename = `StudyCore-SAT-Agreement-${contract.student_name.replace(/\s+/g, "-")}.pdf`;
  const attachment = {
    filename,
    content: pdfBuffer.toString("base64"),
  };

  const dueCents = Math.round(Number(contract.amount_due_at_signing) * 100);
  const fullyPaid = dueCents === 0 || !!contract.paid_at;

  // Parent confirmation
  await resend.emails.send({
    from: FROM,
    to: contract.parent_email,
    subject: fullyPaid
      ? "StudyCore SAT Agreement — Signed & Confirmed"
      : "StudyCore SAT Agreement — Signed (Payment Pending)",
    html: brandedEmail({
      preheader: fullyPaid
        ? "Your enrollment is confirmed."
        : "Your signed agreement is attached. Payment to follow.",
      title: fullyPaid
        ? "You're enrolled — welcome to StudyCore!"
        : "Your agreement is signed.",
      intro: `Hi ${escapeHtml(contract.parent_name)},`,
      paragraphs: fullyPaid
        ? [
            `Thank you for signing your StudyCore SAT Agreement for <strong>${escapeHtml(
              contract.student_name
            )}</strong>. Your payment of <strong>${formatMoney(
              contract.amount_due_at_signing
            )}</strong> has been received and your enrollment is confirmed.`,
            `A copy of your fully signed agreement is attached for your records. Our team will reach out within 24 hours to schedule your first session and match your tutor.`,
          ]
        : [
            `Thank you for signing your StudyCore SAT Agreement for <strong>${escapeHtml(
              contract.student_name
            )}</strong>. A copy of your signed agreement is attached for your records.`,
            `Your StudyCore contact will send you a secure Stripe payment link separately to complete the <strong>${formatMoney(
              contract.amount_due_at_signing
            )}</strong> due at signing. Enrollment is confirmed once payment is received.`,
          ],
      buttonLabel: "Visit StudyCore",
      buttonHref: "https://studycore.net",
      footer: "Questions? Email support@studycore.net any time.",
    }),
    attachments: [attachment],
    replyTo: "support@studycore.net",
  });

  // Admin / internal notification
  const adminRecipients = Array.from(
    new Set([ADMIN_NOTIFICATION_TO, closerEmail].filter(Boolean) as string[])
  );
  await resend.emails.send({
    from: FROM,
    to: adminRecipients,
    subject: fullyPaid
      ? `Signed & paid: ${contract.student_name} (${contract.parent_name})`
      : `Signed (payment pending): ${contract.student_name} (${contract.parent_name})`,
    html: brandedEmail({
      preheader: fullyPaid
        ? "A contract was signed and paid."
        : "A contract was signed; payment still owed.",
      title: fullyPaid ? "Contract signed" : "Contract signed — payment pending",
      intro: fullyPaid
        ? `A new StudyCore SAT Agreement has been signed and paid.`
        : `A new StudyCore SAT Agreement has been signed. Payment has not been received yet — send the Stripe payment link from the contract page.`,
      paragraphs: [
        `<strong>Student:</strong> ${escapeHtml(contract.student_name)}<br>
         <strong>Parent:</strong> ${escapeHtml(contract.parent_name)} (${escapeHtml(
          contract.parent_email
        )})<br>
         <strong>Closer:</strong> ${escapeHtml(closerName ?? "—")}<br>
         <strong>Total:</strong> ${formatMoney(contract.total_price)}<br>
         <strong>Due at signing:</strong> ${formatMoney(
           contract.amount_due_at_signing
         )}<br>
         <strong>Payment status:</strong> ${
           fullyPaid ? "Collected" : "Pending — send payment link"
         }`,
      ],
      buttonLabel: "Open admin dashboard",
      buttonHref: `${appUrl()}/admin/contracts/${contract.id}`,
      footer: "StudyCore Contracts",
    }),
    attachments: [attachment],
    replyTo: "support@studycore.net",
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface BrandedEmailArgs {
  preheader: string;
  title: string;
  intro: string;
  paragraphs: string[];
  buttonLabel?: string;
  buttonHref?: string;
  afterButton?: string;
  footer: string;
}

function brandedEmail({
  preheader,
  title,
  intro,
  paragraphs,
  buttonLabel,
  buttonHref,
  afterButton,
  footer,
}: BrandedEmailArgs) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:#0f172a;">
  <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;">${escapeHtml(
    preheader
  )}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06);">
        <tr><td style="background:#1A3C6B;padding:28px 32px;color:#fff;">
          <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;opacity:.85;">StudyCore LLC</div>
          <div style="font-size:22px;font-weight:700;margin-top:4px;">SAT Tutoring Agreement</div>
        </td></tr>
        <tr><td style="padding:32px;font-size:15px;line-height:1.6;">
          <h1 style="font-size:22px;margin:0 0 16px;color:#0f172a;">${escapeHtml(title)}</h1>
          <p style="margin:0 0 12px;">${intro}</p>
          ${paragraphs.map((p) => `<p style="margin:0 0 14px;">${p}</p>`).join("")}
          ${
            buttonLabel && buttonHref
              ? `<div style="margin:28px 0;">
                  <a href="${buttonHref}" style="display:inline-block;background:#F97316;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 22px;border-radius:10px;">${escapeHtml(
                  buttonLabel
                )}</a>
                </div>`
              : ""
          }
          ${
            afterButton
              ? `<p style="margin:0;color:#64748b;font-size:13px;">${afterButton}</p>`
              : ""
          }
        </td></tr>
        <tr><td style="padding:18px 32px 28px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;">
          ${escapeHtml(footer)}<br>
          StudyCore LLC · San Ramon, CA · <a href="https://studycore.net" style="color:#1A3C6B;text-decoration:none;">studycore.net</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
