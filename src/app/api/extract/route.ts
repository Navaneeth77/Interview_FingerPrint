import { NextResponse } from 'next/server';

import { apiError, ApiResponseError, enforceRateLimit, toErrorResponse } from '@/lib/api';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { LIMITS } from '@/lib/schemas';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export interface ExtractResponseBody {
  text: string;
  characters: number;
  source: 'pdf' | 'text';
}

/** Collapses the ragged whitespace PDF extraction produces into readable paragraphs. */
function normalise(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * POST /api/extract — turns an uploaded resume or job description into plain text.
 *
 * PDF parsing is deliberately not on the critical path: pasting text always works, and a
 * PDF that will not extract cleanly returns a plain message telling the user to paste
 * instead. `unpdf` is used because it runs in a serverless runtime without native binaries.
 */
export async function POST(request: Request) {
  try {
    enforceRateLimit(request, 'extract', RATE_LIMITS.extract);

    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > LIMITS.uploadBytes) {
      throw new ApiResponseError(
        apiError('payload_too_large', 'That file is too large. Keep it under 8 MB.', 413),
      );
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get('file');

    if (!(file instanceof File)) {
      throw new ApiResponseError(
        apiError('invalid_request', 'Attach a file in the "file" field.', 400),
      );
    }

    if (file.size > LIMITS.uploadBytes) {
      throw new ApiResponseError(
        apiError('payload_too_large', 'That file is too large. Keep it under 8 MB.', 413),
      );
    }

    const name = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');

    if (!isPdf) {
      const text = normalise(await file.text());
      if (!text) {
        throw new ApiResponseError(
          apiError('invalid_request', 'That file appears to be empty.', 422),
        );
      }
      return NextResponse.json<ExtractResponseBody>({
        text: text.slice(0, LIMITS.resume),
        characters: text.length,
        source: 'text',
      });
    }

    // Imported lazily so the PDF engine is only pulled into the function that needs it.
    const { extractText, getDocumentProxy } = await import('unpdf');
    const buffer = new Uint8Array(await file.arrayBuffer());

    let text: string;
    try {
      const pdf = await getDocumentProxy(buffer);
      const result = await extractText(pdf, { mergePages: true });
      text = normalise(Array.isArray(result.text) ? result.text.join('\n') : result.text);
    } catch (error) {
      console.warn('[extract] pdf parse failed:', error instanceof Error ? error.message : error);
      throw new ApiResponseError(
        apiError(
          'invalid_request',
          'Could not reliably extract this PDF. Paste the text instead.',
          422,
        ),
      );
    }

    // A scanned/image-only PDF parses without error but yields almost nothing.
    if (text.replace(/\s/g, '').length < 80) {
      throw new ApiResponseError(
        apiError(
          'invalid_request',
          'Could not reliably extract this PDF — it may be scanned or image-based. Paste the text instead.',
          422,
        ),
      );
    }

    return NextResponse.json<ExtractResponseBody>({
      text: text.slice(0, LIMITS.resume),
      characters: text.length,
      source: 'pdf',
    });
  } catch (error) {
    return toErrorResponse(error, 'extract');
  }
}
