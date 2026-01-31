import { isLocalOnly } from "@/lib/appMode";
import { GYM_MACHINE_PRESET_EXERCISES } from "@/lib/exercisePresets";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  nowIso,
  newId,
  readLocalDb,
  writeLocalDb,
  type Exercise,
  type ExerciseSet,
  type UserSettings,
  type Workout,
} from "@/lib/localdb";

export async function getGymLoginUrl(userId: string): Promise<string | null> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("user_settings")
      .select("gym_login_url")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("getGymLoginUrl failed", error);
      return null;
    }

    return (data as { gym_login_url?: string | null } | null)?.gym_login_url ?? null;
  }

  const db = await readLocalDb();
  const row = db.user_settings.find((s) => s.user_id === userId);
  return row?.gym_login_url ?? null;
}

export async function upsertGymLoginUrl(input: {
  userId: string;
  gymLoginUrl: string | null;
}): Promise<void> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: input.userId,
        gym_login_url: input.gymLoginUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  const db = await readLocalDb();
  const existing = db.user_settings.find((s) => s.user_id === input.userId);
  const now = nowIso();

  if (existing) {
    existing.gym_login_url = input.gymLoginUrl;
    existing.updated_at = now;
  } else {
    const row: UserSettings = {
      user_id: input.userId,
      gym_login_url: input.gymLoginUrl,
      updated_at: now,
    };
    db.user_settings.push(row);
  }

  await writeLocalDb(db);
}

export async function listExercises(userId: string): Promise<Exercise[]> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("exercises")
      .select("id, user_id, name, target_parts, created_at")
      .order("created_at", { ascending: false });
    return (data ?? []) as Exercise[];
  }

  const db = await readLocalDb();
  return db.exercises
    .filter((e) => e.user_id === userId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
}

export async function getExercise(userId: string, id: string): Promise<Exercise | null> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("exercises")
      .select("id, user_id, name, target_parts, created_at")
      .eq("id", id)
      .single();
    return (data as Exercise) ?? null;
  }

  const db = await readLocalDb();
  return db.exercises.find((e) => e.user_id === userId && e.id === id) ?? null;
}

export async function createExercise(input: {
  userId: string;
  name: string;
  targetParts: string[];
}): Promise<void> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    await supabase.from("exercises").insert({
      user_id: input.userId,
      name: input.name,
      target_parts: input.targetParts,
    });
    return;
  }

  const db = await readLocalDb();
  db.exercises.push({
    id: newId(),
    user_id: input.userId,
    name: input.name,
    target_parts: input.targetParts,
    created_at: nowIso(),
  });
  await writeLocalDb(db);
}

export async function createExercisesBestEffort(input: {
  userId: string;
  exercises: { name: string; targetParts: string[] }[];
}): Promise<{ attempted: number; inserted: number }> {
  const deduped = Array.from(
    new Map(
      input.exercises
        .map((e) => ({ name: e.name.trim(), targetParts: e.targetParts }))
        .filter((e) => e.name.length > 0)
        .map((e) => [e.name.toLowerCase(), e] as const)
    ).values()
  );

  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    let inserted = 0;

    for (const e of deduped) {
      const { error } = await supabase.from("exercises").insert({
        user_id: input.userId,
        name: e.name,
        target_parts: e.targetParts,
      });

      if (!error) {
        inserted += 1;
      }
    }

    return { attempted: deduped.length, inserted };
  }

  const db = await readLocalDb();
  const existingLower = new Set(
    db.exercises
      .filter((row) => row.user_id === input.userId)
      .map((row) => row.name.trim().toLowerCase())
  );

  let inserted = 0;
  for (const e of deduped) {
    const lower = e.name.toLowerCase();
    if (existingLower.has(lower)) continue;
    existingLower.add(lower);
    db.exercises.push({
      id: newId(),
      user_id: input.userId,
      name: e.name,
      target_parts: e.targetParts,
      created_at: nowIso(),
    });
    inserted += 1;
  }

  await writeLocalDb(db);
  return { attempted: deduped.length, inserted };
}

export async function seedDefaultExercisesIfEmpty(userId: string): Promise<boolean> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    const presetNames = GYM_MACHINE_PRESET_EXERCISES.map((e) => e.name);
    const { data, error } = await supabase
      .from("exercises")
      .select("name")
      .in("name", presetNames);

    if (error) {
      console.error("seedDefaultExercisesIfEmpty: select failed", error);
      return false;
    }

    const existing = new Set((data ?? []).map((row) => String((row as { name?: string }).name ?? "")));
    if (existing.size >= presetNames.length) return false;

    const result = await createExercisesBestEffort({
      userId,
      exercises: GYM_MACHINE_PRESET_EXERCISES,
    });
    return result.inserted > 0;
  }

  const db = await readLocalDb();
  const presetLower = new Set(
    GYM_MACHINE_PRESET_EXERCISES.map((e) => e.name.trim().toLowerCase()).filter((n) => n.length > 0)
  );
  const existingPresetLower = new Set(
    db.exercises
      .filter((e) => e.user_id === userId)
      .map((e) => e.name.trim().toLowerCase())
      .filter((n) => presetLower.has(n))
  );
  if (existingPresetLower.size >= presetLower.size) return false;

  const result = await createExercisesBestEffort({
    userId,
    exercises: GYM_MACHINE_PRESET_EXERCISES,
  });
  return result.inserted > 0;
}

