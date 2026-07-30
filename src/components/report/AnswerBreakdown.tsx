import type { AnswerRecord, Verdict } from '@/types/interview';

const VERDICT_STYLES: Record<Verdict, string> = {
  strong: 'bg-accent-wash text-accent',
  solid: 'bg-accent-wash/60 text-accent',
  developing: 'bg-flag-wash text-flag',
  weak: 'bg-flag-wash text-flag',
};

function ScorePips({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 font-mono text-[0.7rem] text-muted">{label}</span>
      <span className="flex gap-0.5" aria-label={`${label} ${value} out of 10`}>
        {Array.from({ length: 10 }, (_, index) => (
          <span
            key={index}
            className={`h-3 w-1 rounded-sm ${index < value ? 'bg-accent' : 'bg-line'}`}
          />
        ))}
      </span>
      <span className="font-mono text-[0.7rem] tabular-nums text-ink-soft">{value}</span>
    </div>
  );
}

/** Per-question detail: what you were asked, what you said, and how Gemma scored it. */
export function AnswerBreakdown({ answers }: { answers: AnswerRecord[] }) {
  return (
    <ol className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {answers.map((answer, index) => {
        const evaluation = answer.evaluation;

        return (
          <li key={answer.questionId}>
            <details className="group px-5 py-4 sm:px-6">
              <summary className="flex cursor-pointer list-none items-start gap-4">
                <span className="mt-0.5 font-mono text-xs text-muted">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[0.95rem] leading-snug text-ink">
                    {answer.question}
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {answer.answer.trim()
                      ? `${answer.answer.trim().split(/\s+/).length} words · ${answer.durationSec}s`
                      : 'Skipped'}
                    {answer.speech
                      ? ` · ${Math.round(answer.speech.wordsPerMinute)} wpm · ${answer.speech.fillerCount} fillers`
                      : ''}
                  </span>
                </span>

                {evaluation ? (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[0.7rem] ${VERDICT_STYLES[evaluation.verdict]}`}
                  >
                    {evaluation.verdict}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-line px-2.5 py-1 font-mono text-[0.7rem] text-muted">
                    unscored
                  </span>
                )}

                <span className="mt-1 shrink-0 text-muted transition-transform group-open:rotate-90">
                  ›
                </span>
              </summary>

              <div className="mt-5 space-y-5 pl-0 sm:pl-10">
                {answer.answer.trim() ? (
                  <blockquote className="border-l-2 border-line pl-4 text-sm leading-relaxed text-ink-soft">
                    {answer.answer}
                  </blockquote>
                ) : null}

                {evaluation ? (
                  <>
                    <div className="space-y-1.5">
                      <ScorePips label="relevance" value={evaluation.relevance} />
                      <ScorePips label="clarity" value={evaluation.clarity} />
                      <ScorePips label="depth" value={evaluation.depth} />
                    </div>

                    <p className="text-sm leading-relaxed text-ink">{evaluation.feedback}</p>

                    {evaluation.strengths.length > 0 || evaluation.improvements.length > 0 ? (
                      <div className="grid gap-5 sm:grid-cols-2">
                        {evaluation.strengths.length > 0 ? (
                          <div>
                            <p className="label-caps mb-2">Worked</p>
                            <ul className="space-y-1.5 text-sm text-ink-soft">
                              {evaluation.strengths.map((item) => (
                                <li key={item} className="flex gap-2">
                                  <span className="text-accent">+</span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {evaluation.improvements.length > 0 ? (
                          <div>
                            <p className="label-caps mb-2">Fix</p>
                            <ul className="space-y-1.5 text-sm text-ink-soft">
                              {evaluation.improvements.map((item) => (
                                <li key={item} className="flex gap-2">
                                  <span className="text-flag">→</span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="rounded-lg border border-line bg-paper px-4 py-3">
                      <p className="label-caps">The follow-up you would have got</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                        {evaluation.followUp}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-flag">
                    {answer.evaluationError ?? 'Gemma did not return a score for this answer.'}
                  </p>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
