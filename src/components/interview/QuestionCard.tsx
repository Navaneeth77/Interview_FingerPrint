import { QUESTION_CATEGORY_LABELS, type Question } from '@/types/interview';

const GROUNDING_LABELS: Record<Question['groundedIn'], string> = {
  resume: 'from your resume',
  'job-description': 'from the job description',
  both: 'resume × job description',
};

/** The interviewer's turn. Everything else in the room is quieter than this. */
export function QuestionCard({ question, index }: { question: Question; index: number }) {
  const provenance = question.provenance;
  const hasProvenance =
    !!provenance?.resumeEvidence?.trim() || !!provenance?.jobDescriptionEvidence?.trim();

  return (
    <div key={question.id} className="animate-rise">
      <div className="flex flex-wrap items-center gap-2">
        <span className="pill bg-accent-wash text-accent">{question.focusArea}</span>
        {question.category ? (
          <span className="font-mono text-[0.7rem] text-muted">
            {QUESTION_CATEGORY_LABELS[question.category]}
          </span>
        ) : null}
        <span className="font-mono text-[0.7rem] text-muted">
          · {GROUNDING_LABELS[question.groundedIn]}
        </span>
      </div>

      <h1 className="mt-4 font-display text-2xl leading-[1.28] text-balance lg:text-[1.85rem]">
        {question.question}
      </h1>

      <details className="group mt-4">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink-soft">
          <span className="transition-transform group-open:rotate-90">›</span>
          Why you are being asked this
        </summary>

        <div className="mt-2.5 space-y-2.5 border-l-2 border-line pl-4">
          <p className="text-sm leading-relaxed text-ink-soft">{question.reason}</p>

          {/* Traceability: the exact lines that produced this question. */}
          {hasProvenance ? (
            <dl className="space-y-1.5">
              {provenance?.resumeEvidence?.trim() ? (
                <div className="flex gap-2 text-xs leading-relaxed">
                  <dt className="label-caps shrink-0">Resume</dt>
                  <dd className="text-ink-soft">“{provenance.resumeEvidence}”</dd>
                </div>
              ) : null}
              {provenance?.jobDescriptionEvidence?.trim() ? (
                <div className="flex gap-2 text-xs leading-relaxed">
                  <dt className="label-caps shrink-0">Job</dt>
                  <dd className="text-ink-soft">“{provenance.jobDescriptionEvidence}”</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>
      </details>

      <span className="sr-only">Question {index + 1}</span>
    </div>
  );
}
