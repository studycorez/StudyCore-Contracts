export const dynamic = "force-static";

export default function WelcomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-cream">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-navy/10 to-transparent"
      />
      <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-8 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-navy text-2xl font-bold text-white shadow-lg shadow-navy/20">
          SC
        </div>

        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-orange/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-dark">
          <span className="h-1.5 w-1.5 rounded-full bg-orange" />
          Enrollment confirmed
        </div>

        <h1 className="mb-4 text-4xl font-bold tracking-tight text-navy md:text-5xl">
          Welcome to StudyCore!
        </h1>
        <p className="max-w-xl text-lg text-slate-700">
          Your enrollment is confirmed. We'll be in touch within 24 hours to get you started —
          including matching your tutor and scheduling your first session.
        </p>

        <div className="mt-10 grid w-full gap-4 md:grid-cols-3">
          <Step
            n="1"
            title="Tutor match"
            body="We'll pair your student with a top-scoring vetted tutor based on diagnostic results."
          />
          <Step
            n="2"
            title="Kickoff call"
            body="A short intro to align on goals, schedule, and the StudyCore platform."
          />
          <Step
            n="3"
            title="First session"
            body="Sessions begin and the program officially kicks off."
          />
        </div>

        <div className="mt-12 rounded-2xl border border-navy/10 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
          A signed copy of your agreement was emailed to you from{" "}
          <span className="font-semibold text-navy">contracts@studycore.net</span>.
          <br />
          Questions? Reach us anytime at{" "}
          <a
            href="mailto:support@studycore.net"
            className="font-semibold text-orange hover:underline"
          >
            support@studycore.net
          </a>
          .
        </div>

        <a
          href="https://studycore.net"
          className="mt-8 text-sm font-medium text-navy/70 hover:text-navy"
        >
          Visit studycore.net →
        </a>
      </div>
    </main>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-5 text-left shadow-sm">
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
        {n}
      </div>
      <div className="text-base font-semibold text-navy">{title}</div>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </div>
  );
}
