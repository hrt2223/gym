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
import { createWorkout, getCalendarMonthData } from "@/lib/repo";
import { Header } from "@/app/_components/Header";
import { Card } from "@/app/_components/Card";
import { formatYmd } from "@/lib/date";

export const dynamic = "force-dynamic";

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

  const monthData = await getCalendarMonthData({
    userId: user.id,
    startDate: format(monthStart, "yyyy-MM-dd"),
    endDate: format(monthEnd, "yyyy-MM-dd"),
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
            <div className="text-sm font-semibold">今月</div>
            <div className="text-xs text-muted-foreground">
              {monthSummary.workoutDays}日 / {monthSummary.totalSets}セット
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {(["胸", "背中", "肩", "腕", "脚", "腹"] as const).map((p) => (
              <span
                key={p}
                className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground"
              >
                {p} {monthSummary.parts[p] ?? 0}
              </span>
            ))}
          </div>
        </Card>

        <div className="flex items-center justify-between">
          <Link
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            href={`/?ym=${prevYm}`}
          >
            ←
          </Link>
          <form action={createTodayWorkout}>
            <button className="rounded-full bg-accent px-4 py-3 text-sm text-accent-foreground">
              ＋ 今日の記録
            </button>
          </form>
          <Link
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            href={`/?ym=${nextYm}`}
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
                  className={`flex h-12 flex-col items-center justify-center rounded-lg text-sm ${
                    "text-foreground"
                  } ${isToday ? "ring-2 ring-accent" : ""} ${
                    marked ? "bg-muted" : ""
                  }`}
                >
                  <div className="leading-none">{d.getDate()}</div>
                  <div className="mt-1 h-1.5">
                    {marked && (
                      <div className="h-1.5 w-1.5 rounded-full bg-accent" />
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
