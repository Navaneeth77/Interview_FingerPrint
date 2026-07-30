import { ButtonLink } from '@/components/ui/Button';
import { SiteHeader } from '@/components/SiteHeader';

const STEPS = [
  {
    n: '01',
    title: 'Gemma reads you in',
    body: 'Paste your resume and the job description. Gemma 4 writes five questions grounded in your actual projects — and one aimed at the requirement your resume does not cover.',
  },
  {
    n: '02',
    title: 'You answer under pressure',
    body: 'One question at a time, timed, typed or spoken. Each answer is scored on relevance, clarity and depth while you move to the next one.',
  },
  {
    n: '03',
    title: 'You get a fingerprint',
    body: 'Not a score dump — the pattern in how you interview. The habits that repeat across answers, the gap that costs you the offer, and the drills to fix it.',
  },
];

export default function LandingPage() {
  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-6 pt-20 pb-16 sm:pt-28">
          <p className="label-caps">Gemma 4 Hackathon Sprint · GDG VIT Chennai</p>

          <h1 className="mt-5 max-w-4xl font-display text-5xl leading-[1.05] tracking-tight text-balance sm:text-6xl md:text-7xl">
            Most mock interviews ask
            <br className="hidden sm:block" /> the wrong questions.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
            Generic question banks cannot see your resume, and they cannot tell you why your
            answer fell flat. Interview Fingerprint reads your background against the job you
            actually want, runs the interview, and hands back a coaching report that names the one
            thing standing between you and the offer.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <ButtonLink href="/setup" size="lg">
              Start an interview
            </ButtonLink>
            <span className="text-sm text-muted">Takes about 10 minutes. No sign-up.</span>
          </div>
        </section>

        <section className="border-t border-line bg-surface">
          <div className="mx-auto grid w-full max-w-6xl gap-px bg-line px-6 sm:grid-cols-3 sm:px-0">
            {STEPS.map((step) => (
              <article key={step.n} className="bg-surface px-0 py-10 sm:px-8">
                <span className="font-mono text-xs text-accent">{step.n}</span>
                <h2 className="mt-3 font-display text-2xl leading-snug">{step.title}</h2>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:gap-16">
            <div>
              <p className="label-caps">Why Gemma 4</p>
              <h2 className="mt-4 font-display text-3xl leading-tight">
                The model is not a wrapper around a question list. It is the interviewer.
              </h2>
              <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-soft">
                Gemma 4 does every piece of reasoning in this product: it decides what to ask you
                and why, judges each answer against the role&apos;s bar, writes the follow-up a real
                interviewer would have asked, and then reads the whole transcript back to find the
                habits you repeat without noticing. Remove the model and there is no product left.
              </p>
            </div>

            <dl className="grid gap-px self-start rounded-xl border border-line bg-line text-sm">
              {[
                ['Questions', 'Written per candidate from resume + job description'],
                ['Scoring', 'Relevance, clarity and depth per answer, with evidence'],
                ['Follow-ups', 'The next question a real interviewer would ask'],
                ['Fingerprint', 'Cross-answer patterns, gaps and a practice plan'],
              ].map(([term, description]) => (
                <div key={term} className="bg-surface px-5 py-4">
                  <dt className="label-caps">{term}</dt>
                  <dd className="mt-1.5 text-ink-soft">{description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            Every question, score and report is generated live by Gemma 4, server-side. No account,
            no database — your resume stays in your browser tab.
          </p>
          <p className="font-mono">Built for the Gemma 4 Hackathon Sprint</p>
        </div>
      </footer>
    </>
  );
}