export async function updateExercise(input: {
  userId: string;
  id: string;
  name: string;
  targetParts: string[];
}): Promise<void> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    await supabase
      .from("exercises")
      .update({ name: input.name, target_parts: input.targetParts })
      .eq("id", input.id);
    return;
  }

  const db = await readLocalDb();
  const ex = db.exercises.find((e) => e.user_id === input.userId && e.id === input.id);
  if (!ex) return;
  ex.name = input.name;
  ex.target_parts = input.targetParts;
  await writeLocalDb(db);
}

export async function deleteExercise(userId: string, id: string): Promise<void> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    await supabase.from("exercises").delete().eq("id", id);
    return;
  }

  const db = await readLocalDb();
  db.exercises = db.exercises.filter((e) => !(e.user_id === userId && e.id === id));
  // 参照している workout_exercises は残すが、UI では名前が空になる可能性あり
  await writeLocalDb(db);
}

export async function getWorkout(userId: string, id: string): Promise<Workout | null> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("workouts")
      .select("id, user_id, workout_date, memo, created_at")
      .eq("id", id)
      .single();
    return (data as Workout) ?? null;
  }

  const db = await readLocalDb();
  return db.workouts.find((w) => w.user_id === userId && w.id === id) ?? null;
}

export async function updateWorkout(input: {
  userId: string;
  id: string;
  workoutDate: string;
  memo: string | null;
}): Promise<void> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    await supabase
      .from("workouts")
      .update({ workout_date: input.workoutDate, memo: input.memo })
      .eq("id", input.id);
    return;
  }

  const db = await readLocalDb();
  const w = db.workouts.find((row) => row.user_id === input.userId && row.id === input.id);
  if (!w) return;
  w.workout_date = input.workoutDate;
  w.memo = input.memo;
  await writeLocalDb(db);
}

export async function createWorkout(input: {
  userId: string;
  workoutDate: string;
  memo: string | null;
}): Promise<{ id: string } | null> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("workouts")
      .insert({ user_id: input.userId, workout_date: input.workoutDate, memo: input.memo })
      .select("id")
      .single();
    return data ? { id: String((data as { id: string }).id) } : null;
  }

  const db = await readLocalDb();
  const id = newId();
  db.workouts.push({
    id,
    user_id: input.userId,
    workout_date: input.workoutDate,
    memo: input.memo,
    created_at: nowIso(),
  });
  await writeLocalDb(db);
  return { id };
}

export async function listWorkoutsInRange(input: {
  userId: string;
  startDate: string;
  endDate: string;
}): Promise<{ workout_date: string }[]> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("workouts")
      .select("workout_date")
      .gte("workout_date", input.startDate)
      .lte("workout_date", input.endDate);
    return (data ?? []) as { workout_date: string }[];
  }

  const db = await readLocalDb();
  return db.workouts
    .filter((w) => w.user_id === input.userId)
    .filter((w) => w.workout_date >= input.startDate && w.workout_date <= input.endDate)
    .map((w) => ({ workout_date: w.workout_date }));
}

export async function listWorkoutsByDate(input: {
  userId: string;
  date: string;
}): Promise<Workout[]> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("workouts")
      .select("id, workout_date, memo, created_at, user_id")
      .eq("workout_date", input.date)
      .order("created_at", { ascending: true });
    return (data ?? []) as Workout[];
  }

  const db = await readLocalDb();
  return db.workouts
    .filter((w) => w.user_id === input.userId && w.workout_date === input.date)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
}

export type WorkoutSummary = {
  id: string;
  workout_date: string;
  memo: string | null;
  created_at: string;
  user_id: string;
  exercises: { name: string }[];
};

export type WorkoutMenu = {
  id: string;
  workout_date: string;
  memo: string | null;
  created_at: string;
  user_id: string;
  workout_exercises: Array<{
    id: string;
    sort_order: number;
    exercise_name: string;
    sets: Array<{ set_order: number; weight: number | null; reps: number | null }>;
  }>;
};

export type TopSet = { weight: number | null; reps: number | null };

function pickTopSet(sets: Array<{ weight: number | null; reps: number | null }>): TopSet | null {
  if (!sets.length) return null;

  let best: TopSet | null = null;
  let bestWeight = -1;
  let bestReps = -1;

  for (const s of sets) {
    const w = s.weight == null ? -1 : Number(s.weight);
    const r = s.reps == null ? -1 : Number(s.reps);
    if (!Number.isFinite(w) && w !== -1) continue;
    if (!Number.isFinite(r) && r !== -1) continue;

    if (w > bestWeight || (w === bestWeight && r > bestReps)) {
      bestWeight = w;
      bestReps = r;
      best = { weight: s.weight ?? null, reps: s.reps ?? null };
    }
  }

  // すべて null のときは表示しない
  if (!best) return null;
  if (best.weight == null && best.reps == null) return null;
  return best;
}

