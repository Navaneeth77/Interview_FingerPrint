'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CameraStage } from '@/components/interview/CameraStage';
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
import { describeDelivery } from '@/lib/speech';
import { useVoiceCapture } from '@/lib/use-voice-capture';
import type { AnswerRecord, Question, SpeechMetrics, VisualMetrics } from '@/types/interview';

const REPORT_STEPS = [
  'Re-reading every answer alongside the question it was given',
  'Grouping the evidence into content, communication and delivery',
  'Looking for relationships that repeat across more than one answer',
  'Writing your fingerprint, the timeline, and the drill to fix it',
];

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export default function InterviewPage() {
  const router = useRouter();
  const { session, status, updateSession } = useInterviewSession();

  const [draft, setDraft] = useState('');
  const [visual, setVisual] = useState<VisualMetrics | undefined>(undefined);
  const [reportError, setReportError] = useState<ApiError | null>(null);
  const [typingMode, setTypingMode] = useState(false);
  const [probing, setProbing] = useState(false);

  /** The one adaptive probe, when Gemma judges the answer left a specific gap. */
  const [probe, setProbe] = useState<{
    question: string;
    answer: string;
    speech?: SpeechMetrics;
  } | null>(null);

  const pendingRef = useRef<Promise<void>[]>([]);
  const questionStartedRef = useRef(0);
  const reportStartedRef = useRef(false);

  const questions = session?.questions ?? [];
  const answers = session?.answers ?? [];
  const profile = session?.profile;

  const answeredCount = answers.length;
  const finalizing = questions.length > 0 && answeredCount >= questions.length;
  const index = Math.min(answeredCount, Math.max(0, questions.length - 1));
  const question: Question | undefined = questions[index];
  const isLast = index === questions.length - 1;
  const scored = answers.filter((answer) => answer.evaluation).length;
  const failedCount = answers.filter((answer) => answer.evaluationError).length;

  const voice = useVoiceCapture(setDraft);
  const recording = voice.state === 'recording';
  /** Delivery metrics come straight from the recorder; a probe preserves the original set. */
  const speech = probe?.speech ?? voice.metrics;

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

    await Promise.allSettled(pendingRef.current);
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

  useEffect(() => {
    if (!finalizing || session?.report || reportStartedRef.current) return;
    reportStartedRef.current = true;
    void buildReport();
  }, [finalizing, session?.report, buildReport]);

  const retryReport = useCallback(() => {
    setReportError(null);
    void buildReport();
  }, [buildReport]);

  /** Scores one answer in the background; failures are recorded, never thrown away. */
  const scoreAnswer = useCallback(
    (record: AnswerRecord, forQuestion: Question) => {
      if (!profile) return Promise.resolve();

      return evaluateAnswer({ question: forQuestion, answer: record, profile })
        .then(({ evaluation }) => {
          updateSession((current) => ({
            ...current,
            answers: current.answers.map((answer) =>
              answer.questionId === record.questionId
                ? { ...answer, evaluation, evaluationError: undefined }
                : answer,
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
    },
    [profile, updateSession],
  );

  const commitAnswer = useCallback(
    (finalAnswer: string, followUp?: { question: string; answer: string }) => {
      if (!question || !profile) return;

      const record: AnswerRecord = {
        questionId: question.id,
        question: question.question,
        answer: finalAnswer.trim(),
        mode: speech ? 'voice' : 'typed',
        durationSec: Math.max(
          0,
          Math.round((Date.now() - (questionStartedRef.current || Date.now())) / 1000),
        ),
        category: question.category,
        speech,
        visual,
        followUpQuestion: followUp?.question,
        followUpAnswer: followUp?.answer,
      };

      updateSession((current) => ({ ...current, answers: [...current.answers, record] }));
      pendingRef.current = [...pendingRef.current, scoreAnswer(record, question)];

      setDraft('');
      setProbe(null);
      setTypingMode(false);
      voice.reset();
    },
    [profile, question, scoreAnswer, speech, updateSession, visual, voice],
  );

  /**
   * On submit, ask Gemma whether one probe is worth asking. Bounded to a single follow-up
   * per question, and any failure here just submits the answer as it stands.
   */
  const submitAnswer = useCallback(async () => {
    if (!question || !profile || probing) return;
    if (recording) {
      voice.stop();
      return;
    }

    const current = draft.trim();

    if (probe) {
      commitAnswer(probe.answer, { question: probe.question, answer: current });
      return;
    }

    if (!current) {
      commitAnswer('');
      return;
    }

    setProbing(true);
    try {
      const snapshot: AnswerRecord = {
        questionId: question.id,
        question: question.question,
        answer: current,
        mode: speech ? 'voice' : 'typed',
        durationSec: 0,
        speech,
      };

      const { evaluation } = await evaluateAnswer({ question, answer: snapshot, profile });

      if (evaluation.followUpWorthAsking && evaluation.followUp?.trim()) {
        setProbe({ question: evaluation.followUp.trim(), answer: current, speech: voice.metrics });
        setDraft('');
        voice.reset();
        setProbing(false);
        return;
      }
    } catch {
      // A probe is a bonus, never a blocker.
    }

    setProbing(false);
    commitAnswer(current);
  }, [commitAnswer, draft, probe, probing, profile, question, recording, speech, voice]);

  const skipProbe = useCallback(() => {
    if (!probe) return;
    commitAnswer(probe.answer);
  }, [commitAnswer, probe]);

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
                retryLabel="Retry report"
              >
                {reportError.message} Your interview is preserved — every question, answer and
                score is still here, so retrying only redoes the report.
              </Callout>
              <Button variant="ghost" onClick={() => router.push('/setup')}>
                Start a different interview
              </Button>
            </div>
          ) : (
            <div className="mt-6">
              <ThinkingPanel title="Gemma 4 is writing your fingerprint" steps={REPORT_STEPS} />
              <p className="mt-4 text-sm text-muted">
                {failedCount > 0
                  ? `${failedCount} answer${failedCount > 1 ? 's' : ''} could not be scored — the report treats those as unknown rather than zero.`
                  : 'Scoring your answers, then reasoning across the whole session. 20–30 seconds.'}
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

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-6">
        <div className="flex items-center justify-between gap-4">
          <ProgressRail total={questions.length} currentIndex={index} scored={scored} />
          <QuestionTimer key={index} />
        </div>

        {/* Camera takes the majority of the room; the question sits beside it. */}
        <div className="mt-5 grid flex-1 items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <CameraStage
            questionKey={index}
            onMetrics={setVisual}
            metrics={visual}
            recording={recording}
          />

          <div className="flex flex-col">
            <p className="label-caps mb-3">Interviewer</p>
            <QuestionCard question={question} index={index} />

            {probe ? (
              <div className="mt-5 rounded-[10px] border border-line-strong bg-panel-2 px-4 py-4 animate-rise">
                <p className="label-caps text-accent">Follow-up</p>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-ink">{probe.question}</p>
                <button
                  type="button"
                  onClick={skipProbe}
                  className="mt-3 text-xs text-muted underline decoration-line-strong underline-offset-2 hover:text-ink"
                >
                  Skip this and move on
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Recording bar: speaking is the primary way to answer. */}
        <div className="mt-6 rounded-[10px] border border-line bg-surface px-4 py-4 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center gap-3">
            {voice.state === 'denied' || voice.state === 'error' ? (
              <span className="text-sm text-muted">
                {voice.state === 'denied'
                  ? 'Microphone blocked — type your answer instead.'
                  : 'Speech recognition is unavailable in this browser — typing works fine.'}
              </span>
            ) : recording ? (
              <Button
                variant="secondary"
                size="lg"
                onClick={voice.stop}
                className="border-flag text-flag hover:border-flag hover:bg-flag-wash"
              >
                <span className="size-2 animate-pulse rounded-full bg-flag" />
                Recording {Math.floor(voice.elapsed / 60)}:
                {String(voice.elapsed % 60).padStart(2, '0')} — finish answer
              </Button>
            ) : (
              <Button variant="secondary" size="lg" onClick={voice.start}>
                <span className="size-2 rounded-full bg-accent" />
                {draft.trim() ? 'Record more' : 'Start answering out loud'}
              </Button>
            )}

            <button
              type="button"
              onClick={() => setTypingMode((current) => !current)}
              className="text-xs text-muted underline decoration-line-strong underline-offset-2 transition-colors hover:text-ink"
            >
              {typingMode ? 'Hide typing' : 'Type instead'}
            </button>

            <div className="ml-auto flex items-center gap-3">
              {speech ? (
                <span className="hidden font-mono text-[0.7rem] text-muted xl:inline">
                  {speech.wordsPerMinute} wpm · {speech.fillerCount} fillers ·{' '}
                  {describeDelivery(speech)}
                </span>
              ) : null}
              <Button size="lg" onClick={submitAnswer} disabled={recording || probing}>
                {probing
                  ? 'Checking…'
                  : probe
                    ? 'Submit answer'
                    : isLast
                      ? 'Finish and get my fingerprint'
                      : 'Submit and continue'}
              </Button>
            </div>
          </div>

          {/* Live transcript, always editable. */}
          {draft || typingMode || recording ? (
            <div className="mt-4">
              <label htmlFor="answer" className="label-caps">
                {recording ? 'Transcript — live' : 'Your answer'}
              </label>
              <textarea
                id="answer"
                value={draft}
                rows={typingMode ? 6 : 4}
                maxLength={LIMITS.answer}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void submitAnswer();
                }}
                placeholder="Speak, or type here. Specifics — numbers, decisions, trade-offs — are what get scored."
                className="mt-2 w-full resize-y rounded-[10px] border border-line bg-inset px-4 py-3 text-[0.95rem] leading-relaxed text-ink placeholder:text-muted/70 focus:border-line-strong focus:outline-none"
              />
              <div className="mt-1.5 flex items-center justify-between gap-4">
                <p className="font-mono text-[0.7rem] text-muted">
                  {words} {words === 1 ? 'word' : 'words'}
                </p>
                <p className="hidden font-mono text-[0.7rem] text-muted sm:block">
                  ⌘ + return to submit
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted">
              Speaking is the point — you get delivery feedback as well as content. Submitting
              empty skips the question, and Gemma scores that as a miss, like a real interview.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
