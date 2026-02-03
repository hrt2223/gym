import Link from "next/link";
import { redirect } from "next/navigation";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  parse,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { requireUser } from "@/lib/auth";
import { createWorkout, getCalendarPageData } from "@/lib/repo";
import { Header } from "@/app/_components/Header";
import { Card } from "@/app/_components/Card";
import { formatYmd } from "@/lib/date";

export const revalidate = 60;

type PageProps = {
  searchParams: Promise<{ ym?: string }>;
};

export default async function CalendarPage({ searchParams }: PageProps) {
  const { ym } = await searchParams;

  const user = await requireUser();

  const today = new Date();
  const currentMonth = ym ? parse(ym, "yyyy-MM", new Date()) : today;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { monthData, weeklySummary } = await getCalendarPageData({
    userId: user.id,
    monthStartDate: format(monthStart, "yyyy-MM-dd"),
    monthEndDate: format(monthEnd, "yyyy-MM-dd"),
  });

  const monthSummary = monthData.summary;
  const hasWorkout = new Set(monthData.workoutDates);

  async function createTodayWorkout() {
    "use server";

    const user = await requireUser();

    const date = formatYmd(new Date());

    const created = await createWorkout({
      userId: user.id,
      workoutDate: date,
      memo: null,
    });

    if (!created) {
      redirect(`/day/${date}`);
    }

    redirect(`/workouts/${created.id}`);
  }

  // 週の並びを「月〜日」にする
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  for (
    let d = gridStart;
    d <= gridEnd;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  ) {
    days.push(d);
  }

  const prevYm = format(subMonths(currentMonth, 1), "yyyy-MM");
  const nextYm = format(addMonths(currentMonth, 1), "yyyy-MM");

  return (
    <div>
      <Header title={format(currentMonth, "yyyy年M月")} />
      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        <Card>
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-foreground">直近7日間</div>
            <div className="text-xs font-semibold text-accent">
              {weeklySummary.workoutDays}日 / {weeklySummary.totalSets}セット
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {(["胸", "背中", "肩", "腕", "脚", "腹"] as const).map((p) => {
              const count = weeklySummary.parts[p] ?? 0;
              return (
                <span
                  key={p}
                  className={`app-chip ${count > 0 ? 'bg-accent/10 border-accent/30 font-semibold' : ''}`}
                >
                  {p} {count}
                </span>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-foreground">今月</div>
            <div className="text-xs text-muted-foreground">
              {monthSummary.workoutDays}日 / {monthSummary.totalSets}セット
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {(["胸", "背中", "肩", "腕", "脚", "腹"] as const).map((p) => {
              const count = monthSummary.parts[p] ?? 0;
              const emoji = { "胸": "💪", "背中": "🔥", "肩": "💪", "腕": "💪", "脚": "🦵", "腹": "🔥" }[p];
              return (
                <span
                  key={p}
                  className={`app-chip ${count > 0 ? 'bg-muted' : ''}`}
                >
                  {emoji} {p} {count}
                </span>
              );
            })}
          </div>
        </Card>

        <div className="flex items-center justify-between">
          <Link
            className="app-pill text-sm"
            href={`/?ym=${prevYm}`}
            prefetch={true}
            aria-label="前の月へ"
          >
            ←
          </Link>
          <form action={createTodayWorkout}>
            <button className="app-pill app-pill-accent app-pill-lg text-sm font-bold shadow-lg" aria-label="今日のワークアウトを作成">
              ＋ 今日の記録
            </button>
          </form>
          <Link
            className="app-pill text-sm"
            href={`/?ym=${nextYm}`}
            prefetch={true}
            aria-label="次の月へ"
          >
            →
          </Link>
        </div>

        <Card>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-foreground">
            {["月", "火", "水", "木", "金", "土", "日"].map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((d) => {
              const ymd = formatYmd(d);
              const isToday = isSameDay(d, today);
              const marked = hasWorkout.has(ymd);

              return (
                <Link
                  key={ymd}
                  href={`/day/${ymd}`}
                  className={`app-day flex h-12 flex-col items-center justify-center text-sm text-foreground ${
                    marked ? "app-day-marked" : ""
                  } ${isToday ? "app-day-today" : ""}`}
                >
                  <div className="leading-none">{d.getDate()}</div>
                  <div className="mt-1 h-1.5">
                    {marked && (
                      <div className="app-day-dot" />
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      </main>
    </div>
  );
}
