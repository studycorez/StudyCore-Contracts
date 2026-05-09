"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PaymentStructure =
  | "Full Upfront"
  | "50% Upfront + Financed Balance"
  | "Full Financing via Stripe";
type GuaranteeType =
  | "Score Improvement Guarantee"
  | "Full Refund Guarantee"
  | "No Guarantee";

type TrackType = "standard" | "compressed" | "below_floor" | "insufficient_data";

const today = () => new Date().toISOString().slice(0, 10);

function getStandardMonths(gap: number, currentScore: number): number {
  if (gap <= 100) return currentScore >= 1400 ? 2 : 1;
  if (gap <= 200) return 3;
  if (gap <= 250) return 4;
  if (gap <= 300) return 5;
  if (gap <= 350) return 5;
  return 6; // 351–400
}

function getFloorWeeks(gap: number, currentScore: number): number {
  if (gap <= 100) return currentScore >= 1400 ? 6 : 4;
  if (gap <= 200) return 10;
  if (gap <= 300) return 14;
  return 18; // 301–400
}

function getAvailableWeeks(start: string, test: string): number {
  if (!start || !test) return 0;
  const s = new Date(start);
  const t = new Date(test);
  if (isNaN(s.getTime()) || isNaN(t.getTime())) return 0;
  const ms = t.getTime() - s.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
}