export async function listPreviousTopSetsBefore(input: {
  userId: string;
  beforeWorkout: { workoutDate: string; createdAt: string };
  exerciseIds: string[];
}): Promise<Record<string, TopSet | null>> {
  const result: Record<string, TopSet | null> = {};
  for (const id of input.exerciseIds) result[id] = null;
  if (input.exerciseIds.length === 0) return result;

  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();

    const { data } = await supabase
      .from("workout_exercises")
      .select(
        "id, exercise_id, workout_id, workouts!inner(workout_date, created_at, user_id), exercise_sets(weight, reps)"
      )
      .in("exercise_id", input.exerciseIds)
      .eq("workouts.user_id", input.userId)
      .or(
        `workouts.workout_date.lt.${input.beforeWorkout.workoutDate},and(workouts.workout_date.eq.${input.beforeWorkout.workoutDate},workouts.created_at.lt.${input.beforeWorkout.createdAt})`
      )
      .order("workout_date", { foreignTable: "workouts", ascending: false })
      .order("created_at", { foreignTable: "workouts", ascending: false })
      .order("id", { ascending: false });

    const rows = (data ?? []) as Array<{
      exercise_id: string;
      exercise_sets?: Array<{ weight: number | null; reps: number | null } | null> | null;
    }>;

    for (const row of rows) {
      const exerciseId = String(row.exercise_id);
      if (!(exerciseId in result)) continue;
      if (result[exerciseId] !== null) continue;
      const sets = (row.exercise_sets ?? []).filter(Boolean) as Array<{ weight: number | null; reps: number | null }>;
      result[exerciseId] = pickTopSet(sets);
    }

    return result;
  }

  const db = await readLocalDb();

  // beforeWorkout より「前」の workout を抽出
  const beforeDate = input.beforeWorkout.workoutDate;
  const beforeCreatedAt = input.beforeWorkout.createdAt;
  const candidates = db.workouts
    .filter((w) => w.user_id === input.userId)
    .filter((w) => {
      if (w.workout_date < beforeDate) return true;
      if (w.workout_date > beforeDate) return false;
      return w.created_at < beforeCreatedAt;
    })
    .sort((a, b) => {
      if (a.workout_date !== b.workout_date) return a.workout_date < b.workout_date ? 1 : -1;
      return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
    });

  for (const exerciseId of input.exerciseIds) {
    let found: TopSet | null = null;

    for (const w of candidates) {
      const wes = db.workout_exercises
        .filter((we) => we.workout_id === w.id && we.exercise_id === exerciseId)
        .sort((a, b) => (a.sort_order < b.sort_order ? -1 : a.sort_order > b.sort_order ? 1 : a.id.localeCompare(b.id)));

      if (wes.length === 0) continue;

      const sets = wes.flatMap((we) =>
        db.exercise_sets
          .filter((s) => s.workout_exercise_id === we.id)
          .map((s) => ({ weight: s.weight, reps: s.reps }))
      );

      found = pickTopSet(sets);
      break;
    }

    result[exerciseId] = found;
  }

  return result;
}

export async function getPreviousTopSet(input: {
  userId: string;
  beforeWorkoutId: string;
  exerciseId: string;
}): Promise<TopSet | null> {
  const before = await getWorkout(input.userId, input.beforeWorkoutId);
  if (!before) return null;

  const map = await listPreviousTopSetsBefore({
    userId: input.userId,
    beforeWorkout: { workoutDate: before.workout_date, createdAt: before.created_at },
    exerciseIds: [input.exerciseId],
  });

  return map[input.exerciseId] ?? null;
}

export type ExerciseHistoryItem = {
  workout_id: string;
  workout_date: string;
  workout_created_at: string;
  sets: Array<{ set_order: number; weight: number | null; reps: number | null }>;
};

export async function listExerciseHistory(input: {
  userId: string;
  exerciseId: string;
  limit?: number;
}): Promise<ExerciseHistoryItem[]> {
  const limit = input.limit ?? 30;

  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("workout_exercises")
      .select(
        "id, workout_id, workouts!inner(workout_date, created_at, user_id), exercise_sets(set_order, weight, reps)"
      )
      .eq("exercise_id", input.exerciseId)
      .eq("workouts.user_id", input.userId)
      .order("workout_date", { foreignTable: "workouts", ascending: false })
      .order("created_at", { foreignTable: "workouts", ascending: false })
      .limit(limit);

    const rows = ((data ?? []) as unknown) as Array<{
      workout_id: string;
      workouts?: { workout_date: string; created_at: string; user_id: string } | null;
      exercise_sets?: Array<{ set_order: number; weight: number | null; reps: number | null } | null> | null;
    }>;

    const grouped = new Map<string, ExerciseHistoryItem>();
    for (const r of rows) {
      const w = r.workouts;
      if (!w) continue;
      const key = r.workout_id;
      const existing = grouped.get(key);
      const sets = (r.exercise_sets ?? [])
        .filter((s): s is { set_order: number; weight: number | null; reps: number | null } => s != null)
        .map((s) => ({ set_order: s.set_order, weight: s.weight ?? null, reps: s.reps ?? null }))
        .sort((a, b) => a.set_order - b.set_order);

      if (!existing) {
        grouped.set(key, {
          workout_id: r.workout_id,
          workout_date: w.workout_date,
          workout_created_at: w.created_at,
          sets,
        });
      } else {
        existing.sets = [...existing.sets, ...sets].sort((a, b) => a.set_order - b.set_order);
      }
    }

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.workout_date !== b.workout_date) return a.workout_date < b.workout_date ? 1 : -1;
      return a.workout_created_at < b.workout_created_at ? 1 : a.workout_created_at > b.workout_created_at ? -1 : 0;
    });
  }

  const db = await readLocalDb();
  const wes = db.workout_exercises
    .filter((we) => we.exercise_id === input.exerciseId)
    .map((we) => ({
      we,
      w: db.workouts.find((w) => w.user_id === input.userId && w.id === we.workout_id) ?? null,
    }))
    .filter((row): row is { we: typeof row.we; w: Workout } => Boolean(row.w))
    .sort((a, b) => {
      if (a.w.workout_date !== b.w.workout_date) return a.w.workout_date < b.w.workout_date ? 1 : -1;
      return a.w.created_at < b.w.created_at ? 1 : a.w.created_at > b.w.created_at ? -1 : 0;
    })
    .slice(0, limit);

  const grouped = new Map<string, ExerciseHistoryItem>();
  for (const row of wes) {
    const key = row.w.id;
    const sets = db.exercise_sets
      .filter((s) => s.workout_exercise_id === row.we.id)
      .sort((a, b) => (a.set_order < b.set_order ? -1 : a.set_order > b.set_order ? 1 : a.id.localeCompare(b.id)))
      .map((s) => ({ set_order: s.set_order, weight: s.weight, reps: s.reps }));

    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        workout_id: row.w.id,
        workout_date: row.w.workout_date,
        workout_created_at: row.w.created_at,
        sets,
      });
    } else {
      existing.sets = [...existing.sets, ...sets].sort((a, b) => a.set_order - b.set_order);
    }
  }

  return Array.from(grouped.values());
}

