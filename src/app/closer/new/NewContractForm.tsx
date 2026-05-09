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

const today = () => new Date().toISOString().slice(0, 10);

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
  const [targetScore, setTargetScore] = useState<number | "">("");

  // Section 2
  const [programDuration, setProgramDuration] = useState("10 weeks");
  const [sessionsPerWeek, setSessionsPerWeek] = useState<number>(2);
  const [sessionLength, setSessionLength] = useState<number>(1.5);
  const [totalHoursOverride, setTotalHoursOverride] = useState<string>("");
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

  const weeksMatch = programDuration.match(/([\d.]+)/);
  const weeks = weeksMatch ? Number(weeksMatch[1]) : 0;

  const computedHours = useMemo(() => {
    const auto = weeks * sessionsPerWeek * sessionLength;
    return Number.isFinite(auto) ? Math.round(auto * 10) / 10 : 0;
  }, [weeks, sessionsPerWeek, sessionLength]);

  const totalHours = totalHoursOverride === "" ? computedHours : Number(totalHoursOverride);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (
      !parentName ||
      !parentEmail ||
      !parentPhone ||
      !studentName ||
      targetScore === "" ||
      !programDuration ||
      !startDate ||
      !endDate ||
      !testDate ||
      totalPrice === ""
    ) {
      setError("Please complete every required field.");
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
      program_duration: programDuration,
      sessions_per_week: sessionsPerWeek,
      session_length: sessionLength,
      total_hours: totalHours,
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

      <FormSection title="2. Program" subtitle="Schedule and duration.">
        <Field label="Program Duration (e.g. '10 weeks')">
          <input
            required
            className="input"
            value={programDuration}
            onChange={(e) => setProgramDuration(e.target.value)}
          />
        </Field>
        <Field label="Sessions Per Week">
          <select
            className="input"
            value={sessionsPerWeek}
            onChange={(e) => setSessionsPerWeek(Number(e.target.value))}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </Field>
        <Field label="Session Length">
          <select
            className="input"
            value={sessionLength}
            onChange={(e) => setSessionLength(Number(e.target.value))}
          >
            <option value={1}>1 hr</option>
            <option value={1.5}>1.5 hrs</option>
            <option value={2}>2 hrs</option>
          </select>
        </Field>
        <Field label={`Total Program Hours (auto: ${computedHours})`}>
          <input
            type="number"
            step="0.5"
            placeholder={String(computedHours)}
            className="input"
            value={totalHoursOverride}
            onChange={(e) => setTotalHoursOverride(e.target.value)}
          />
        </Field>
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
            showCancellationRefundTerms === "Yes" && totalPrice !== "" && totalHours > 0
              ? `Show Cancellation Refund Terms (rate: $${(
                  Number(totalPrice) / totalHours
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
        <button type="submit" className="btn-primary" disabled={submitting}>
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
