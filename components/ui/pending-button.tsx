"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Inline spinner. Inherits the button text color so it stays on the control that was clicked. */
export function Spinner({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="opacity-90"
      />
    </svg>
  );
}

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-60";

export const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--google-red)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean;
  pendingLabel?: ReactNode;
};

export function PendingButton({
  pending = false,
  pendingLabel,
  children,
  className,
  disabled,
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={className}
    >
      {pending ? <Spinner /> : null}
      <span>{pending ? (pendingLabel ?? children) : children}</span>
    </button>
  );
}

/** Submit control for a server action form. Spinner stays on this button only. */
export function FormSubmit({
  pendingLabel,
  children,
  ...rest
}: Omit<Props, "pending" | "type">) {
  const { pending } = useFormStatus();
  return (
    <PendingButton type="submit" pending={pending} pendingLabel={pendingLabel} {...rest}>
      {children}
    </PendingButton>
  );
}