export type MonthSummary = {
  workoutDays: number;
  totalSets: number;
  parts: Record<string, number>;
};

export type CalendarMonthData = {
  summary: MonthSummary;
  workoutDates: string[];
};

export async function getCalendarMonthData(input: {
  userId: string;
  startDate: string;
  endDate: string;
}): Promise<CalendarMonthData> {
  const parts: Record<string, number> = { 胸: 0, 背中: 0, 肩: 0, 腕: 0, 脚: 0, 腹: 0 };

  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();

    const { data: workouts } = await supabase
      .from("workouts")
      .select("id, workout_date")
      .gte("workout_date", input.startDate)
      .lte("workout_date", input.endDate);

    const workoutRows = ((workouts ?? []) as unknown) as Array<{ id: string; workout_date: string }>;
    const workoutIds = workoutRows.map((w) => w.id);
    const workoutDates = Array.from(new Set(workoutRows.map((w) => w.workout_date))).sort();
    const workoutDays = workoutDates.length;

    if (workoutIds.length === 0) {
      return { summary: { workoutDays, totalSets: 0, parts }, workoutDates };
    }

    type WorkoutExerciseJoin = {
      id: string;
      exercise_id: string;
      exercise_sets?: Array<{ id: string } | null> | null;
      exercises?: { target_parts?: string[] | null } | { target_parts?: string[] | null }[] | null;
    };

    const { data: wes } = await supabase
      .from("workout_exercises")
      .select("id, exercise_id, workout_id, exercises(target_parts), exercise_sets(id)")
      .in("workout_id", workoutIds);

    const weRows = ((wes ?? []) as unknown) as Array<WorkoutExerciseJoin>;

    let totalSets = 0;
    for (const we of weRows) {
      const exRel = we.exercises;
      const targetParts = Array.isArray(exRel)
        ? (exRel[0]?.target_parts ?? [])
        : (exRel?.target_parts ?? []);

      const setsRaw = Array.isArray(we.exercise_sets) ? we.exercise_sets : [];
      const setsCount = setsRaw.filter((s) => s != null).length;
      totalSets += setsCount;

      for (let i = 0; i < setsCount; i += 1) {
        for (const p of targetParts) {
          if (typeof parts[p] === "number") parts[p] += 1;
        }
      }
    }

    return { summary: { workoutDays, totalSets, parts }, workoutDates };
  }

  const db = await readLocalDb();

  const workouts = db.workouts
    .filter((w) => w.user_id === input.userId)
    .filter((w) => w.workout_date >= input.startDate && w.workout_date <= input.endDate);

  const workoutDates = Array.from(new Set(workouts.map((w) => w.workout_date))).sort();
  const workoutDays = workoutDates.length;
  const workoutIds = new Set(workouts.map((w) => w.id));

  const wes = db.workout_exercises.filter((we) => workoutIds.has(we.workout_id));
  const weIds = new Set(wes.map((we) => we.id));
  const weToExercise = new Map(wes.map((we) => [we.id, we.exercise_id] as const));

  const exParts = new Map(
    db.exercises
      .filter((e) => e.user_id === input.userId)
      .map((e) => [e.id, e.target_parts ?? []] as const)
  );

  let totalSets = 0;
  for (const s of db.exercise_sets) {
    if (!weIds.has(s.workout_exercise_id)) continue;
    totalSets += 1;

    const exerciseId = weToExercise.get(s.workout_exercise_id);
    if (!exerciseId) continue;
    const ps = exParts.get(exerciseId) ?? [];
    for (const p of ps) {
      if (typeof parts[p] === "number") parts[p] += 1;
    }
  }

  return { summary: { workoutDays, totalSets, parts }, workoutDates };
}

