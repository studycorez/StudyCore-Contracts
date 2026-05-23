import type { TestType } from "@/lib/types";

// Single source of truth for every piece of copy that differs between SAT
// and ACT contracts. Add new test types by extending TestType in types.ts
// and adding a branch here.
export interface TestCopy {
  // Canonical short name shown in UI / emails / Stripe.
  name: string;
  // Long-form agreement title used in headings, PDF subtitle, email subjects.
  agreementTitle: string;
  // Organization that issues the official score report (used in the
  // performance guarantee + force majeure clauses).
  scoreReporter: string;
  // Tutor-quality claim used in the legal agreement and tutor-match copy.
  // e.g. "1550+" for SAT, "34+" for ACT.
  tutorScoreClaim: string;
  // Word used inside group-session names ("group SAT preparation sessions").
  groupSessionPrefix: string;
  // Used for the IP clause: "personal, non-commercial SAT preparation".
  preparationPhrase: string;
}

export function testCopy(testType: TestType): TestCopy {
  if (testType === "ACT") {
    return {
      name: "ACT",
      agreementTitle: "ACT Tutoring Services Agreement",
      scoreReporter: "ACT, Inc.",
      tutorScoreClaim: "34+",
      groupSessionPrefix: "ACT",
      preparationPhrase: "ACT preparation",
    };
  }
  return {
    name: "SAT",
    agreementTitle: "SAT Tutoring Services Agreement",
    scoreReporter: "College Board",
    tutorScoreClaim: "1550+",
    groupSessionPrefix: "SAT",
    preparationPhrase: "SAT preparation",
  };
}
