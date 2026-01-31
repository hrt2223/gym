export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-card rounded-2xl border border-border bg-card p-4">{children}</div>
  );
}
