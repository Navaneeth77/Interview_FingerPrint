'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { AnswerBreakdown } from '@/components/report/AnswerBreakdown';
import { EvidenceTimeline } from '@/components/report/EvidenceTimeline';
import { FingerprintMark } from '@/components/report/FingerprintMark';
import { SiteHeader } from '@/components/SiteHeader';
import { Button } from '@/components/ui/Button';
import { savePreset, useInterviewSession } from '@/lib/session-store';
import {
  DIFFICULTY_LABELS,
  INTERVIEW_TYPE_LABELS,
  type AssessmentGroup,
  type FingerprintDimension,
} from '@/types/interview';

/** §7: colour by severity so a weak score is visible without reading the number. */
function scoreTone(score: number): string {
  if (score >= 50) return 'text-accent';
  if (score >= 30) return 'text-amber';
  return 'text-flag';
}

function barTone(score: number): string {
  if (score >= 50) return 'bg-accent';
  if (score >= 30) return 'bg-amber';
  return 'bg-flag';
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
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-inset">
        <div
          className={`h-full rounded-full ${barTone(dimension.score)}`}
          style={{ width: `${Math.max(2, dimension.score)}%` }}
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">{dimension.note}</p>
    </div>
  );
}

function AssessmentCard({ group }: { group: AssessmentGroup }) {
  return (
    <div className="rounded-[10px] border border-line bg-surface px-5 py-5 shadow-[var(--shadow-card)]">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-display text-xl">{group.name}</h3>
        <span className={`font-mono text-lg tabular-nums ${scoreTone(group.score)}`}>
          {group.score}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{group.summary}</p>

      <div className="mt-4 space-y-3 border-t border-line pt-4">
        {group.dimensions.map((dimension) => (
          <div key={dimension.name}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-ink-soft">{dimension.name}</span>
              <span className={`font-mono text-xs tabular-nums ${scoreTone(dimension.score)}`}>
                {dimension.score}
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-inset">
              <div
                className={`h-full rounded-full ${barTone(dimension.score)}`}
                style={{ width: `${Math.max(2, dimension.score)}%` }}
              />
            </div>
            <p className="mt-1 text-[0.7rem] leading-relaxed text-muted">{dimension.note}</p>
          </div>
        ))}
      </div>
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
  const patterns = report.patterns ?? [];
  const legacyPatterns = report.repeatedPatterns ?? [];
  const plan = report.practicePlan ?? [];
  const legacyPlan = report.improvementAreas ?? [];

  const questionNumber = (id: number) => {
    const position = answers.findIndex((answer) => answer.questionId === id);
    return position >= 0 ? position + 1 : id;
  };

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

        {/* Headline: the mark, the score, the one sentence that matters. */}
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
            {report.sessionSummary ? (
              <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-soft">
                {report.sessionSummary}
              </p>
            ) : null}
            <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-soft">
              {report.fingerprint.summary}
            </p>
            <p className="mt-6 font-mono text-[0.7rem] text-muted">
              {profile.name ? `${profile.name} · ` : ''}
              {answers.length} questions · {scoredCount} scored by {session.model ?? 'gemma-4'}
            </p>
          </div>
        </section>

        {/* #1 practice priority — the single most important thing on the page. */}
        {report.practicePriority ? (
          <section className="border-b border-line py-10">
            <h2 className="label-caps">Your #1 practice priority</h2>
            <div className="mt-4 rounded-[10px] border border-[color:var(--line-strong)] bg-panel-2 px-6 py-6 shadow-[var(--shadow-card)]">
              <h3 className="font-display text-2xl leading-snug text-ink">
                {report.practicePriority.what}
              </h3>
              <dl className="mt-5 grid gap-5 sm:grid-cols-3">
                <div>
                  <dt className="label-caps">Evidence</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                    {report.practicePriority.evidence}
                  </dd>
                </div>
                <div>
                  <dt className="label-caps">Why it matters</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                    {report.practicePriority.whyItMatters}
                  </dd>
                </div>
                <div>
                  <dt className="label-caps text-accent">How to practise</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-ink">
                    {report.practicePriority.howToPractice}
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        ) : null}

        {/* Fingerprint dimensions */}
        <section className="border-b border-line py-10">
          <h2 className="label-caps">How you scored</h2>
          <div className="mt-3 grid gap-x-12 sm:grid-cols-2 lg:grid-cols-3">
            {report.fingerprint.dimensions.map((dimension) => (
              <DimensionBar key={dimension.name} dimension={dimension} />
            ))}
          </div>
        </section>

        {/* Hierarchical assessment */}
        {report.assessment && report.assessment.length > 0 ? (
          <section className="border-b border-line py-10">
            <h2 className="label-caps">Content · Communication · Delivery</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Content and delivery are scored separately — a rough delivery never lowers a content
              score, and a polished one never raises it.
            </p>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {report.assessment.map((group) => (
                <AssessmentCard key={group.name} group={group} />
              ))}
            </div>
          </section>
        ) : null}

        {/* Cross-question patterns — the core differentiator */}
        {patterns.length > 0 ? (
          <section className="border-b border-line py-10">
            <h2 className="label-caps">Patterns we observed</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Only relationships that showed up in more than one answer, each traced back to the
              questions it came from.
            </p>
            <div className="mt-5 space-y-3">
              {patterns.map((pattern) => (
                <div
                  key={pattern.title}
                  className="rounded-[10px] border border-line bg-panel-2 px-5 py-4"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`pill ${
                        pattern.type === 'strength'
                          ? 'bg-accent-wash text-accent'
                          : 'bg-amber-wash text-amber'
                      }`}
                    >
                      {pattern.type === 'strength' ? 'strength' : 'development'}
                    </span>
                    <h3 className="font-display text-xl leading-snug">{pattern.title}</h3>
                  </div>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">
                    {pattern.observation}
                  </p>
                  <p className="mt-2.5 font-mono text-[0.7rem] text-muted">
                    evidence:{' '}
                    {pattern.evidenceQuestionIds.map((id) => `Q${questionNumber(id)}`).join(' + ')}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : legacyPatterns.length > 0 ? (
          <section className="border-b border-line py-10">
            <h2 className="label-caps">Patterns across your answers</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {legacyPatterns.map((pattern) => (
                <p
                  key={pattern}
                  className="rounded-[10px] border border-line bg-panel-2 px-4 py-4 text-sm leading-relaxed text-ink-soft"
                >
                  {pattern}
                </p>
              ))}
            </div>
          </section>
        ) : null}

        {/* Evidence timeline */}
        {report.timeline && report.timeline.length > 0 ? (
          <section className="border-b border-line py-10">
            <h2 className="label-caps">Evidence timeline</h2>
            <div className="mt-5 max-w-3xl">
              <EvidenceTimeline timeline={report.timeline} answers={answers} />
            </div>
          </section>
        ) : null}

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

        {/* Interview etiquette */}
        {report.etiquette && report.etiquette.length > 0 ? (
          <section className="border-b border-line py-10">
            <h2 className="label-caps">Interview etiquette</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {report.etiquette.map((point) => (
                <div
                  key={point.rule}
                  className="rounded-[10px] border border-line bg-surface px-4 py-4"
                >
                  <p className="text-sm font-medium text-ink">{point.rule}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">{point.why}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Practice plan */}
        {plan.length > 0 || legacyPlan.length > 0 ? (
          <section className="border-b border-line py-10">
            <h2 className="label-caps">Fix these first</h2>
            <ol className="mt-4 space-y-px overflow-hidden rounded-[10px] border border-line bg-line">
              {plan.map((item, index) => (
                <li key={item.problem} className="bg-surface px-5 py-5 sm:px-6">
                  <div className="flex gap-4">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-panel-2 font-mono text-xs text-accent">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display text-2xl leading-snug">{item.problem}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.evidence}</p>
                      <p className="mt-2.5 text-sm leading-relaxed text-ink">
                        <span className="label-caps mr-2 text-accent">Do this</span>
                        {item.drill}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
              {plan.length === 0
                ? legacyPlan.map((area, index) => (
                    <li key={area.area} className="bg-surface px-5 py-5 sm:px-6">
                      <div className="flex gap-4">
                        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-panel-2 font-mono text-xs text-accent">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-display text-2xl leading-snug">{area.area}</h3>
                          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{area.why}</p>
                          <p className="mt-2.5 text-sm leading-relaxed text-ink">
                            <span className="label-caps mr-2 text-accent">Do this</span>
                            {area.action}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))
                : null}
            </ol>
          </section>
        ) : null}

        {/* The generated drill: diagnosis becomes training. */}
        {report.trainingDrill ? (
          <section className="border-b border-line py-10">
            <h2 className="label-caps">Your 5-minute drill</h2>
            <div className="mt-4 rounded-[10px] border border-[color:var(--line-strong)] bg-panel-2 px-6 py-6 shadow-[var(--shadow-card)]">
              <div className="grid gap-5 sm:grid-cols-[1fr_1.4fr]">
                <div>
                  <p className="label-caps">Targets</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                    {report.trainingDrill.weakness}
                  </p>
                  <p className="label-caps mt-4">Framework</p>
                  <p className="mt-1.5 font-mono text-xs leading-relaxed text-accent">
                    {report.trainingDrill.framework}
                  </p>
                </div>

                <div>
                  <p className="label-caps">Practice question</p>
                  <p className="mt-1.5 font-display text-xl leading-snug text-ink">
                    {report.trainingDrill.practiceQuestion}
                  </p>

                  {report.trainingDrill.answerOutline.length > 0 ? (
                    <>
                      <p className="label-caps mt-4">A good answer hits</p>
                      <ol className="mt-2 space-y-1.5">
                        {report.trainingDrill.answerOutline.map((beat, index) => (
                          <li
                            key={beat}
                            className="flex gap-2.5 text-sm leading-relaxed text-ink-soft"
                          >
                            <span className="font-mono text-xs text-muted">{index + 1}</span>
                            {beat}
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : null}
                </div>
              </div>

              <Button className="mt-6" onClick={practiseNext}>
                Practise this now
              </Button>
            </div>
          </section>
        ) : null}

        {/* Per-question detail */}
        <section className="border-b border-line py-10">
          <h2 className="label-caps">Question by question</h2>
          <div className="mt-4">
            <AnswerBreakdown answers={answers} />
          </div>
        </section>

        {/* Next session */}
        <section className="py-10">
          <div className="rounded-[10px] border border-[color:var(--line-strong)] bg-panel-2 px-6 py-7 shadow-[var(--shadow-card)]">
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

        <p className="pb-10 text-xs leading-relaxed text-muted">
          Interview Fingerprint is a practice tool. It reflects what you said and how you delivered
          it in this one session — not your employability, intelligence, personality or emotional
          state. Speech and movement numbers are coaching signals only.
        </p>
      </main>
    </>
  );
}
