'use client';

import type { ApiErrorBody, ApiErrorCode } from '@/lib/api';
import type {
  AnswerRecord,
  CandidateProfile,
  Evaluation,
  InterviewReport,
  Question,
} from '@/types/interview';

/** Browser-side wrappers around our own API. The Gemma key lives only on the server. */

export class ApiError extends Error {
  readonly code: ApiErrorCode | 'network';
  readonly retryable: boolean;

  constructor(message: string, code: ApiError['code'], retryable: boolean) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.retryable = retryable;
  }
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      'Could not reach the server. Check your connection and try again.',
      'network',
      true,
    );
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const apiBody = payload as ApiErrorBody | null;
    throw new ApiError(
      apiBody?.error?.message ?? `Request failed (${response.status}).`,
      apiBody?.error?.code ?? 'server_error',
      apiBody?.error?.retryable ?? response.status >= 500,
    );
  }

  return payload as T;
}

export interface GenerateResult {
  questions: Question[];
  model: string;
  latencyMs: number;
}

export function generateQuestions(
  profile: CandidateProfile,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  return post<GenerateResult>(
    '/api/interview/generate',
    {
      name: profile.name,
      role: profile.role,
      resume: profile.resume,
      jobDescription: profile.jobDescription,
      interviewType: profile.interviewType,
      difficulty: profile.difficulty,
    },
    signal,
  );
}

export function evaluateAnswer(
  args: {
    question: Question;
    answer: AnswerRecord;
    profile: CandidateProfile;
  },
  signal?: AbortSignal,
): Promise<{ evaluation: Evaluation; model: string; latencyMs: number }> {
  return post(
    '/api/interview/evaluate',
    {
      question: args.question.question,
      answer: args.answer.answer,
      context: {
        role: args.profile.role,
        interviewType: args.profile.interviewType,
        difficulty: args.profile.difficulty,
        focusArea: args.question.focusArea,
        category: args.question.category,
        jobDescription: args.profile.jobDescription,
        speech: args.answer.speech,
        followUpQuestion: args.answer.followUpQuestion,
        followUpAnswer: args.answer.followUpAnswer,
      },
    },
    signal,
  );
}

/** Uploads a PDF or text file and returns its extracted text. */
export async function extractDocument(file: File, signal?: AbortSignal): Promise<string> {
  const body = new FormData();
  body.append('file', file);

  let response: Response;
  try {
    response = await fetch('/api/extract', { method: 'POST', body, signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('Could not upload that file. Paste the text instead.', 'network', true);
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const apiBody = payload as ApiErrorBody | null;
    throw new ApiError(
      apiBody?.error?.message ?? 'Could not read that file. Paste the text instead.',
      apiBody?.error?.code ?? 'server_error',
      false,
    );
  }

  return (payload as { text: string }).text;
}

export function requestReport(
  args: { profile: CandidateProfile; answers: AnswerRecord[] },
  signal?: AbortSignal,
): Promise<{ report: InterviewReport; model: string; latencyMs: number }> {
  return post(
    '/api/interview/report',
    {
      profile: {
        name: args.profile.name,
        role: args.profile.role,
        resume: args.profile.resume,
        jobDescription: args.profile.jobDescription,
        interviewType: args.profile.interviewType,
        difficulty: args.profile.difficulty,
      },
      answers: args.answers.map((answer) => ({
        questionId: answer.questionId,
        question: answer.question,
        answer: answer.answer,
        mode: answer.mode,
        durationSec: answer.durationSec,
        category: answer.category,
        speech: answer.speech,
        visual: answer.visual,
        evaluation: answer.evaluation,
        followUpQuestion: answer.followUpQuestion,
        followUpAnswer: answer.followUpAnswer,
      })),
    },
    signal,
  );
}