export async function getMonthSummary(input: {
  userId: string;
  startDate: string;
  endDate: string;
}): Promise<MonthSummary> {
  const parts: Record<string, number> = { 胸: 0, 背中: 0, 肩: 0, 腕: 0, 脚: 0, 腹: 0 };

  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();

    const { data: workouts } = await supabase
      .from("workouts")
      .select("id, workout_date")
      .gte("workout_date", input.startDate)
      .lte("workout_date", input.endDate);

    const workoutRows = ((workouts ?? []) as unknown) as Array<{ id: string; workout_date: string }>;
    const workoutIds = workoutRows.map((w) => w.id);
    const workoutDays = new Set(workoutRows.map((w) => w.workout_date)).size;
    if (workoutIds.length === 0) return { workoutDays, totalSets: 0, parts };

    const { data: wes } = await supabase
      .from("workout_exercises")
      .select("id, workout_id, exercise_id")
      .in("workout_id", workoutIds);

    const weRows = ((wes ?? []) as unknown) as Array<{ id: string; exercise_id: string }>;
    const weIds = weRows.map((we) => we.id);
    const exerciseIds = Array.from(new Set(weRows.map((we) => we.exercise_id)));
    if (weIds.length === 0) return { workoutDays, totalSets: 0, parts };

    const { data: sets } = await supabase
      .from("exercise_sets")
      .select("id, workout_exercise_id")
      .in("workout_exercise_id", weIds);

    const setRows = ((sets ?? []) as unknown) as Array<{ workout_exercise_id: string }>;
    const totalSets = setRows.length;

    const { data: exs } = await supabase
      .from("exercises")
      .select("id, target_parts")
      .in("id", exerciseIds);

    const exRows = ((exs ?? []) as unknown) as Array<{ id: string; target_parts: string[] }>;
    const exParts = new Map(exRows.map((e) => [e.id, e.target_parts ?? []]));
    const weToExercise = new Map(weRows.map((we) => [we.id, we.exercise_id]));

    for (const s of setRows) {
      const exerciseId = weToExercise.get(s.workout_exercise_id);
      if (!exerciseId) continue;
      const ps = exParts.get(exerciseId) ?? [];
      for (const p of ps) {
        if (typeof parts[p] === "number") parts[p] += 1;
      }
    }

    return { workoutDays, totalSets, parts };
  }

  const db = await readLocalDb();
  const workouts = db.workouts
    .filter((w) => w.user_id === input.userId)
    .filter((w) => w.workout_date >= input.startDate && w.workout_date <= input.endDate);

  const workoutDays = new Set(workouts.map((w) => w.workout_date)).size;
  const workoutIds = new Set(workouts.map((w) => w.id));

  const wes = db.workout_exercises.filter((we) => workoutIds.has(we.workout_id));
  const weIds = new Set(wes.map((we) => we.id));
  const weToExercise = new Map(wes.map((we) => [we.id, we.exercise_id]));

  const totalSets = db.exercise_sets.filter((s) => weIds.has(s.workout_exercise_id)).length;

  const exParts = new Map(
    db.exercises
      .filter((e) => e.user_id === input.userId)
      .map((e) => [e.id, e.target_parts ?? []] as const)
  );

  for (const s of db.exercise_sets) {
    const exerciseId = weToExercise.get(s.workout_exercise_id);
    if (!exerciseId) continue;
    const ps = exParts.get(exerciseId) ?? [];
    for (const p of ps) {
      if (typeof parts[p] === "number") parts[p] += 1;
    }
  }

  return { workoutDays, totalSets, parts };
}

export async function listWorkoutsMenuByDate(input: {
  userId: string;
  date: string;
}): Promise<WorkoutMenu[]> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();

    type SetJoin = {
      set_order: number;
      weight: number | null;
      reps: number | null;
    };

    type WorkoutExerciseJoin = {
      id: string;
      sort_order: number;
      exercises?: { name?: string } | { name?: string }[] | null;
      exercise_sets?:
        | Array<
            | SetJoin
            | null
          >
        | null;
    };

    const { data } = await supabase
      .from("workouts")
      .select(
        "id, workout_date, memo, created_at, user_id, workout_exercises(id, sort_order, exercises(name), exercise_sets(set_order, weight, reps))"
      )
      .eq("workout_date", input.date)
      .order("created_at", { ascending: true });

    const rows = ((data ?? []) as unknown) as Array<{
      id: string;
      workout_date: string;
      memo: string | null;
      created_at: string;
      user_id: string;
      workout_exercises?: Array<WorkoutExerciseJoin | null> | null;
    }>;

    return rows.map((w) => {
      const workoutExercisesRaw = Array.isArray(w.workout_exercises) ? w.workout_exercises : [];
      const workoutExercises = workoutExercisesRaw
        .filter((we): we is WorkoutExerciseJoin => we != null)
        .map((we) => {
          const exRel = we.exercises;
          const exerciseName = Array.isArray(exRel)
            ? String(exRel[0]?.name ?? "")
            : String(exRel?.name ?? "");

          const setsRaw = Array.isArray(we.exercise_sets) ? we.exercise_sets : [];
          const sets = setsRaw
            .filter((s): s is SetJoin => s != null)
            .map((s) => ({ set_order: s.set_order, weight: s.weight ?? null, reps: s.reps ?? null }))
            .sort((a, b) => a.set_order - b.set_order);

          return {
            id: we.id,
            sort_order: Number.isFinite(we.sort_order) ? we.sort_order : 0,
            exercise_name: exerciseName,
            sets,
          };
        })
        .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));

      return {
        id: w.id,
        workout_date: w.workout_date,
        memo: w.memo,
        created_at: w.created_at,
        user_id: w.user_id,
        workout_exercises: workoutExercises,
      };
    });
  }

  const db = await readLocalDb();
  const workouts = db.workouts
    .filter((w) => w.user_id === input.userId && w.workout_date === input.date)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));

  return workouts.map((w) => {
    const workoutExercises = db.workout_exercises
      .filter((we) => we.workout_id === w.id)
      .sort((a, b) => (a.sort_order < b.sort_order ? -1 : a.sort_order > b.sort_order ? 1 : a.id.localeCompare(b.id)))
      .map((we) => {
        const ex = db.exercises.find((e) => e.user_id === input.userId && e.id === we.exercise_id);
        const sets = db.exercise_sets
          .filter((s) => s.workout_exercise_id === we.id)
          .sort((a, b) => (a.set_order < b.set_order ? -1 : a.set_order > b.set_order ? 1 : a.id.localeCompare(b.id)))
          .map((s) => ({ set_order: s.set_order, weight: s.weight, reps: s.reps }));

        return {
          id: we.id,
          sort_order: we.sort_order,
          exercise_name: ex?.name ?? "",
          sets,
        };
      });

    return {
      id: w.id,
      workout_date: w.workout_date,
      memo: w.memo,
      created_at: w.created_at,
      user_id: w.user_id,
      workout_exercises: workoutExercises,
    };
  });
}

