'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { SiteHeader } from '@/components/SiteHeader';
import { ThinkingPanel } from '@/components/ThinkingPanel';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { OptionGroup } from '@/components/ui/OptionGroup';
import { TextAreaField, TextField } from '@/components/ui/TextArea';
import { ApiError, extractDocument, generateQuestions } from '@/lib/client-api';
import { SAMPLE_SCENARIOS } from '@/lib/samples';
import { LIMITS } from '@/lib/schemas';
import { saveSession, takePreset } from '@/lib/session-store';
import {
  DIFFICULTY_LABELS,
  INTERVIEW_TYPES,
  INTERVIEW_TYPE_LABELS,
  type CandidateProfile,
  type Difficulty,
  type InterviewType,
} from '@/types/interview';

const TYPE_OPTIONS = INTERVIEW_TYPES.map((value) => ({
  value,
  label: INTERVIEW_TYPE_LABELS[value],
}));

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; hint: string }[] = [
  { value: 'easy', label: DIFFICULTY_LABELS.easy, hint: 'Gentle, single-part questions' },
  { value: 'medium', label: DIFFICULTY_LABELS.medium, hint: 'A realistic first round' },
  { value: 'hard', label: DIFFICULTY_LABELS.hard, hint: 'Trade-offs, defended decisions' },
];

const THINKING_STEPS = [
  'Reading your resume for concrete projects, metrics and ownership',
  'Matching that against what the job description actually demands',
  'Finding the requirement your resume does not yet evidence',
  'Writing five questions in interview order and checking they are specific to you',
];

const MIN_RESUME = 60;
const MIN_JD = 40;

