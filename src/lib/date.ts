import { format } from "date-fns";

export function formatYmd(date: Date): string {
  return format(date, "yyyy-MM-dd");
}
