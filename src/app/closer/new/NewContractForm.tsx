"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PaymentStructure =
  | "Full Upfront"
  | "50% Upfront + Financed Balance"
  | "Full Financing via Stripe";
type GuaranteeType =
  | "We Work With You Free Until You Hit Your Score"
  | "No Guarantee";
type SendOption = "contract_only" | "payment_only" | "both";

type TrackType =
  | "standard"
  | "compressed"
  | "below_floor"
  | "insufficient_data"
  | "manual"
  | "manual_incomplete";

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
  const [testDate, setTestDate] = useState("");
  // Manual program-structure inputs used when current SAT score is missing
  // (so the auto-calculator can't run). Closer fills every field explicitly.
  const [manualWeeks, setManualWeeks] = useState<number | "">("");
  const [manualSessionsPerWeek, setManualSessionsPerWeek] = useState<1 | 2 | 3 | "">("");
  const [manualSessionLength, setManualSessionLength] = useState<1 | 1.5 | 2 | "">("");
  const [manualTotalHours, setManualTotalHours] = useState<number | "">("");

  // Section 3
  const [totalPrice, setTotalPrice] = useState<number | "">("");
  const [paymentStructure, setPaymentStructure] =
    useState<PaymentStructure>("Full Upfront");
  const [upfrontAmount, setUpfrontAmount] = useState<number | "">("");
  const [financingDetails, setFinancingDetails] = useState("");

  // Section 4
  const [guaranteeType, setGuaranteeType] = useState<GuaranteeType>(
    "We Work With You Free Until You Hit Your Score"
  );

  // Section 5
  const [trialWindow, setTrialWindow] = useState<"Yes" | "No">("Yes");
  const [showCancellationRefundTerms, setShowCancellationRefundTerms] =
    useState<"Yes" | "No">("Yes");

  // Section 6 — Sending method
  const [sendOption, setSendOption] = useState<SendOption>("both");

  const pointGap =
    typeof targetScore === "number" && typeof currentScore === "number"
      ? targetScore - currentScore
      : null;

  const manualMode = typeof currentScore !== "number";

  const program = useMemo(() => {
    if (manualMode) {
      // No diagnostic score → closer fills every program field by hand.
      const weeksOk = typeof manualWeeks === "number" && manualWeeks > 0;
      const sessionsOk = typeof manualSessionsPerWeek === "number";
      const lengthOk = typeof manualSessionLength === "number";
      const hoursOk = typeof manualTotalHours === "number" && manualTotalHours > 0;
      if (!weeksOk || !sessionsOk || !lengthOk || !hoursOk || !testDate) {
        return {
          trackType: "manual_incomplete" as TrackType,
          standardMonths: 0,
          floorWeeks: 0,
          availableWeeks: 0,
          sessionsPerWeek: 0,
          totalHours: 0,
          programDuration: "",
        };
      }
      return {
        trackType: "manual" as TrackType,
        standardMonths: 0,
        floorWeeks: 0,
        availableWeeks: getAvailableWeeks(agreementDate, testDate),
        sessionsPerWeek: manualSessionsPerWeek,
        totalHours: manualTotalHours,
        programDuration: `${manualWeeks} week${manualWeeks === 1 ? "" : "s"}`,
      };
    }
    if (
      pointGap === null ||
      typeof currentScore !== "number" ||
      !agreementDate ||
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
    const availableWeeks = getAvailableWeeks(agreementDate, testDate);
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
  }, [
    manualMode,
    manualWeeks,
    manualSessionsPerWeek,
    manualSessionLength,
    manualTotalHours,
    pointGap,
    currentScore,
    agreementDate,
    testDate,
  ]);

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
    program.trackType === "insufficient_data" ||
    program.trackType === "manual_incomplete";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (
      !parentName ||
      !parentEmail ||
      !parentPhone ||
      !studentName ||
      targetScore === "" ||
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
    if (
      (sendOption === "payment_only" || sendOption === "both") &&
      amountDueAtSigning <= 0
    ) {
      setError(
        "A Stripe payment link needs a non-zero amount due at signing. Choose 'Contract only' for full-financing plans with $0 due now."
      );
      return;
    }

    setSubmitting(true);
    const payload = {
      parent_name: parentName,
      parent_email: parentEmail,
      parent_phone: parentPhone,
      agreement_date: agreementDate,
      student_name: studentName,
      current_score: typeof currentScore === "number" ? currentScore : null,
      target_score: Number(targetScore),
      program_duration: computedProgramDuration,
      sessions_per_week: computedSessionsPerWeek,
      session_length:
        manualMode && typeof manualSessionLength === "number"
          ? manualSessionLength
          : 1,
      total_hours: computedTotalHours,
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
      trial_window: trialWindow === "Yes",
      show_cancellation_refund_terms: showCancellationRefundTerms === "Yes",
      send_option: sendOption,
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
        <Field label="Current SAT Score (Diagnostic) — optional">
          <input
            type="number"
            className="input"
            value={currentScore}
            placeholder="Leave blank if no diagnostic yet"
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
        subtitle="Target SAT date drives program structure and guarantees."
      >
        <Field label="Target SAT Test Date">
          <input
            required
            type="date"
            className="input"
            value={testDate}
            onChange={(e) => setTestDate(e.target.value)}
          />
        </Field>

        {manualMode && (
          <>
            <Field label="Program Duration (weeks)">
              <input
                type="number"
                min={1}
                className="input"
                value={manualWeeks}
                placeholder="e.g. 12"
                onChange={(e) =>
                  setManualWeeks(e.target.value === "" ? "" : Number(e.target.value))
                }
              />
            </Field>
            <Field label="Sessions Per Week">
              <select
                className="input"
                value={manualSessionsPerWeek}
                onChange={(e) => {
                  const v = e.target.value;
                  setManualSessionsPerWeek(v === "" ? "" : (Number(v) as 1 | 2 | 3));
                }}
              >
                <option value="">Select…</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </Field>
            <Field label="Session Length (hours)">
              <select
                className="input"
                value={manualSessionLength}
                onChange={(e) => {
                  const v = e.target.value;
                  setManualSessionLength(v === "" ? "" : (Number(v) as 1 | 1.5 | 2));
                }}
              >
                <option value="">Select…</option>
                <option value={1}>1</option>
                <option value={1.5}>1.5</option>
                <option value={2}>2</option>
              </select>
            </Field>
            <Field label="Total Program Hours">
              <input
                type="number"
                step="0.5"
                min={1}
                className="input"
                value={manualTotalHours}
                placeholder="e.g. 24"
                onChange={(e) =>
                  setManualTotalHours(
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
              />
            </Field>
          </>
        )}

        <div className="md:col-span-2">
          {program.trackType === "insufficient_data" && (
            <div className="rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-600">
              Enter the target SAT score and test date to calculate the program
              structure.
            </div>
          )}
          {program.trackType === "manual_incomplete" && (
            <div className="rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-600">
              No diagnostic score — fill in every program field above
              (duration, sessions per week, session length, total hours) and
              the target SAT test date.
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
            <option>We Work With You Free Until You Hit Your Score</option>
            <option>No Guarantee</option>
          </select>
        </Field>
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

      <FormSection
        title="6. Sending Method"
        subtitle="Choose what the parent receives right now. You can send the other piece later from the contract page."
      >
        <div className="md:col-span-2 space-y-2">
          <SendOptionCard
            value="both"
            current={sendOption}
            onChange={setSendOption}
            label="Send contract & payment link together"
            description="Parent gets two emails right now: the signing link and the direct Stripe payment link."
          />
          <SendOptionCard
            value="contract_only"
            current={sendOption}
            onChange={setSendOption}
            label="Send contract only — payment link later"
            description="Parent gets the signing link now. You can email the Stripe payment link from the contract page after they sign."
          />
          <SendOptionCard
            value="payment_only"
            current={sendOption}
            onChange={setSendOption}
            label="Send payment link first — contract later"
            description="Parent gets a direct Stripe payment link now. You can email the contract for signing afterwards."
          />
        </div>
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
          {submitting
            ? "Sending…"
            : sendOption === "contract_only"
            ? "Generate & email contract"
            : sendOption === "payment_only"
            ? "Generate & email payment link"
            : "Generate & email contract + payment link"}
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

function SendOptionCard({
  value,
  current,
  onChange,
  label,
  description,
}: {
  value: SendOption;
  current: SendOption;
  onChange: (v: SendOption) => void;
  label: string;
  description: string;
}) {
  const selected = current === value;
  return (
    <label
      className={
        "flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition " +
        (selected
          ? "border-navy bg-navy/5"
          : "border-slate-200 hover:border-slate-300")
      }
    >
      <input
        type="radio"
        name="send_option"
        className="mt-1 h-4 w-4 text-navy focus:ring-navy/30"
        checked={selected}
        onChange={() => onChange(value)}
      />
      <div>
        <div className="font-medium text-slate-800">{label}</div>
        <div className="text-sm text-slate-500">{description}</div>
      </div>
    </label>
  );
}
