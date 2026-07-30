'use client';

import { useId, type ChangeEvent } from 'react';

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength: number;
  hint?: string;
  /** Adds a plain-text file picker above the field. */
  onFile?: (file: File) => void;
  fileError?: string;
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 12,
  maxLength,
  hint,
  onFile,
  fileError,
}: TextAreaFieldProps) {
  const id = useId();
  const near = value.length > maxLength * 0.9;

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onFile) onFile(file);
    // Reset so picking the same file twice still fires a change event.
    event.target.value = '';
  };

  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="label-caps">
          {label}
        </label>
        {onFile ? (
          <label className="cursor-pointer font-mono text-[0.7rem] text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">
            upload pdf / txt
            <input
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              className="sr-only"
              onChange={handleFile}
            />
          </label>
        ) : null}
      </div>

      <textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-[10px] border border-line bg-inset px-4 py-3.5 text-sm leading-relaxed text-ink placeholder:text-muted/70 focus:border-line-strong focus:outline-none"
      />

      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        <p className="text-xs text-muted">{fileError ?? hint}</p>
        <p className={`shrink-0 font-mono text-[0.7rem] ${near ? 'text-flag' : 'text-muted'}`}>
          {value.length.toLocaleString()}/{maxLength.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength: number;
  optional?: boolean;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  optional,
}: TextFieldProps) {
  const id = useId();

  return (
    <div className="flex min-w-0 flex-col">
      <label htmlFor={id} className="label-caps mb-2.5">
        {label}
        {optional ? <span className="ml-1.5 normal-case tracking-normal">(optional)</span> : null}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-[10px] border border-line bg-inset px-4 text-sm text-ink placeholder:text-muted/70 focus:border-line-strong focus:outline-none"
      />
    </div>
  );
}
