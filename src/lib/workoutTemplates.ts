export type WorkoutTemplate = {
  id: string;
  name: string;
  exerciseIds: string[];
  updatedAt: number;
};

const STORAGE_KEY = "gymapp.workoutTemplates.v1";

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeTemplates(input: unknown): WorkoutTemplate[] {
  if (!Array.isArray(input)) return [];

  const out: WorkoutTemplate[] = [];
  for (const row of input) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;

    const id = typeof r.id === "string" ? r.id : "";
    const name = typeof r.name === "string" ? r.name : "";
    const updatedAt = typeof r.updatedAt === "number" ? r.updatedAt : 0;
    const exerciseIdsRaw = Array.isArray(r.exerciseIds) ? r.exerciseIds : [];
    const exerciseIds = exerciseIdsRaw.map(String).filter((s) => s.trim().length > 0);

    if (!id || !name) continue;

    out.push({
      id,
      name,
      exerciseIds,
      updatedAt,
    });
  }

  out.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return out;
}

export function loadWorkoutTemplates(): WorkoutTemplate[] {
  if (typeof window === "undefined") return [];
  const parsed = safeJsonParse<unknown>(window.localStorage.getItem(STORAGE_KEY));
  return normalizeTemplates(parsed);
}

export function saveWorkoutTemplates(templates: WorkoutTemplate[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function upsertWorkoutTemplate(input: {
  name: string;
  exerciseIds: string[];
}): WorkoutTemplate {
  const now = Date.now();
  const id = `${now}-${Math.random().toString(16).slice(2)}`;

  const template: WorkoutTemplate = {
    id,
    name: input.name.trim() || "テンプレ",
    exerciseIds: Array.from(new Set(input.exerciseIds.map(String))).filter((s) => s.trim().length > 0),
    updatedAt: now,
  };

  const existing = loadWorkoutTemplates();
  const next = [template, ...existing];
  saveWorkoutTemplates(next);

  return template;
}

export function deleteWorkoutTemplate(id: string): void {
  const existing = loadWorkoutTemplates();
  saveWorkoutTemplates(existing.filter((t) => t.id !== id));
}
