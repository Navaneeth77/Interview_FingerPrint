'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ProgressRail } from '@/components/interview/ProgressRail';
import { QuestionCard } from '@/components/interview/QuestionCard';
import { QuestionTimer } from '@/components/interview/QuestionTimer';
import { SiteHeader } from '@/components/SiteHeader';
import { ThinkingPanel } from '@/components/ThinkingPanel';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { ApiError, evaluateAnswer, requestReport } from '@/lib/client-api';
import { LIMITS } from '@/lib/schemas';
import { loadSession, useInterviewSession } from '@/lib/session-store';
import type { AnswerRecord, Question } from '@/types/interview';

const REPORT_STEPS = [
  'Re-reading every answer alongside the question it was given',
  'Comparing your answers against what this job actually asks for',
  'Looking for the habits that repeat across more than one answer',
  'Writing your fingerprint, the gaps, and what to practise next',
];

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export default function InterviewPage() {
  const router = useRouter();
  const { session, status, updateSession } = useInterviewSession();

  const [draft, setDraft] = useState('');
  const [reportError, setReportError] = useState<ApiError | null>(null);

  /** In-flight evaluations. Answers are scored while the candidate moves on. */
  const pendingRef = useRef<Promise<void>[]>([]);
  const questionStartedRef = useRef(0);
  const reportStartedRef = useRef(false);

  const questions = session?.questions ?? [];
  const answers = session?.answers ?? [];
  const profile = session?.profile;

  // Progress is derived from the stored answers, so a refresh resumes exactly where the
  // candidate left off without copying anything into local state.
  const answeredCount = answers.length;
  const finalizing = questions.length > 0 && answeredCount >= questions.length;
  const index = Math.min(answeredCount, Math.max(0, questions.length - 1));
  const question: Question | undefined = questions[index];
  const isLast = index === questions.length - 1;
  const scored = answers.filter((answer) => answer.evaluation).length;

  useEffect(() => {
    if (status === 'empty') router.replace('/setup');
    else if (status === 'ready' && session?.report) router.replace('/report');
  }, [status, session?.report, router]);

  useEffect(() => {
    questionStartedRef.current = Date.now();
  }, [index]);

  const buildReport = useCallback(async () => {
    const current = loadSession();
    if (!current) return;

    // Collect the background scoring started during the interview.
    await Promise.allSettled(pendingRef.current);

    // Re-read after awaiting: the evaluations that just landed wrote themselves to storage.
    const latest = loadSession() ?? current;

    try {
      const { report } = await requestReport({
        profile: latest.profile,
        answers: latest.answers,
      });
      updateSession((existing) => ({ ...existing, report }));
      router.push('/report');
    } catch (caught) {
      setReportError(
        caught instanceof ApiError
          ? caught
          : new ApiError('Could not build your report.', 'server_error', true),
      );
    }
  }, [router, updateSession]);

  // Kick off the report once the last answer is in — including after a mid-report refresh.
  useEffect(() => {
    if (!finalizing || session?.report || reportStartedRef.current) return;
    reportStartedRef.current = true;
    void buildReport();
  }, [finalizing, session?.report, buildReport]);

  const retryReport = useCallback(() => {
    setReportError(null);
    void buildReport();
  }, [buildReport]);

  const submitAnswer = useCallback(() => {
    if (!question || !profile) return;

    const record: AnswerRecord = {
      questionId: question.id,
      question: question.question,
      answer: draft.trim(),
      mode: 'typed',
      durationSec: Math.max(
        0,
        Math.round((Date.now() - (questionStartedRef.current || Date.now())) / 1000),
      ),
    };

    updateSession((current) => ({ ...current, answers: [...current.answers, record] }));

    // Fire-and-collect: scoring happens while the candidate reads the next question.
    const pending = evaluateAnswer({ question, answer: record, profile })
      .then(({ evaluation }) => {
        updateSession((current) => ({
          ...current,
          answers: current.answers.map((answer) =>
            answer.questionId === record.questionId ? { ...answer, evaluation } : answer,
          ),
        }));
      })
      .catch((caught: unknown) => {
        const message =
          caught instanceof ApiError ? caught.message : 'Scoring failed for this answer.';
        updateSession((current) => ({
          ...current,
          answers: current.answers.map((answer) =>
            answer.questionId === record.questionId
              ? { ...answer, evaluationError: message }
              : answer,
          ),
        }));
      });

    pendingRef.current = [...pendingRef.current, pending];
    setDraft('');
  }, [draft, profile, question, updateSession]);

  if (status === 'loading' || !session || !profile) {
    return (
      <>
        <SiteHeader showStatus={false} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-20">
          <p className="text-sm text-muted">Loading your interview…</p>
        </main>
      </>
    );
  }

  if (finalizing) {
    const unscored = answers.filter((answer) => answer.evaluationError).length;

    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
          <p className="label-caps">Step 3 of 3 · Debrief</p>

          {reportError ? (
            <div className="mt-6 space-y-4">
              <Callout
                title="Gemma could not finish your report"
                onRetry={reportError.retryable ? retryReport : undefined}
                retryLabel="Generate the report again"
              >
                {reportError.message} Your answers are safe in this tab — retrying does not lose
                them.
              </Callout>
              <Button variant="ghost" onClick={() => router.push('/setup')}>
                Start a different interview
              </Button>
            </div>
          ) : (
            <div className="mt-6">
              <ThinkingPanel title="Gemma 4 is writing your fingerprint" steps={REPORT_STEPS} />
              <p className="mt-4 text-sm text-muted">
                {unscored > 0
                  ? `${unscored} answer${unscored > 1 ? 's' : ''} could not be scored — the report will say so.`
                  : 'Scoring your answers, then writing the report. This takes 20–30 seconds.'}
              </p>
            </div>
          )}
        </main>
      </>
    );
  }

  if (!question) return null;

  const words = wordCount(draft);

  return (
    <>
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <ProgressRail total={questions.length} currentIndex={index} scored={scored} />
          <QuestionTimer key={index} />
        </div>

        <div className="mt-10">
          <QuestionCard question={question} index={index} />
        </div>

        <div className="mt-8">
          <label htmlFor="answer" className="label-caps">
            Your answer
          </label>
          <textarea
            id="answer"
            value={draft}
            autoFocus
            rows={9}
            maxLength={LIMITS.answer}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submitAnswer();
            }}
            placeholder="Answer as you would out loud. Specifics — numbers, decisions, trade-offs — are what get scored."
            className="mt-2.5 w-full resize-y rounded-xl border border-line bg-surface px-4 py-3.5 text-[0.95rem] leading-relaxed text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none"
          />

          <div className="mt-2 flex items-center justify-between gap-4">
            <p className="font-mono text-[0.7rem] text-muted">
              {words} {words === 1 ? 'word' : 'words'}
            </p>
            <p className="hidden font-mono text-[0.7rem] text-muted sm:block">⌘ + return to submit</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-line pt-6">
          <Button size="lg" onClick={submitAnswer}>
            {isLast ? 'Finish and get my fingerprint' : 'Submit and continue'}
          </Button>

          {draft.trim().length === 0 ? (
            <p className="text-sm text-muted">
              Submitting empty skips the question — Gemma scores that as a miss, like a real
              interview.
            </p>
          ) : (
            <p className="text-sm text-muted">
              {isLast ? 'Last one.' : `${questions.length - index - 1} to go.`}
            </p>
          )}
        </div>
      </main>
    </>
  );
}
