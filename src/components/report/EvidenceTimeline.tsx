import type { AnswerRecord, TimelineEntry, Verdict } from '@/types/interview';
import { movementLevel } from '@/types/interview';

const VERDICT_DOT: Record<Verdict, string> = {
  strong: 'bg-accent',
  solid: 'bg-accent-dim',
  developing: 'bg-amber',
  weak: 'bg-flag',
};

const VERDICT_TEXT: Record<Verdict, string> = {
  strong: 'text-accent',
  solid: 'text-accent',
  developing: 'text-amber',
  weak: 'text-flag',
};

/**
 * The interview read chronologically. This is what makes a pattern explainable — you can
 * see the two weak answers sitting next to each other before the pattern names them.
 */
export function EvidenceTimeline({
  timeline,
  answers,
}: {
  timeline: TimelineEntry[];
  answers: AnswerRecord[];
}) {
  return (
    <ol className="relative space-y-0">
      {timeline.map((entry, index) => {
        const answer = answers.find((item) => item.questionId === entry.questionId);
        const movement = answer?.visual
          ? (answer.visual.level ?? movementLevel(answer.visual.movementIndex))
          : undefined;
        const last = index === timeline.length - 1;

        return (
          <li key={entry.questionId} className="relative flex gap-4 pb-5">
            {!last ? (
              <span className="absolute left-[5px] top-4 h-full w-px bg-line" aria-hidden="true" />
            ) : null}

            <span
              className={`relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full ${VERDICT_DOT[entry.verdict]}`}
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-xs text-muted">Q{index + 1}</span>
                <span className={`font-mono text-xs capitalize ${VERDICT_TEXT[entry.verdict]}`}>
                  {entry.verdict}
                </span>
                {answer?.speech ? (
                  <span className="font-mono text-[0.7rem] text-muted">
                    {answer.speech.longPauseCount} long pauses · {answer.speech.fillerCount} fillers
                  </span>
                ) : null}
                {movement ? (
                  <span className="font-mono text-[0.7rem] text-muted">
                    movement {movement}
                    {movement === 'high' ? ' ↑' : ''}
                  </span>
                ) : null}
              </div>

              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{entry.contentNote}</p>
              {entry.deliveryNote?.trim() ? (
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{entry.deliveryNote}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
