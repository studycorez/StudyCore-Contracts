import "server-only";
import Stripe from "stripe";
import type { Contract } from "@/lib/types";
import { testCopy } from "@/lib/test-type";

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeSingleton) return stripeSingleton;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  stripeSingleton = new Stripe(key, {
    apiVersion: "2024-06-20",
    typescript: true,
  });
  return stripeSingleton;
}

interface CreateCheckoutArgs {
  contract: Pick<
    Contract,
    | "id"
    | "student_name"
    | "parent_email"
    | "amount_due_at_signing"
    | "signing_token"
    | "test_type"
  >;
  appUrl: string;
}

export async function createCheckoutSessionForContract({
  contract,
  appUrl,
}: CreateCheckoutArgs): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const copy = testCopy(contract.test_type);
  const amountCents = Math.round(Number(contract.amount_due_at_signing) * 100);
  return stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: contract.parent_email,
    // Create a Stripe Customer so the saved card is attached to a reusable
    // record (a bare PaymentIntent doesn't attach the PM to a customer).
    customer_creation: "always",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: `StudyCore ${copy.name} Enrollment — ${contract.student_name}`,
            description: `Deposit due at signing for StudyCore ${copy.agreementTitle}.`,
          },
        },
      },
    ],
    success_url: `${appUrl}/sign/${contract.signing_token}?checkout=success`,
    cancel_url: `${appUrl}/sign/${contract.signing_token}?checkout=cancelled`,
    metadata: { contract_id: contract.id },
    payment_intent_data: {
      description: `StudyCore ${copy.name} Agreement — ${contract.student_name}`,
      metadata: { contract_id: contract.id },
      setup_future_usage: "off_session",
    },
  });
}
