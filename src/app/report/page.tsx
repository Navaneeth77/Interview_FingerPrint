'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { AnswerBreakdown } from '@/components/report/AnswerBreakdown';
import { FingerprintMark } from '@/components/report/FingerprintMark';
import { SiteHeader } from '@/components/SiteHeader';
import { Button } from '@/components/ui/Button';
import { savePreset, useInterviewSession } from '@/lib/session-store';
import {
  DIFFICULTY_LABELS,
  INTERVIEW_TYPE_LABELS,
  type FingerprintDimension,
} from '@/types/interview';

function scoreTone(score: number): string {
  if (score >= 75) return 'text-accent';
  if (score >= 50) return 'text-ink';
  return 'text-flag';
}

function DimensionBar({ dimension }: { dimension: FingerprintDimension }) {
  return (
    <div className="py-3.5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium text-ink">{dimension.name}</p>
        <p className={`font-mono text-sm tabular-nums ${scoreTone(dimension.score)}`}>
          {dimension.score}
        </p>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full ${dimension.score >= 50 ? 'bg-accent' : 'bg-flag'}`}
          style={{ width: `${Math.max(2, dimension.score)}%` }}
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">{dimension.note}</p>
    </div>
  );
}

export default function ReportPage() {
  const router = useRouter();
  const { session, status, reset } = useInterviewSession();

  useEffect(() => {
    if (status === 'empty') router.replace('/setup');
  }, [status, router]);

  if (status === 'loading' || !session) {
    return (
      <>
        <SiteHeader showStatus={false} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-20">
          <p className="text-sm text-muted">Loading your report…</p>
        </main>
      </>
    );
  }

  const report = session.report;

  if (!report) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-20">
          <h1 className="font-display text-3xl">This interview has no report yet</h1>
          <p className="mt-3 text-sm text-ink-soft">
            Finish the interview and Gemma will write your fingerprint.
          </p>
          <div className="mt-6 flex gap-3">
            <Button onClick={() => router.push('/interview')}>Back to the interview</Button>
            <Button variant="secondary" onClick={() => router.push('/setup')}>
              Start over
            </Button>
          </div>
        </main>
      </>
    );
  }

  const { profile, answers } = session;
  const scoredCount = answers.filter((answer) => answer.evaluation).length;

  const practiseNext = () => {
    savePreset({
      role: profile.role,
      resume: profile.resume,
      jobDescription: profile.jobDescription,
      interviewType: report.nextSession.interviewType,
      difficulty: report.nextSession.difficulty,
    });
    reset();
    router.push('/setup');
  };

  const startFresh = () => {
    reset();
    router.push('/setup');
  };

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <p className="label-caps">
          Interview Fingerprint · {INTERVIEW_TYPE_LABELS[profile.interviewType]} ·{' '}
          {DIFFICULTY_LABELS[profile.difficulty]}
        </p>

        {/* Headline block: the mark, the score, and the one sentence that matters. */}
        <section className="mt-6 grid gap-10 border-b border-line pb-12 md:grid-cols-[auto_1fr] md:gap-14">
          <div className="flex flex-col items-center gap-3">
            <FingerprintMark dimensions={report.fingerprint.dimensions} />
            <div className="text-center">
              <p className={`font-display text-5xl leading-none ${scoreTone(report.overallScore)}`}>
                {report.overallScore}
              </p>
              <p className="label-caps mt-1.5">out of 100</p>
            </div>
          </div>

          <div className="min-w-0">
            <h1 className="font-display text-4xl leading-tight text-balance sm:text-5xl">
              {report.fingerprint.label}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-ink-soft">{report.headline}</p>
            <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-soft">
              {report.fingerprint.summary}
            </p>
            <p className="mt-6 font-mono text-[0.7rem] text-muted">
              {profile.name ? `${profile.name} · ` : ''}
              {answers.length} questions · {scoredCount} scored by {session.model ?? 'gemma-4'}
            </p>
          </div>
        </section>

        {/* Dimensions */}
        <section className="border-b border-line py-10">
          <h2 className="label-caps">How you scored</h2>
          <div className="mt-3 grid gap-x-12 sm:grid-cols-2 lg:grid-cols-3">
            {report.fingerprint.dimensions.map((dimension) => (
              <DimensionBar key={dimension.name} dimension={dimension} />
            ))}
          </div>
        </section>

        {/* Strengths / weaknesses */}
        <section className="grid gap-10 border-b border-line py-10 sm:grid-cols-2 sm:gap-16">
          <div>
            <h2 className="label-caps">What you did well</h2>
            <ul className="mt-4 space-y-3">
              {report.strengths.map((item) => (
                <li key={item} className="flex gap-3 text-[0.95rem] leading-relaxed text-ink-soft">
                  <span className="mt-0.5 shrink-0 text-accent">+</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="label-caps">What cost you</h2>
            <ul className="mt-4 space-y-3">
              {report.weaknesses.map((item) => (
                <li key={item} className="flex gap-3 text-[0.95rem] leading-relaxed text-ink-soft">
                  <span className="mt-0.5 shrink-0 text-flag">−</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Repeated patterns — the part a single-answer critique can never give you. */}
        {report.repeatedPatterns.length > 0 ? (
          <section className="border-b border-line py-10">
            <h2 className="label-caps">Patterns across your answers</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {report.repeatedPatterns.map((pattern) => (
                <p
                  key={pattern}
                  className="rounded-xl border border-line bg-surface px-4 py-4 text-sm leading-relaxed text-ink-soft"
                >
                  {pattern}
                </p>
              ))}
            </div>
          </section>
        ) : null}

        {/* Improvement plan */}
        <section className="border-b border-line py-10">
          <h2 className="label-caps">Fix these first</h2>
          <ol className="mt-4 space-y-px overflow-hidden rounded-2xl border border-line bg-line">
            {report.improvementAreas.map((area, index) => (
              <li key={area.area} className="bg-surface px-5 py-5 sm:px-6">
                <div className="flex gap-4">
                  <span className="font-mono text-xs text-accent">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-2xl leading-snug">{area.area}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">{area.why}</p>
                    <p className="mt-2.5 text-sm leading-relaxed text-ink">
                      <span className="label-caps mr-2">Do this</span>
                      {area.action}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Per-question detail */}
        <section className="border-b border-line py-10">
          <h2 className="label-caps">Question by question</h2>
          <div className="mt-4">
            <AnswerBreakdown answers={answers} />
          </div>
        </section>

        {/* Next session */}
        <section className="py-10">
          <div className="rounded-2xl border border-accent/25 bg-accent-wash px-6 py-7">
            <h2 className="label-caps">Your next session</h2>
            <p className="mt-3 font-display text-2xl leading-snug text-ink">
              {report.nextSession.focus}
            </p>
            <p className="mt-2 font-mono text-xs text-accent">
              {INTERVIEW_TYPE_LABELS[report.nextSession.interviewType]} ·{' '}
              {DIFFICULTY_LABELS[report.nextSession.difficulty]}
            </p>

            <ul className="mt-5 space-y-2">
              {report.nextSession.drills.map((drill) => (
                <li key={drill} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
                  <span className="mt-0.5 shrink-0 text-accent">→</span>
                  {drill}
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button onClick={practiseNext}>Run this interview next</Button>
              <Button variant="secondary" onClick={startFresh}>
                Start something different
              </Button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
