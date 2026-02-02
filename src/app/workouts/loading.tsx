import { Header } from "@/app/_components/Header";

export default function Loading() {
  return (
    <div>
      <Header title="読込中..." />
      <main className="mx-auto max-w-md px-4 py-4">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-zinc-400"></div>
        </div>
      </main>
    </div>
  );
}
