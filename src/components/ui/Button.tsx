import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

/*
 * §6: on a dark canvas the primary action is a filled, glowing moss pill with near-black
 * label; secondary drops to a transparent hairline outline. That gap is what creates
 * single-choice architecture at the two moments that matter (hero CTA, next session).
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-on-accent border-accent shadow-[var(--shadow-cta)] hover:bg-accent-hover hover:border-accent-hover disabled:bg-accent/30 disabled:border-transparent disabled:text-on-accent/50 disabled:shadow-none',
  secondary:
    'bg-transparent text-ink border-line-strong hover:border-accent hover:bg-accent-wash disabled:text-muted disabled:hover:border-line-strong disabled:hover:bg-transparent',
  ghost:
    'bg-transparent text-ink-soft border-transparent hover:text-ink hover:bg-white/[0.05] disabled:text-muted',
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