export async function deleteWorkout(input: { userId: string; workoutId: string }): Promise<void> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    await supabase.from("workouts").delete().eq("id", input.workoutId);
    return;
  }

  const db = await readLocalDb();
  const workout = db.workouts.find((w) => w.user_id === input.userId && w.id === input.workoutId);
  if (!workout) return;

  const workoutExerciseIds = db.workout_exercises
    .filter((we) => we.workout_id === input.workoutId)
    .map((we) => we.id);

  db.exercise_sets = db.exercise_sets.filter((s) => !workoutExerciseIds.includes(s.workout_exercise_id));
  db.workout_exercises = db.workout_exercises.filter((we) => we.workout_id !== input.workoutId);
  db.workouts = db.workouts.filter((w) => !(w.user_id === input.userId && w.id === input.workoutId));

  await writeLocalDb(db);
}

export async function listWorkoutsWithExercisesByDate(input: {
  userId: string;
  date: string;
}): Promise<WorkoutSummary[]> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();

    const { data } = await supabase
      .from("workouts")
      .select(
        "id, workout_date, memo, created_at, user_id, workout_exercises(exercises(name))"
      )
      .eq("workout_date", input.date)
      .order("created_at", { ascending: true });

    const rows = ((data ?? []) as unknown) as Array<{
      id: string;
      workout_date: string;
      memo: string | null;
      created_at: string;
      user_id: string;
      workout_exercises?: Array<
        | {
            exercises?: { name?: string } | { name?: string }[] | null;
          }
        | null
      > | null;
    }>;

    return rows.map((w) => {
      const exercises = (w.workout_exercises ?? []).flatMap((we) => {
        const exRel = we?.exercises;
        if (!exRel) return [];
        if (Array.isArray(exRel)) {
          return exRel
            .map((ex) => ({ name: String(ex?.name ?? "") }))
            .filter((ex) => ex.name.length > 0);
        }
        const name = String(exRel.name ?? "");
        return name ? [{ name }] : [];
      });

      return {
        id: w.id,
        workout_date: w.workout_date,
        memo: w.memo,
        created_at: w.created_at,
        user_id: w.user_id,
        exercises,
      };
    });
  }

  const db = await readLocalDb();
  const workouts = db.workouts
    .filter((w) => w.user_id === input.userId && w.workout_date === input.date)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));

  return workouts.map((w) => {
    const workoutExercises = db.workout_exercises
      .filter((we) => we.workout_id === w.id)
      .sort((a, b) => (a.sort_order < b.sort_order ? -1 : a.sort_order > b.sort_order ? 1 : a.id.localeCompare(b.id)));

    const exercises = workoutExercises
      .map((we) => db.exercises.find((e) => e.user_id === input.userId && e.id === we.exercise_id))
      .filter((e): e is Exercise => Boolean(e))
      .map((e) => ({ name: e.name }));

    return {
      id: w.id,
      workout_date: w.workout_date,
      memo: w.memo,
      created_at: w.created_at,
      user_id: w.user_id,
      exercises,
    };
  });
}

export type WorkoutExerciseRow = {
  id: string;
  exercise_id: string;
  sort_order: number;
  exercises: { name: string; target_parts: string[] } | null;
};

export async function listWorkoutExercises(input: {
  userId: string;
  workoutId: string;
}): Promise<WorkoutExerciseRow[]> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    const { data } = (await supabase
      .from("workout_exercises")
      .select("id, exercise_id, sort_order, exercises(name, target_parts)")
      .eq("workout_id", input.workoutId)
      .order("sort_order", { ascending: true })) as { data: WorkoutExerciseRow[] | null };

    return data ?? [];
  }

  const db = await readLocalDb();
  return db.workout_exercises
    .filter((we) => we.workout_id === input.workoutId)
    .sort((a, b) => (a.sort_order < b.sort_order ? -1 : a.sort_order > b.sort_order ? 1 : a.id.localeCompare(b.id)))
    .map((we) => {
      const ex = db.exercises.find((e) => e.user_id === input.userId && e.id === we.exercise_id);
      return {
        id: we.id,
        exercise_id: we.exercise_id,
        sort_order: we.sort_order,
        exercises: ex ? { name: ex.name, target_parts: ex.target_parts } : null,
      };
    });
}

