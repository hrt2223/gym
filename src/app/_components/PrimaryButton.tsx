export function PrimaryButton({
  children,
  type = "submit",
  className = "",
}: {
  children: React.ReactNode;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      className={`w-full rounded-xl bg-accent px-4 py-3 text-accent-foreground active:scale-[0.99] ${className}`}
    >
      {children}
    </button>
  );
}
