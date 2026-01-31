"use client";

import { useFormStatus } from "react-dom";

export function PrimaryButton({
  children,
  type = "submit",
  className = "",
  pendingText,
}: {
  children: React.ReactNode;
  type?: "button" | "submit";
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type={type}
      disabled={pending}
      aria-disabled={pending}
      className={`w-full rounded-xl bg-accent px-4 py-3 text-accent-foreground active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