export async function addWorkoutExercise(input: {
  userId: string;
  workoutId: string;
  exerciseId: string;
}): Promise<void> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    const { data: last } = (await supabase
      .from("workout_exercises")
      .select("sort_order")
      .eq("workout_id", input.workoutId)
      .order("sort_order", { ascending: false })
      .limit(1)) as { data: Array<{ sort_order: number } | null> | null };

    const maxSort = (last?.[0]?.sort_order ?? -1) as number;

    await supabase.from("workout_exercises").insert({
      workout_id: input.workoutId,
      exercise_id: input.exerciseId,
      sort_order: maxSort + 1,
    });
    return;
  }

  const db = await readLocalDb();
  const maxSort = db.workout_exercises
    .filter((we) => we.workout_id === input.workoutId)
    .reduce((m, we) => Math.max(m, we.sort_order), -1);
  db.workout_exercises.push({
    id: newId(),
    workout_id: input.workoutId,
    exercise_id: input.exerciseId,
    sort_order: maxSort + 1,
  });
  await writeLocalDb(db);
}

export async function addWorkoutExercisesBestEffort(input: {
  userId: string;
  workoutId: string;
  exerciseIds: string[];
}): Promise<{ attempted: number; inserted: number }> {
  const uniq = Array.from(new Set(input.exerciseIds.map(String))).filter((id) => id.trim().length > 0);

  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();

    const { data: existingRows } = (await supabase
      .from("workout_exercises")
      .select("exercise_id, sort_order")
      .eq("workout_id", input.workoutId)) as {
      data: Array<{ exercise_id: string; sort_order: number } | null> | null;
    };

    const existing = new Set(
      (existingRows ?? []).filter((r): r is { exercise_id: string; sort_order: number } => !!r).map((r) => r.exercise_id)
    );
    const maxSort = (existingRows ?? [])
      .filter((r): r is { exercise_id: string; sort_order: number } => !!r)
      .reduce((m, r) => Math.max(m, r.sort_order ?? -1), -1);

    // RLS で自分の種目だけが返るはず（Supabaseモード）
    const { data: allowedRows } = (await supabase
      .from("exercises")
      .select("id")
      .in("id", uniq)) as { data: Array<{ id: string } | null> | null };
    const allowed = new Set((allowedRows ?? []).filter((r): r is { id: string } => !!r).map((r) => r.id));

    const toInsert = uniq.filter((id) => allowed.has(id) && !existing.has(id));
    if (toInsert.length === 0) return { attempted: uniq.length, inserted: 0 };

    const rows = toInsert.map((exerciseId, idx) => ({
      workout_id: input.workoutId,
      exercise_id: exerciseId,
      sort_order: maxSort + 1 + idx,
    }));

    const { error } = await supabase.from("workout_exercises").insert(rows);
    if (error) {
      // best effort: 失敗しても落としすぎない
      console.error("addWorkoutExercisesBestEffort failed", error);
      return { attempted: uniq.length, inserted: 0 };
    }

    return { attempted: uniq.length, inserted: rows.length };
  }

  const db = await readLocalDb();

  const workout = db.workouts.find((w) => w.id === input.workoutId);
  if (!workout || workout.user_id !== input.userId) {
    return { attempted: uniq.length, inserted: 0 };
  }

  const existing = new Set(
    db.workout_exercises
      .filter((we) => we.workout_id === input.workoutId)
      .map((we) => we.exercise_id)
  );
  let maxSort = db.workout_exercises
    .filter((we) => we.workout_id === input.workoutId)
    .reduce((m, we) => Math.max(m, we.sort_order), -1);

  const allowed = new Set(
    db.exercises
      .filter((e) => e.user_id === input.userId)
      .map((e) => e.id)
  );

  let inserted = 0;
  for (const exerciseId of uniq) {
    if (!allowed.has(exerciseId)) continue;
    if (existing.has(exerciseId)) continue;
    existing.add(exerciseId);
    maxSort += 1;
    db.workout_exercises.push({
      id: newId(),
      workout_id: input.workoutId,
      exercise_id: exerciseId,
      sort_order: maxSort,
    });
    inserted += 1;
  }

  await writeLocalDb(db);
  return { attempted: uniq.length, inserted };
}

export async function deleteWorkoutExercise(input: {
  workoutExerciseId: string;
}): Promise<void> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    await supabase.from("workout_exercises").delete().eq("id", input.workoutExerciseId);
    return;
  }

  const db = await readLocalDb();
  db.workout_exercises = db.workout_exercises.filter((we) => we.id !== input.workoutExerciseId);
  db.exercise_sets = db.exercise_sets.filter((s) => s.workout_exercise_id !== input.workoutExerciseId);
  await writeLocalDb(db);
}

export async function listSets(input: { workoutExerciseId: string }): Promise<ExerciseSet[]> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("exercise_sets")
      .select("id, workout_exercise_id, set_order, weight, reps")
      .eq("workout_exercise_id", input.workoutExerciseId)
      .order("set_order", { ascending: true });
    return (data ?? []) as ExerciseSet[];
  }

  const db = await readLocalDb();
  return db.exercise_sets
    .filter((s) => s.workout_exercise_id === input.workoutExerciseId)
    .sort((a, b) => (a.set_order < b.set_order ? -1 : a.set_order > b.set_order ? 1 : a.id.localeCompare(b.id)));
}

