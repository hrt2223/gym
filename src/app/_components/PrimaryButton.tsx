"use client";

import { useFormStatus } from "react-dom";

export function PrimaryButton({
  children,
  type = "submit",
  className = "",
  pendingText,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  type?: "button" | "submit";
  className?: string;
  pendingText?: string;
  "aria-label"?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type={type}
      disabled={pending}
      aria-disabled={pending}
      aria-label={ariaLabel}
      className={`app-primary w-full rounded-xl bg-accent px-4 py-3 text-accent-foreground disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
