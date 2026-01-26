import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

export type Exercise = {
  id: string;
  user_id: string;
  name: string;
  target_parts: string[];
  created_at: string;
};

export type Workout = {
  id: string;
  user_id: string;
  workout_date: string; // yyyy-MM-dd
  memo: string | null;
  created_at: string;
};

export type WorkoutExercise = {
  id: string;
  workout_id: string;
  exercise_id: string;
  sort_order: number;
};

export type ExerciseSet = {
  id: string;
  workout_exercise_id: string;
  set_order: number;
  weight: number | null;
  reps: number | null;
};

export type UserSettings = {
  user_id: string;
  gym_login_url: string | null;
  updated_at: string;
};

type LocalDb = {
  exercises: Exercise[];
  workouts: Workout[];
  workout_exercises: WorkoutExercise[];
  exercise_sets: ExerciseSet[];
  user_settings: UserSettings[];
};

const DEFAULT_DB: LocalDb = {
  exercises: [],
  workouts: [],
  workout_exercises: [],
  exercise_sets: [],
  user_settings: [],
};

function dbFilePath(): string {
  // リポジトリ直下に置く（gitignore 対象）
  return path.join(process.cwd(), ".localdb.json");
}

export async function readLocalDb(): Promise<LocalDb> {
  try {
    const raw = await fs.readFile(dbFilePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalDb>;
    return {
      exercises: parsed.exercises ?? [],
      workouts: parsed.workouts ?? [],
      workout_exercises: parsed.workout_exercises ?? [],
      exercise_sets: parsed.exercise_sets ?? [],
      user_settings: parsed.user_settings ?? [],
    };
  } catch {
    return { ...DEFAULT_DB };
  }
}

export async function writeLocalDb(db: LocalDb): Promise<void> {
  const file = dbFilePath();
  const tmp = `${file}.tmp`;
  const payload = JSON.stringify(db, null, 2);
  await fs.writeFile(tmp, payload, "utf8");

  try {
    // POSIX は上書きリネームが可能だが、Windows は既存ファイルがあると失敗しがち。
    await fs.rename(tmp, file);
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "EEXIST" || code === "EPERM" || code === "EACCES") {
      // フォールバック: 直接書き込み（MVP用途）
      await fs.writeFile(file, payload, "utf8");
      await fs.rm(tmp, { force: true });
      return;
    }
    throw err;
  }
}

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function sortByCreatedAtDesc<T extends { created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
}
