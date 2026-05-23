import type { Contract } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/format";
import { testCopy } from "@/lib/test-type";

export interface ContractClause {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

// Sensible defaults for the Free Session Guarantee template variables.
// Exposed so the renderer (page + PDF) can use the same source of truth
// when the Contract row doesn't override them.
export const FREE_SESSION_GUARANTEE_DEFAULTS = {
  attendance_threshold: 0.90,
  score_report_submission_days: 14,
} as const;

export function buildContractClauses(c: Contract): ContractClause[] {
  const copy = testCopy(c.test_type);
  const clauses: ContractClause[] = [];

  // SAT-specific section bullet mentions Desmos (built-in calculator on the
  // digital SAT). The ACT permits a physical calculator but doesn't have an
  // analogous test-day tool, so we adapt the workshop bullet text.
  const strategyWorkshopBullet =
    c.test_type === "ACT"
      ? "Strategy Workshops (pacing, process of elimination, calculator strategy, test-taking meta-skills)"
      : "Strategy Workshops (pacing, process of elimination, Desmos usage, test-taking meta-skills)";

  clauses.push({
    heading: "1. PARTIES & PROGRAM DETAILS",
    paragraphs: [
      `This ${copy.agreementTitle} ("Agreement") is entered into as of ${formatDate(
        c.agreement_date
      )} by and between StudyCore LLC, a California limited liability company ("StudyCore"), and ${c.parent_name} ("Client").`,
      `Client represents that they are the parent or legal guardian of the Student named below and is signing this Agreement on the Student's behalf. Client accepts full legal responsibility for all obligations under this Agreement.`,
      `Student Name: ${c.student_name}`,
      ...(typeof c.current_score === "number"
        ? [`Starting ${copy.name} Score: ${c.current_score} (verified at session 1 diagnostic)`]
        : [`Starting ${copy.name} Score: To be established at session 1 diagnostic`]),
      `Target ${copy.name} Score: ${c.target_score}`,
      `Parent Email: ${c.parent_email}`,
      `Parent Phone: ${c.parent_phone}`,
    ],
  });

  clauses.push({
    heading: "2. PROGRAM SCOPE & SCHEDULE",
    paragraphs: [
      `Program Duration: ${c.program_duration}`,
      `Sessions Per Week: ${c.sessions_per_week}`,
      `Session Length: ${c.session_length} hour${c.session_length === 1 ? "" : "s"}`,
      `Total Program Hours: ${c.total_hours}`,
      `Agreement Date: ${formatDate(c.agreement_date)}`,
      `Target ${copy.name} Test Date: ${formatDate(c.test_date)}`,
      `StudyCore will match the student with a vetted tutor (${copy.name} score ${copy.tutorScoreClaim}) based on diagnostic results after program commencement. The session 1 diagnostic is administered and proctored live by the assigned tutor and serves as the verified baseline score for all guarantee purposes. The guarantee does not activate until this diagnostic is completed.`,
    ],
  });

  clauses.push({
    heading: "3. SERVICES INCLUDED",
    paragraphs: [],
    bullets: [
      `1-on-1 tutoring sessions with a matched, vetted tutor (${copy.name} score ${copy.tutorScoreClaim})`,
      "Session 1 diagnostic assessment, administered and proctored live by the assigned tutor to establish a verified baseline score",
      `Access to group ${copy.groupSessionPrefix} preparation sessions at no additional cost, included throughout the program. Group session types include: ${strategyWorkshopBullet}, Practice Test Review (tutor-led review of recent practice tests), and Office Hours / Q&A (open format for homework questions)`,
      "Full-length practice tests completed independently by the student at scheduled program checkpoints",
      "Proprietary study materials, strategy guides, and drill sets via the StudyCore platform",
      "AI-powered performance analytics after each practice test",
      "Regular parent progress updates on session attendance, test scores, and improvement",
      "Access to the StudyCore student platform for scheduling, resources, and communication",
      "Sessions are recorded via Fathom for quality assurance and student progress review. Recordings are confidential and accessible only to the student, parent, and StudyCore team.",
    ],
  });

  const paymentParagraphs: string[] = [
    `Total Program Investment: ${formatMoney(c.total_price)}`,
    `Payment Structure: ${c.payment_structure}`,
  ];
  if (c.payment_structure === "50% Upfront + Financed Balance") {
    paymentParagraphs.push(
      `Upfront Payment: ${formatMoney(c.upfront_amount)} | Remaining Balance: ${formatMoney(
        c.remaining_balance
      )}`
    );
  }
  if (c.payment_structure === "Full Financing via Stripe" && c.financing_details) {
    paymentParagraphs.push(`Financing Plan: ${c.financing_details}`);
  }
  paymentParagraphs.push(`Amount Due at Signing: ${formatMoney(c.amount_due_at_signing)}`);
  paymentParagraphs.push(
    `All payments are processed securely via Stripe. Client authorizes StudyCore LLC to charge the payment method provided per the schedule above.`
  );
  // Late-payments clause only applies when there are future scheduled
  // payments (50/50 financed balance or full financing).
  if (c.payment_structure !== "Full Upfront") {
    paymentParagraphs.push(
      `Late Payments: If a scheduled payment fails, Client has a 5-day grace period to resolve the issue. If payment is not received within 5 days, sessions will be automatically paused until the outstanding balance is cleared. If payment remains unresolved after 14 days, the account will be considered delinquent and sessions suspended until resolved. Guarantee eligibility is unaffected provided payment is made within the grace period.`
    );
  }
  paymentParagraphs.push(
    `NO CHARGEBACKS: Client agrees not to initiate a chargeback, payment dispute, or reversal with their financial institution or payment provider except in cases where StudyCore LLC has failed to deliver services as outlined in this Agreement, or where both parties have agreed to a refund in writing. If StudyCore LLC fails to deliver the services described herein, this Agreement is void and Client is entitled to a full refund. Any unauthorized chargebacks will be formally contested by StudyCore LLC using this signed Agreement as evidence.`
  );

  clauses.push({
    heading: "4. PAYMENT TERMS",
    paragraphs: paymentParagraphs,
  });

  const cancellationParagraphs: string[] = [];
  if (c.trial_window) {
    cancellationParagraphs.push(
      `3-Session Trial Window: Client may cancel this Agreement for any reason within the first three (3) completed tutoring sessions and receive a full refund of all amounts paid. To initiate, Client must notify StudyCore LLC in writing at support@studycore.net. Refunds processed within 5-7 business days.`
    );
  }
  if (c.show_cancellation_refund_terms) {
    const totalHoursNum = Number(c.total_hours);
    const perHourRate =
      totalHoursNum > 0 ? Number(c.total_price) / totalHoursNum : 0;
    const rateLabel = `${formatMoney(perHourRate)} per hour (Total Program Investment / Total Program Hours)`;
    cancellationParagraphs.push(
      `Mid-Program Cancellation: Client may cancel at any time by providing written notice to support@studycore.net. Upon cancellation, Client will be refunded for all unused, prepaid session hours at the per-hour rate implied by the total program investment. Sessions already completed are non-refundable, calculated at ${rateLabel}. Future financing installments will be cancelled upon confirmed cancellation.`
    );
  }
  cancellationParagraphs.push(
    `Program Pause: Client may pause the program up to two (2) times per program, for a maximum of two (2) weeks per pause, with at least 48 hours written notice. The program end date and guarantee clock will extend by the duration of the pause. Pauses exceeding the limit will not extend the program timeline.`
  );

  clauses.push({
    heading: "5. CANCELLATION & REFUND POLICY",
    paragraphs: cancellationParagraphs,
  });

  if (c.guarantee_type === "We Work With You Free Until You Hit Your Score") {
    clauses.push({
      heading:
        "6. PERFORMANCE GUARANTEE — WE WORK WITH YOU FREE UNTIL YOU HIT YOUR SCORE",
      paragraphs: [
        `If the student does not achieve their target score on their first official ${copy.name} after program completion, StudyCore LLC will continue working with the student at no additional cost — providing unlimited access to group ${copy.groupSessionPrefix} preparation sessions including Strategy Workshops, Practice Test Review sessions, and Office Hours / Q&A — until the student achieves their target score or the next available ${copy.name} test date, whichever comes first.`,
        `This guarantee is contingent upon all of the following conditions being met:`,
      ],
      bullets: [
        "Student has a verified baseline score established by the session 1 diagnostic administered and proctored by their assigned tutor. The guarantee does not activate without a verified baseline.",
        "Student attended at least 90% of scheduled 1-on-1 sessions",
        "Student completed 100% of assigned homework, practice tests, and drill sets",
        "Tutor session logs document consistent student engagement throughout the program. If a student is marked as unengaged for more than 2 consecutive sessions, StudyCore will notify the parent in writing. Continued disengagement may result in revocation of guarantee eligibility at StudyCore's discretion with written notice.",
        `Student took their first official ${copy.name} within 60 days of program completion`,
        `Official ${copy.scoreReporter} score report submitted to StudyCore within 14 days of receiving results`,
        "Continued support is delivered through group sessions conducted at times scheduled by StudyCore. Group sessions are not convertible to 1-on-1 tutoring, refunds, account credit, or cash equivalent.",
      ],
    });
  } else {
    clauses.push({
      heading: "6. PERFORMANCE GUARANTEE",
      paragraphs: [
        `No Performance Guarantee: StudyCore LLC does not offer a performance-based guarantee for this enrollment. StudyCore remains fully committed to delivering the highest quality instruction as described in Section 3.`,
      ],
    });
  }

  // ── 7. FREE SESSION GUARANTEE ──────────────────────────────────────
  // Pull through the template variables with sensible defaults so an
  // existing contract row that doesn't set them still renders the
  // correct percentages / day counts. Sub-headings (Eligibility, Scope
  // and duration, Forfeiture) are wrapped in *...* — the page and PDF
  // renderers parse this as inline italic.
  const attendanceThreshold =
    c.attendance_threshold ?? FREE_SESSION_GUARANTEE_DEFAULTS.attendance_threshold;
  const attendancePct = Math.round(attendanceThreshold * 100);
  const reportDays =
    c.score_report_submission_days ??
    FREE_SESSION_GUARANTEE_DEFAULTS.score_report_submission_days;
  const nextTestPhrase = c.next_sat_date
    ? `the next official ${copy.name} administration following the Target Test (currently scheduled for ${c.next_sat_date})`
    : `the next official ${copy.name} administration following the Target Test`;

  clauses.push({
    heading: "7. FREE SESSION GUARANTEE",
    paragraphs: [
      `Free Session Guarantee. If Student does not achieve the Target Score of ${c.target_score} on the official ${copy.name} examination administered on ${formatDate(
        c.test_date
      )} (the "Target Test"), StudyCore will provide Student with complimentary access to group ${copy.groupSessionPrefix} preparation sessions, subject to the conditions below.`,
      `*Eligibility.* To qualify, Student must have (a) attended at least ${attendancePct}% of scheduled 1:1 tutoring sessions during the original engagement, (b) completed all assigned homework and practice materials in good faith, and (c) sat for the Target Test and submitted the official ${copy.scoreReporter} score report to StudyCore within ${reportDays} days of its release. The guarantee does not activate for students who do not have a verified baseline score established by the session 1 diagnostic.`,
      `*Scope and duration.* Complimentary group sessions — including Strategy Workshops, Practice Test Review sessions, and Office Hours / Q&A — will be provided until the earlier of (i) ${nextTestPhrase}, or (ii) the date Student achieves the Target Score on a subsequent official or full-length proctored practice ${copy.name}. Group sessions are conducted with multiple students per session at times scheduled by StudyCore and are not convertible to 1:1 tutoring, refunds, account credit, or cash equivalent.`,
      `*Forfeiture.* The guarantee terminates automatically if Student fails to register for or sit for the next official ${copy.name}, withdraws from the program, or materially breaches this Agreement.`,
    ],
  });

  clauses.push({
    heading: "8. CLIENT RESPONSIBILITIES",
    paragraphs: [`Client and Student agree to:`],
    bullets: [
      "Attend all scheduled sessions or provide at least 24 hours notice to reschedule",
      "Student may reschedule up to a maximum of 2 times per calendar month with at least 24 hours notice. Additional reschedules beyond this limit will result in the session being forfeited and counted as completed for guarantee eligibility purposes.",
      "Complete 100% of assigned practice tests, drills, and homework between sessions",
      "Complete all assigned practice tests independently outside of sessions, under timed conditions. Practice tests are never administered during live session time except for the session 1 diagnostic.",
      "Maintain active engagement during all sessions as documented by the assigned tutor",
      "Communicate promptly with their tutor and the StudyCore team",
      "Ensure Student has reliable internet and a device for online sessions",
      "Keep payment method on file current and up to date",
    ],
  });
  clauses[clauses.length - 1].paragraphs.push(
    `Sessions missed without 24-hour notice may be forfeited at StudyCore's discretion and will count as completed sessions for guarantee eligibility purposes.`
  );

  clauses.push({
    heading: "9. NON-SOLICITATION",
    paragraphs: [
      `Client agrees not to directly hire, solicit, or engage any StudyCore tutor for private tutoring services outside of StudyCore LLC during the program and for 12 months following the program end date. Violation of this clause will result in a fee equal to 6 months of the tutor's standard StudyCore rate, payable immediately upon demand.`,
    ],
  });

  clauses.push({
    heading: "10. TUTOR ASSIGNMENT & SUBSTITUTION",
    paragraphs: [
      `StudyCore LLC reserves the right to reassign a student to a different tutor if the original tutor becomes unavailable. StudyCore will notify Client of any tutor change and ensure continuity of instruction. Client may request a tutor change by contacting support@studycore.net.`,
    ],
  });

  clauses.push({
    heading: "11. SESSION RECORDING & COMMUNICATIONS CONSENT",
    paragraphs: [
      `Sessions are recorded via Fathom for quality assurance and student progress review. Recordings are confidential and accessible only to the student, parent, and StudyCore team.`,
      `Client consents to receiving program-related communications via email and SMS from StudyCore LLC, including session reminders, progress updates, and billing notifications.`,
      `Client optionally consents to StudyCore LLC using anonymized score improvement results for marketing purposes. This consent is indicated by signing this Agreement and may be revoked in writing at any time.`,
    ],
  });

  clauses.push({
    heading: "12. INTELLECTUAL PROPERTY",
    paragraphs: [
      `All materials provided by StudyCore LLC are proprietary intellectual property of StudyCore LLC. Client and Student may use materials solely for personal, non-commercial ${copy.preparationPhrase}. Reproduction, distribution, or resale without written consent is prohibited.`,
    ],
  });

  clauses.push({
    heading: "13. CONFIDENTIALITY & DATA",
    paragraphs: [
      `StudyCore LLC will keep Client and Student information confidential and will not sell or share personal data with third parties except as required to deliver services herein.`,
    ],
  });

  clauses.push({
    heading: "14. LIMITATION OF LIABILITY",
    paragraphs: [
      `StudyCore LLC's total liability shall not exceed the total amount paid by Client. StudyCore LLC is not liable for indirect, incidental, or consequential damages.`,
    ],
  });

  clauses.push({
    heading: "15. FORCE MAJEURE",
    paragraphs: [
      `Neither party shall be held liable for delays or failures in performance resulting from events outside their reasonable control, including but not limited to ${copy.scoreReporter} test cancellations, natural disasters, acts of government, or other force majeure events. In such cases, applicable deadlines, including guarantee windows, will be extended to the next reasonable opportunity.`,
    ],
  });

  clauses.push({
    heading: "16. DISPUTE RESOLUTION",
    paragraphs: [
      `Disputes shall first be attempted informally via support@studycore.net. If unresolved within 30 days, disputes shall be resolved by binding arbitration in San Ramon, California under AAA rules. Governed by California law.`,
    ],
  });

  clauses.push({
    heading: "17. ENTIRE AGREEMENT",
    paragraphs: [
      `This Agreement supersedes all prior discussions and agreements. Modifications must be in writing signed by both parties. If any provision is found unenforceable, remaining provisions remain in full force.`,
    ],
  });

  return clauses;
}
