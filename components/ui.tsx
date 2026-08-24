import { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "amber";
  size?: "md" | "lg" | "sm";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none";
  const variants: Record<string, string> = {
    primary: "bg-[var(--color-primary)] text-white hover:brightness-110 active:scale-[0.98] shadow-[0_1px_0_rgba(0,0,0,0.05)]",
    secondary: "bg-white text-[var(--color-ink)] border border-[var(--color-line)] hover:border-[var(--color-primary)]",
    ghost: "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:bg-black/5",
    amber: "bg-[var(--color-amber)] text-[var(--color-ink)] hover:brightness-105 active:scale-[0.98]",
  };
  const sizes: Record<string, string> = {
    sm: "text-sm px-3.5 py-1.5",
    md: "text-[15px] px-5 py-2.5",
    lg: "text-base px-7 py-3.5",
  };
  return (
    <button className={clsx(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={clsx("card-surface p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "amber" | "flag";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-black/[0.04] text-[var(--color-ink-soft)]",
    primary: "bg-[var(--color-primary-dim)] text-[var(--color-primary)]",
    amber: "bg-[var(--color-amber-dim)] text-[#8a5c17]",
    flag: "bg-[var(--color-flag-dim)] text-[var(--color-flag)]",
  };
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}