export async function listSetsByWorkoutExerciseIds(input: {
  workoutExerciseIds: string[];
}): Promise<Record<string, ExerciseSet[]>> {
  const result: Record<string, ExerciseSet[]> = {};
  for (const id of input.workoutExerciseIds) result[id] = [];
  if (input.workoutExerciseIds.length === 0) return result;

  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("exercise_sets")
      .select("id, workout_exercise_id, set_order, weight, reps")
      .in("workout_exercise_id", input.workoutExerciseIds)
      .order("set_order", { ascending: true });

    for (const row of (data ?? []) as ExerciseSet[]) {
      if (!result[row.workout_exercise_id]) {
        result[row.workout_exercise_id] = [];
      }
      result[row.workout_exercise_id].push(row);
    }

    return result;
  }

  const db = await readLocalDb();
  for (const s of db.exercise_sets) {
    if (!result[s.workout_exercise_id]) continue;
    result[s.workout_exercise_id].push(s);
  }
  for (const id of Object.keys(result)) {
    result[id] = result[id].sort((a, b) =>
      a.set_order < b.set_order ? -1 : a.set_order > b.set_order ? 1 : a.id.localeCompare(b.id)
    );
  }
  return result;
}


export async function addSet(input: {
  workoutExerciseId: string;
  weight: number | null;
  reps: number | null;
}): Promise<void> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    await supabase.from("exercise_sets").insert({
      workout_exercise_id: input.workoutExerciseId,
      set_order: 0,
      weight: input.weight,
      reps: input.reps,
    });
    return;
  }

  const db = await readLocalDb();
  const maxOrder = db.exercise_sets
    .filter((s) => s.workout_exercise_id === input.workoutExerciseId)
    .reduce((m, s) => Math.max(m, s.set_order), -1);
  db.exercise_sets.push({
    id: newId(),
    workout_exercise_id: input.workoutExerciseId,
    set_order: maxOrder + 1,
    weight: input.weight,
    reps: input.reps,
  });
  await writeLocalDb(db);
}

export async function updateSet(input: {
  setId: string;
  weight: number | null;
  reps: number | null;
}): Promise<void> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    await supabase
      .from("exercise_sets")
      .update({ weight: input.weight, reps: input.reps })
      .eq("id", input.setId);
    return;
  }

  const db = await readLocalDb();
  const s = db.exercise_sets.find((row) => row.id === input.setId);
  if (!s) return;
  s.weight = input.weight;
  s.reps = input.reps;
  await writeLocalDb(db);
}

export async function deleteSet(input: { setId: string }): Promise<void> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();
    await supabase.from("exercise_sets").delete().eq("id", input.setId);
    return;
  }

  const db = await readLocalDb();
  db.exercise_sets = db.exercise_sets.filter((s) => s.id !== input.setId);
  await writeLocalDb(db);
}

export async function copyPreviousSets(input: {
  userId: string;
  workoutId: string;
  workoutExerciseId: string;
  exerciseId: string;
}): Promise<void> {
  if (!isLocalOnly()) {
    const supabase = await createSupabaseServerClient();

    // 直近の同一種目のセットを探す
    const { data: prevWe } = await supabase
      .from("workout_exercises")
      .select("id, workout_id")
      .eq("exercise_id", input.exerciseId)
      .neq("id", input.workoutExerciseId)
      .order("id", { ascending: false })
      .limit(20);

    const prevWeIds = (prevWe ?? []).map((r) => r.id);
    const lastId = prevWeIds[0];

    if (!lastId) {
      await supabase.from("exercise_sets").insert({
        workout_exercise_id: input.workoutExerciseId,
        set_order: 0,
        weight: null,
        reps: null,
      });
      return;
    }

    const { data: prevSets } = await supabase
      .from("exercise_sets")
      .select("set_order, weight, reps")
      .eq("workout_exercise_id", lastId)
      .order("set_order", { ascending: true });

    if (prevSets && prevSets.length > 0) {
      await supabase.from("exercise_sets").insert(
        prevSets.map((s) => ({
          workout_exercise_id: input.workoutExerciseId,
          set_order: s.set_order,
          weight: s.weight,
          reps: s.reps,
        }))
      );
    } else {
      await supabase.from("exercise_sets").insert({
        workout_exercise_id: input.workoutExerciseId,
        set_order: 0,
        weight: null,
        reps: null,
      });
    }

    return;
  }

  const db = await readLocalDb();
  const currentWorkout = db.workouts.find((w) => w.user_id === input.userId && w.id === input.workoutId);
  const currentDate = currentWorkout?.workout_date ?? "9999-12-31";

  // 同一 exercise の過去 workout_exercise を、workout_date 降順で探す
  const candidates = db.workout_exercises
    .filter((we) => we.exercise_id === input.exerciseId && we.id !== input.workoutExerciseId)
    .map((we) => {
      const w = db.workouts.find((ww) => ww.id === we.workout_id);
      return { we, workout_date: w?.workout_date ?? "0000-00-00" };
    })
    .filter((x) => x.workout_date < currentDate)
    .sort((a, b) => (a.workout_date < b.workout_date ? 1 : a.workout_date > b.workout_date ? -1 : 0));

  const prev = candidates[0]?.we ?? null;

  const prevSets = prev
    ? db.exercise_sets
        .filter((s) => s.workout_exercise_id === prev.id)
        .sort((a, b) => (a.set_order < b.set_order ? -1 : a.set_order > b.set_order ? 1 : 0))
    : [];

  // 既存セットを残したまま追加（現行UIに合わせる）
  if (prevSets.length > 0) {
    for (const s of prevSets) {
      db.exercise_sets.push({
        id: newId(),
        workout_exercise_id: input.workoutExerciseId,
        set_order: s.set_order,
        weight: s.weight,
        reps: s.reps,
      });
    }
  } else {
    db.exercise_sets.push({
      id: newId(),
      workout_exercise_id: input.workoutExerciseId,
      set_order: 0,
      weight: null,
      reps: null,
    });
  }

  await writeLocalDb(db);
}
