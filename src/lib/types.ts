export type UserRole = "admin" | "closer" | "parent";

export type ContractStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "signed"
  | "completed";

export type PaymentStructure =
  | "Full Upfront"
  | "50% Upfront + Financed Balance"
  | "Full Financing via Stripe";

export type GuaranteeType =
  | "We Work With You Free Until You Hit Your Score"
  | "No Guarantee";

export type SendOption = "contract_only" | "payment_only" | "both";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  created_at: string;
}

export interface Contract {
  id: string;
  closer_id: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  student_name: string;
  current_score: number | null;
  target_score: number;
  program_duration: string;
  sessions_per_week: number;
  session_length: number;
  total_hours: number;
  test_date: string;
  total_price: number;
  payment_structure: PaymentStructure;
  upfront_amount: number | null;
  remaining_balance: number | null;
  financing_details: string | null;
  amount_due_at_signing: number;
  guarantee_type: GuaranteeType;
  trial_window: boolean;
  show_cancellation_refund_terms: boolean;
  // Free Session Guarantee template variables. Optional with sensible
  // defaults applied at clause-build time, so existing contracts that
  // don't set them still render correctly.
  attendance_threshold?: number;            // e.g. 0.90  → 90%
  next_sat_date?: string;                   // e.g. "May 3, 2026"
  score_report_submission_days?: number;    // e.g. 14
  status: ContractStatus;
  send_option: SendOption;
  contract_sent_at: string | null;
  payment_link_sent_at: string | null;
  signed_at: string | null;
  paid_at: string | null;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_checkout_url: string | null;
  pdf_url: string | null;
  signing_token: string;
  created_at: string;
  agreement_date: string;
  closer_name?: string;
  signature_data?: string | null;
}
