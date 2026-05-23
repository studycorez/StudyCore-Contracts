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
type TestType = "SAT" | "ACT";

const today = () => new Date().toISOString().slice(0, 10);

export default function NewContractForm({ closerName }: { closerName: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Test type drives all score / agreement labels for this contract.
  const [testType, setTestType] = useState<TestType>("SAT");

  // Section 1
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [agreementDate, setAgreementDate] = useState(today());
  const [studentName, setStudentName] = useState("");
  const [currentScore, setCurrentScore] = useState<number | "">("");
  const [targetScore, setTargetScore] = useState<number | "">("");

  // Section 2 — Program (closer enters every field, no auto-calculation)
  const [testDate, setTestDate] = useState("");
  const [programWeeks, setProgramWeeks] = useState<number | "">("");
  const [sessionsPerWeek, setSessionsPerWeek] = useState<number | "">("");
  const [sessionLength, setSessionLength] = useState<number | "">("");
  const [totalHours, setTotalHours] = useState<number | "">("");

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

  const programDuration =
    typeof programWeeks === "number" && programWeeks > 0
      ? `${programWeeks} week${programWeeks === 1 ? "" : "s"}`
      : "";

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
      !testDate ||
      totalPrice === "" ||
      programWeeks === "" ||
      sessionsPerWeek === "" ||
      sessionLength === "" ||
      totalHours === ""
    ) {
      setError("Please complete every required field.");
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
      test_type: testType,
      parent_name: parentName,
      parent_email: parentEmail,
      parent_phone: parentPhone,
      agreement_date: agreementDate,
      student_name: studentName,
      current_score: typeof currentScore === "number" ? currentScore : null,
      target_score: Number(targetScore),
      program_duration: programDuration,
      sessions_per_week: Number(sessionsPerWeek),
      session_length: Number(sessionLength),
      total_hours: Number(totalHours),
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
      <FormSection
        title="Test Type"
        subtitle="Pick which standardized test this contract covers. This drives the agreement title, score labels, Stripe product name, and all email copy."
      >
        <div className="md:col-span-2 grid grid-cols-2 gap-3">
          <TestTypeCard
            value="SAT"
            current={testType}
            onChange={setTestType}
            label="SAT"
            description="Composite 400–1600. Tutor claim: SAT 1550+. Score reports via College Board."
          />
          <TestTypeCard
            value="ACT"
            current={testType}
            onChange={setTestType}
            label="ACT"
            description="Composite 1–36. Tutor claim: ACT 34+. Score reports via ACT, Inc."
          />
        </div>
      </FormSection>

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
        <Field label={`Current ${testType} Score (Diagnostic) — optional`}>
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
        <Field label={`Target ${testType} Score`}>
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
        subtitle="Closer chooses every program detail. No auto-calculation or score-based restrictions."
      >
        <Field label={`Target ${testType} Test Date`}>
          <input
            required
            type="date"
            className="input"
            value={testDate}
            onChange={(e) => setTestDate(e.target.value)}
          />
        </Field>
        <Field label="Program Duration (weeks)">
          <input
            required
            type="number"
            min={1}
            className="input"
            value={programWeeks}
            placeholder="e.g. 12"
            onChange={(e) =>
              setProgramWeeks(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </Field>
        <Field label="Sessions Per Week">
          <input
            required
            type="number"
            step="0.5"
            min={0.5}
            className="input"
            value={sessionsPerWeek}
            placeholder="e.g. 2"
            onChange={(e) =>
              setSessionsPerWeek(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </Field>
        <Field label="Session Length (hours)">
          <input
            required
            type="number"
            step="0.25"
            min={0.25}
            className="input"
            value={sessionLength}
            placeholder="e.g. 1"
            onChange={(e) =>
              setSessionLength(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </Field>
        <Field label="Total Program Hours">
          <input
            required
            type="number"
            step="0.5"
            min={1}
            className="input"
            value={totalHours}
            placeholder="e.g. 24"
            onChange={(e) =>
              setTotalHours(e.target.value === "" ? "" : Number(e.target.value))
            }
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
            typeof totalHours === "number" &&
            totalHours > 0
              ? `Show Cancellation Refund Terms (rate: $${(
                  Number(totalPrice) / Number(totalHours)
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
          disabled={submitting}
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

function TestTypeCard({
  value,
  current,
  onChange,
  label,
  description,
}: {
  value: TestType;
  current: TestType;
  onChange: (v: TestType) => void;
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
        name="test_type"
        className="mt-1 h-4 w-4 text-navy focus:ring-navy/30"
        checked={selected}
        onChange={() => onChange(value)}
      />
      <div>
        <div className="font-semibold text-slate-800">{label}</div>
        <div className="text-sm text-slate-500">{description}</div>
      </div>
    </label>
  );
}