export default function SetupPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [interviewType, setInterviewType] = useState<InterviewType>('technical');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');

  const [fileError, setFileError] = useState<{ resume?: string; jd?: string }>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [fromPreset, setFromPreset] = useState(false);

  // "Run this interview next" on the report screen hands over the same resume and job
  // description at the difficulty Gemma recommended, so nothing has to be retyped.
  // These fields stay user-editable afterwards, so seeding them on mount is the point —
  // sessionStorage cannot be read during render without breaking hydration.
  /* eslint-disable react-hooks/set-state-in-effect -- one-shot seed of editable form
     fields from sessionStorage, which cannot be read during render without breaking
     hydration. Runs once on mount; the fields are the user's to change afterwards. */
  useEffect(() => {
    const preset = takePreset();
    if (!preset) return;
    setRole(preset.role);
    setResume(preset.resume);
    setJobDescription(preset.jobDescription);
    setInterviewType(preset.interviewType);
    setDifficulty(preset.difficulty);
    setFromPreset(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const resumeReady = resume.trim().length >= MIN_RESUME;
  const jdReady = jobDescription.trim().length >= MIN_JD;
  const canStart = resumeReady && jdReady && !pending;

  /**
   * PDF and text uploads are a convenience, never a dependency: extraction happens on the
   * server and any failure falls back to the paste box with an explicit message.
   */
  const readTextFile = (file: File, target: 'resume' | 'jd') => {
    const key = target === 'resume' ? 'resume' : 'jd';

    if (file.size > LIMITS.uploadBytes) {
      setFileError((current) => ({
        ...current,
        [key]: 'That file is too large — keep it under 8 MB.',
      }));
      return;
    }

    setFileError((current) => ({ ...current, [key]: 'Reading file…' }));

    extractDocument(file)
      .then((text) => {
        if (target === 'resume') setResume(text.slice(0, LIMITS.resume));
        else setJobDescription(text.slice(0, LIMITS.jobDescription));
        setFileError((current) => ({ ...current, [key]: undefined }));
      })
      .catch((caught: unknown) => {
        setFileError((current) => ({
          ...current,
          [key]:
            caught instanceof ApiError
              ? caught.message
              : 'Could not read that file. Paste the text instead.',
        }));
      });
  };

  const loadSample = (id: string) => {
    const scenario = SAMPLE_SCENARIOS.find((item) => item.id === id);
    if (!scenario) return;
    setRole(scenario.role);
    setResume(scenario.resume);
    setJobDescription(scenario.jobDescription);
    setError(null);
  };

  const start = async () => {
    const profile: CandidateProfile = {
      name: name.trim(),
      role: role.trim(),
      resume: resume.trim(),
      jobDescription: jobDescription.trim(),
      interviewType,
      difficulty,
    };

    setPending(true);
    setError(null);

    try {
      const { questions, model } = await generateQuestions(profile);

      saveSession({
        version: 1,
        createdAt: Date.now(),
        profile,
        questions,
        answers: [],
        model,
      });

      router.push('/interview');
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError('Something went wrong. Try again.', 'server_error', true),
      );
      setPending(false);
    }
  };

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label-caps">Step 1 of 3 · Setup</p>
            <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
              Who are you interviewing as?
            </h1>
            <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-ink-soft">
              {fromPreset
                ? 'Carried over from your last fingerprint — same background, the session Gemma recommended next. Edit anything before you start.'
                : 'The more specific your resume and the job description, the sharper the questions. Both stay in this browser tab — nothing is stored on a server.'}
            </p>
          </div>

          {!pending ? (
            <div className="flex items-center gap-2">
              <span className="label-caps">Try a sample</span>
              {SAMPLE_SCENARIOS.map((scenario) => (
                <Button
                  key={scenario.id}
                  variant="secondary"
                  onClick={() => loadSample(scenario.id)}
                  className="h-8 px-3 text-xs"
                >
                  {scenario.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>

        {pending ? (
          <div className="mt-10 max-w-2xl">
            <ThinkingPanel title="Gemma 4 is building your interview" steps={THINKING_STEPS} />
            <p className="mt-4 text-sm text-muted">
              This usually takes 20–30 seconds. Keep this tab open.
            </p>
          </div>
        ) : (
          <div className="mt-10 space-y-8">
            {error ? (
              <Callout title="Gemma could not build the interview" onRetry={error.retryable ? start : undefined}>
                {error.message}
              </Callout>
            ) : null}

            <div className="grid gap-6 sm:grid-cols-2">
              <TextField
                label="Your name"
                value={name}
                onChange={setName}
                placeholder="Navaneeth"
                maxLength={LIMITS.name}
                optional
              />
              <TextField
                label="Role you are targeting"
                value={role}
                onChange={setRole}
                placeholder="Backend Engineer, Platform"
                maxLength={LIMITS.role}
                optional
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <TextAreaField
                label="Your resume"
                value={resume}
                onChange={setResume}
                maxLength={LIMITS.resume}
                rows={14}
                placeholder="Paste your resume, or upload a PDF above."
                hint={
                  resumeReady
                    ? 'Looks good.'
                    : `Paste at least ${MIN_RESUME} characters. Specifics beat polish.`
                }
                onFile={(file) => readTextFile(file, 'resume')}
                fileError={fileError.resume}
              />
              <TextAreaField
                label="Job description"
                value={jobDescription}
                onChange={setJobDescription}
                maxLength={LIMITS.jobDescription}
                rows={14}
                placeholder="Paste the job posting, or upload a PDF above."
                hint={
                  jdReady
                    ? 'Looks good.'
                    : `Paste at least ${MIN_JD} characters, including the requirements.`
                }
                onFile={(file) => readTextFile(file, 'jd')}
                fileError={fileError.jd}
              />
            </div>

            <div className="grid gap-8 border-t border-line pt-8 lg:grid-cols-2">
              <OptionGroup
                legend="Interview type"
                options={TYPE_OPTIONS}
                value={interviewType}
                onChange={setInterviewType}
              />
              <OptionGroup
                legend="Difficulty"
                options={DIFFICULTY_OPTIONS}
                value={difficulty}
                onChange={setDifficulty}
                detailed
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 border-t border-line pt-8">
              <Button size="lg" onClick={start} disabled={!canStart}>
                Generate my interview
              </Button>
              <p className="text-sm text-muted">
                {canStart
                  ? 'Five questions, written for this resume and this job.'
                  : 'Add your resume and the job description to continue.'}
              </p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
