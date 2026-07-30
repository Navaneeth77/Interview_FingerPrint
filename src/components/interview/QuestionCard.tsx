import type { Question } from '@/types/interview';

const GROUNDING_LABELS: Record<Question['groundedIn'], string> = {
  resume: 'from your resume',
  'job-description': 'from the job description',
  both: 'resume × job description',
};

/** The interviewer's turn. Everything else on the screen is quieter than this. */
export function QuestionCard({ question, index }: { question: Question; index: number }) {
  return (
    <div key={question.id} className="animate-rise">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="rounded-full bg-accent-wash px-2.5 py-1 font-mono text-[0.7rem] tracking-wide text-accent">
          {question.focusArea}
        </span>
        <span className="font-mono text-[0.7rem] text-muted">{GROUNDING_LABELS[question.groundedIn]}</span>
        <span className="font-mono text-[0.7rem] text-muted">· {question.difficulty}</span>
      </div>

      <h1 className="mt-5 font-display text-3xl leading-[1.25] text-balance sm:text-[2.6rem]">
        {question.question}
      </h1>

      <details className="group mt-5">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink-soft">
          <span className="transition-transform group-open:rotate-90">›</span>
          Why you are being asked this
        </summary>
        <p className="mt-2.5 max-w-2xl border-l-2 border-line pl-4 text-sm leading-relaxed text-ink-soft">
          {question.reason}
        </p>
      </details>

      <span className="sr-only">Question {index + 1}</span>
    </div>
  );
}