export default function NewContractForm({ closerName }: { closerName: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Section 1
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [agreementDate, setAgreementDate] = useState(today());
  const [studentName, setStudentName] = useState("");
  const [currentScore, setCurrentScore] = useState<number | "">("");
  const [targetScore, setTargetScore] = useState<number | "">("");

  // Section 2
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState("");
  const [testDate, setTestDate] = useState("");

  // Section 3
  const [totalPrice, setTotalPrice] = useState<number | "">("");
  const [paymentStructure, setPaymentStructure] =
    useState<PaymentStructure>("Full Upfront");
  const [upfrontAmount, setUpfrontAmount] = useState<number | "">("");
  const [financingDetails, setFinancingDetails] = useState("");

  // Section 4
  const [guaranteeType, setGuaranteeType] =
    useState<GuaranteeType>("Score Improvement Guarantee");
  const [guaranteedTargetScore, setGuaranteedTargetScore] = useState<number | "">("");

  // Section 5
  const [trialWindow, setTrialWindow] = useState<"Yes" | "No">("Yes");
  const [showCancellationRefundTerms, setShowCancellationRefundTerms] =
    useState<"Yes" | "No">("Yes");

  const pointGap =
    typeof targetScore === "number" && typeof currentScore === "number"
      ? targetScore - currentScore
      : null;

  const program = useMemo(() => {
    if (
      pointGap === null ||
      typeof currentScore !== "number" ||
      !startDate ||
      !testDate
    ) {
      return {
        trackType: "insufficient_data" as TrackType,
        standardMonths: 0,
        floorWeeks: 0,
        availableWeeks: 0,
        sessionsPerWeek: 0,
        totalHours: 0,
        programDuration: "",
      };
    }
    const standardMonths = getStandardMonths(pointGap, currentScore);
    const floorWeeks = getFloorWeeks(pointGap, currentScore);
    const availableWeeks = getAvailableWeeks(startDate, testDate);
    if (availableWeeks < floorWeeks) {
      return {
        trackType: "below_floor" as TrackType,
        standardMonths,
        floorWeeks,
        availableWeeks,
        sessionsPerWeek: 0,
        totalHours: 0,
        programDuration: "",
      };
    }
    if (availableWeeks >= standardMonths * 4) {
      return {
        trackType: "standard" as TrackType,
        standardMonths,
        floorWeeks,
        availableWeeks,
        sessionsPerWeek: 2,
        totalHours: standardMonths * 8,
        programDuration: `${standardMonths} months (${standardMonths * 4} weeks)`,
      };
    }
    return {
      trackType: "compressed" as TrackType,
      standardMonths,
      floorWeeks,
      availableWeeks,
      sessionsPerWeek: 3,
      totalHours: standardMonths * 8,
      programDuration: `${standardMonths} months compressed into ${availableWeeks} weeks (3 sessions/week)`,
    };
  }, [pointGap, currentScore, startDate, testDate]);

  const computedProgramDuration = program.programDuration;
  const computedSessionsPerWeek = program.sessionsPerWeek;
  const computedTotalHours = program.totalHours;

  const remainingBalance = useMemo(() => {
    if (paymentStructure !== "50% Upfront + Financed Balance") return null;
    if (totalPrice === "" || upfrontAmount === "") return null;
    const v = Number(totalPrice) - Number(upfrontAmount);
    return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  }, [totalPrice, upfrontAmount, paymentStructure]);

  const amountDueAtSigning = useMemo(() => {
    if (totalPrice === "" || totalPrice === null) return 0;
    if (paymentStructure === "Full Upfront") return Number(totalPrice);
    if (paymentStructure === "50% Upfront + Financed Balance") {
      return upfrontAmount === ""
        ? Math.round((Number(totalPrice) / 2) * 100) / 100
        : Number(upfrontAmount);
    }
    return 0; // Full financing — no amount due at signing here
  }, [totalPrice, upfrontAmount, paymentStructure]);

  const submitBlocked =
    program.trackType === "below_floor" ||
    program.trackType === "insufficient_data";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (
      !parentName ||
      !parentEmail ||
      !parentPhone ||
      !studentName ||
      currentScore === "" ||
      targetScore === "" ||
      !startDate ||
      !endDate ||
      !testDate ||
      totalPrice === ""
    ) {
      setError("Please complete every required field.");
      return;
    }
    if (submitBlocked) {
      setError(
        "Program structure cannot be calculated for this student. Resolve the program section before submitting."
      );
      return;
    }
    if (paymentStructure === "50% Upfront + Financed Balance" && upfrontAmount === "") {
      setError("Enter the upfront amount for the 50/50 plan.");
      return;
    }
    if (guaranteeType === "Full Refund Guarantee" && guaranteedTargetScore === "") {
      setError("Enter the guaranteed target score for the full refund guarantee.");
      return;
    }

    setSubmitting(true);
    const payload = {
      parent_name: parentName,
      parent_email: parentEmail,
      parent_phone: parentPhone,
      agreement_date: agreementDate,
      student_name: studentName,
      target_score: Number(targetScore),
      program_duration: computedProgramDuration,
      sessions_per_week: computedSessionsPerWeek,
      session_length: 1,
      total_hours: computedTotalHours,
      start_date: startDate,
      end_date: endDate,
      test_date: testDate,
      total_price: Number(totalPrice),
      payment_structure: paymentStructure,
      upfront_amount:
        paymentStructure === "50% Upfront + Financed Balance" ? Number(upfrontAmount) : null,
      remaining_balance: remainingBalance,
      financing_details:
        paymentStructure === "Full Financing via Stripe" ? financingDetails : null,
      amount_due_at_signing: amountDueAtSigning,
      guarantee_type: guaranteeType,
      guaranteed_target_score:
        guaranteeType === "Full Refund Guarantee" ? Number(guaranteedTargetScore) : null,
      trial_window: trialWindow === "Yes",
      show_cancellation_refund_terms: showCancellationRefundTerms === "Yes",
    };

    const res = await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(json.error ?? "Could not create contract.");
      return;
    }
    router.push(`/closer/contracts/${json.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormSection title="1. Parties" subtitle="Closer and parent details.">
        <Field label="Closer Name">
          <input className="input" value={closerName} disabled />
        </Field>
        <Field label="Parent / Guardian Full Name">
          <input
            required
            className="input"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
          />
        </Field>
        <Field label="Parent Email">
          <input
            required
            type="email"
            className="input"
            value={parentEmail}
            onChange={(e) => setParentEmail(e.target.value)}
          />
        </Field>
        <Field label="Parent Phone">
          <input
            required
            className="input"
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
          />
        </Field>
        <Field label="Agreement Date">
          <input
            required
            type="date"
            className="input"
            value={agreementDate}
            onChange={(e) => setAgreementDate(e.target.value)}
          />
        </Field>
        <Field label="Student Full Name">
          <input
            required
            className="input"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
          />
        </Field>
        <Field label="Current SAT Score (Diagnostic)">
          <input
            required
            type="number"
            className="input"
            value={currentScore}
            onChange={(e) =>
              setCurrentScore(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </Field>
        <Field label="Target SAT Score">
          <input
            required
            type="number"
            className="input"
            value={targetScore}
            onChange={(e) =>
              setTargetScore(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </Field>
      </FormSection>

      <FormSection
        title="2. Program"
        subtitle="Schedule and auto-calculated program structure."
      >
        <Field label="Program Start Date">
          <input
            required
            type="date"
            className="input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field label="Estimated End Date">
          <input
            required
            type="date"
            className="input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Field>
        <Field label="Target SAT Test Date">
          <input
            required
            type="date"
            className="input"
            value={testDate}
            onChange={(e) => setTestDate(e.target.value)}
          />
        </Field>

        <div className="md:col-span-2">
          {program.trackType === "insufficient_data" && (
            <div className="rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-600">
              Enter the student&apos;s current score, target score, start date, and
              test date to calculate the program structure.
            </div>
          )}

          {program.trackType === "below_floor" && (
            <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
              <div className="font-semibold">
                ⚠️ This student does not meet the minimum timeline for a full program.
              </div>
              <p className="mt-1">
                The test date is too close for the required minimum of{" "}
                {program.floorWeeks} weeks. You may only offer the Targeted Intensive
                option — not a full program. Do not proceed with a full contract for
                this student.
              </p>
            </div>
          )}

          {(program.trackType === "standard" ||
            program.trackType === "compressed") && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Computed program structure
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-slate-700">
                <dt className="text-slate-500">Point Gap</dt>
                <dd className="font-medium">{pointGap}</dd>
                <dt className="text-slate-500">Track</dt>
                <dd className="font-medium">
                  {program.trackType === "standard" ? "Standard" : "Compressed"}
                </dd>
                <dt className="text-slate-500">Program Duration</dt>
                <dd className="font-medium">{computedProgramDuration}</dd>
                <dt className="text-slate-500">Sessions Per Week</dt>
                <dd className="font-medium">{computedSessionsPerWeek}</dd>
                <dt className="text-slate-500">Session Length</dt>
                <dd className="font-medium">1 hour</dd>
                <dt className="text-slate-500">Total Program Hours</dt>
                <dd className="font-medium">{computedTotalHours}</dd>
              </dl>
            </div>
          )}
        </div>
      </FormSection>

      <FormSection title="3. Payment" subtitle="Total investment and how it's collected.">
        <Field label="Total Program Investment ($)">
          <input
            required
            type="number"
            step="0.01"
            className="input"
            value={totalPrice}
            onChange={(e) =>
              setTotalPrice(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </Field>
        <Field label="Payment Structure">
          <select
            className="input"
            value={paymentStructure}
            onChange={(e) => setPaymentStructure(e.target.value as PaymentStructure)}
          >
            <option>Full Upfront</option>
            <option>50% Upfront + Financed Balance</option>
            <option>Full Financing via Stripe</option>
          </select>
        </Field>
        {paymentStructure === "50% Upfront + Financed Balance" && (
          <>
            <Field label="Upfront Amount ($)">
              <input
                type="number"
                step="0.01"
                className="input"
                value={upfrontAmount}
                onChange={(e) =>
                  setUpfrontAmount(e.target.value === "" ? "" : Number(e.target.value))
                }
              />
            </Field>
            <Field label="Remaining Balance">
              <input
                disabled
                className="input"
                value={remainingBalance ?? ""}
                placeholder="Auto-calculated"
              />
            </Field>
          </>
        )}
        {paymentStructure === "Full Financing via Stripe" && (
          <Field label="Financing Plan Details" full>
            <textarea
              className="input min-h-[80px]"
              value={financingDetails}
              onChange={(e) => setFinancingDetails(e.target.value)}
              placeholder="e.g. 12 monthly payments of $X via Stripe Capital."
            />
          </Field>
        )}
        <Field label="Amount Due at Signing (auto)">
          <input disabled className="input" value={`$${amountDueAtSigning.toFixed(2)}`} />
        </Field>
      </FormSection>

      <FormSection title="4. Guarantee" subtitle="Choose the guarantee for this enrollment.">
        <Field label="Guarantee Type">
          <select
            className="input"
            value={guaranteeType}
            onChange={(e) => setGuaranteeType(e.target.value as GuaranteeType)}
          >
            <option>Score Improvement Guarantee</option>
            <option>Full Refund Guarantee</option>
            <option>No Guarantee</option>
          </select>
        </Field>
        {guaranteeType === "Full Refund Guarantee" && (
          <Field label="Guaranteed Target Score">
            <input
              type="number"
              className="input"
              value={guaranteedTargetScore}
              onChange={(e) =>
                setGuaranteedTargetScore(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
            />
          </Field>
        )}
      </FormSection>

      <FormSection title="5. Cancellation">
        <Field label="3-Session Trial Window Offered">
          <select
            className="input"
            value={trialWindow}
            onChange={(e) => setTrialWindow(e.target.value as "Yes" | "No")}
          >
            <option>Yes</option>
            <option>No</option>
          </select>
        </Field>
        <Field
          label={
            showCancellationRefundTerms === "Yes" &&
            totalPrice !== "" &&
            computedTotalHours > 0
              ? `Show Cancellation Refund Terms (rate: $${(
                  Number(totalPrice) / computedTotalHours
                ).toFixed(2)} / hr)`
              : "Show Cancellation Refund Terms"
          }
        >
          <select
            className="input"
            value={showCancellationRefundTerms}
            onChange={(e) =>
              setShowCancellationRefundTerms(e.target.value as "Yes" | "No")
            }
          >
            <option>Yes</option>
            <option>No</option>
          </select>
        </Field>
      </FormSection>

      {error && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-6">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => router.push("/closer")}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={submitting || submitBlocked}
        >
          {submitting ? "Sending…" : "Generate & email contract"}
        </button>
      </div>
    </form>
  );
}

function FormSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-navy">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
