import { Card } from "./Card";

type MonthSummary = {
  workoutDays: number;
  totalSets: number;
  parts: Record<string, number>;
};

export async function CalendarSummary({
  weeklySummary,
  monthSummary,
}: {
  weeklySummary: MonthSummary;
  monthSummary: MonthSummary;
}) {
  return (
    <>
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
                className={`app-chip ${count > 0 ? "bg-accent/10 border-accent/30 font-semibold" : ""}`}
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
            return (
              <span
                key={p}
                className={`app-chip ${count > 0 ? "bg-muted" : ""}`}
              >
                {p} {count}
              </span>
            );
          })}
        </div>
      </Card>
    </>
  );
}
