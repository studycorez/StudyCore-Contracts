import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-navy via-navy to-navy-dark text-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-8 px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-white/80">
          StudyCore LLC
        </div>
        <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
          StudyCore <span className="text-orange">Contracts</span>
        </h1>
        <p className="max-w-2xl text-lg text-white/80">
          Internal contract management portal for StudyCore SAT &amp; ACT Tutoring agreements. Closers and admins
          sign in to manage and send contracts to parents.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/login" className="btn-primary">
            Sign in
          </Link>
          <a href="https://studycore.net" className="btn-secondary !bg-transparent !text-white !border-white/30 hover:!bg-white/10">
            studycore.net
          </a>
        </div>
        <p className="pt-12 text-xs text-white/50">
          Parents: please use the secure signing link emailed to you from contracts@studycore.net.
        </p>
      </div>
    </main>
  );
}
