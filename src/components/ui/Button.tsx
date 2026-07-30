import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-white border-accent hover:bg-accent-hover disabled:bg-line-strong disabled:border-line-strong disabled:text-white/80',
  secondary:
    'bg-surface text-ink border-line-strong hover:border-ink hover:bg-white disabled:text-muted disabled:hover:border-line-strong',
  ghost:
    'bg-transparent text-ink-soft border-transparent hover:text-ink hover:bg-black/[0.04] disabled:text-muted',
};

const SIZES: Record<Size, string> = {
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-[0.95rem]',
};

function classes(variant: Variant, size: Size, className?: string) {
  return [
    'inline-flex items-center justify-center gap-2 rounded-full border font-medium',
    'transition-colors duration-150 disabled:cursor-not-allowed',
    VARIANTS[variant],
    SIZES[size],
    className ?? '',
  ].join(' ');
}

interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={classes(variant, size, className)} {...props}>
      {children}
    </button>
  );
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={classes(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
