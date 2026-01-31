-- 筋トレ記録アプリ (MVP) - Supabase schema
-- 仕様: exercises / workouts / workout_exercises / exercise_sets
-- すべてユーザー単位で分離 (RLS)

-- Extensions
create extension if not exists "pgcrypto";

-- =========================
-- exercises (種目マスタ)
-- =========================
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_parts text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  constraint exercises_name_nonempty check (char_length(trim(name)) > 0),
  constraint exercises_target_parts_valid check (
    target_parts <@ array['胸','背中','肩','腕','脚','腹']::text[]
  )
);

create unique index if not exists exercises_user_name_unique
  on public.exercises (user_id, lower(name));

create index if not exists exercises_user_created_at_idx
  on public.exercises (user_id, created_at desc);

-- =========================
-- workouts
-- =========================
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_date date not null,
  memo text,
  created_at timestamptz not null default now()
);

create index if not exists workouts_user_date_idx
  on public.workouts (user_id, workout_date desc);

create index if not exists workouts_user_created_at_idx
  on public.workouts (user_id, created_at desc);

-- =========================
-- workout_exercises
-- =========================
create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  sort_order int not null default 0
);

create index if not exists workout_exercises_workout_sort_idx
  on public.workout_exercises (workout_id, sort_order asc, id);

create index if not exists workout_exercises_exercise_idx
  on public.workout_exercises (exercise_id);

-- =========================
-- exercise_sets
-- =========================
create table if not exists public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  set_order int not null default 0,
  weight numeric,
  reps int,
  constraint exercise_sets_weight_nonnegative check (weight is null or weight >= 0),
  constraint exercise_sets_reps_positive check (reps is null or reps >= 0)
);

create index if not exists exercise_sets_workout_exercise_order_idx
  on public.exercise_sets (workout_exercise_id, set_order asc, id);

-- =========================
-- workout_templates
-- =========================
create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_templates_name_nonempty check (char_length(trim(name)) > 0)
);

create index if not exists workout_templates_user_updated_at_idx
  on public.workout_templates (user_id, updated_at desc);

-- =========================
-- workout_template_exercises
-- =========================
create table if not exists public.workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  sort_order int not null default 0
);

create index if not exists workout_template_exercises_template_sort_idx
  on public.workout_template_exercises (template_id, sort_order asc, id);

create index if not exists workout_template_exercises_exercise_idx
  on public.workout_template_exercises (exercise_id);

-- =========================
-- workout_template_sets
-- =========================
create table if not exists public.workout_template_sets (
  id uuid primary key default gen_random_uuid(),
  template_exercise_id uuid not null references public.workout_template_exercises (id) on delete cascade,
  set_order int not null default 0,
  weight numeric,
  reps int,
  constraint workout_template_sets_weight_nonnegative check (weight is null or weight >= 0),
  constraint workout_template_sets_reps_positive check (reps is null or reps >= 0)
);

create index if not exists workout_template_sets_exercise_order_idx
  on public.workout_template_sets (template_exercise_id, set_order asc, id);


-- user_settings (ユーザー設定)
-- =========================
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  gym_login_url text,
  updated_at timestamptz not null default now(),
  constraint user_settings_gym_login_url_valid check (
    gym_login_url is null
    or gym_login_url ~ '^https?://'
  )
);


-- =========================
-- RLS
-- =========================
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.exercise_sets enable row level security;
alter table public.workout_templates enable row level security;
alter table public.workout_template_exercises enable row level security;
alter table public.workout_template_sets enable row level security;
alter table public.user_settings enable row level security;

-- =========================
-- Policies (re-runnable)
-- =========================
-- Postgresは CREATE POLICY IF NOT EXISTS をサポートしないため、再実行できるように事前にDROPします。

drop policy if exists "exercises_select_own" on public.exercises;
drop policy if exists "exercises_insert_own" on public.exercises;
drop policy if exists "exercises_update_own" on public.exercises;
drop policy if exists "exercises_delete_own" on public.exercises;

drop policy if exists "workouts_select_own" on public.workouts;
drop policy if exists "workouts_insert_own" on public.workouts;
drop policy if exists "workouts_update_own" on public.workouts;
drop policy if exists "workouts_delete_own" on public.workouts;

drop policy if exists "workout_exercises_select_own" on public.workout_exercises;
drop policy if exists "workout_exercises_insert_own" on public.workout_exercises;
drop policy if exists "workout_exercises_update_own" on public.workout_exercises;
drop policy if exists "workout_exercises_delete_own" on public.workout_exercises;

drop policy if exists "exercise_sets_select_own" on public.exercise_sets;
drop policy if exists "exercise_sets_insert_own" on public.exercise_sets;
drop policy if exists "exercise_sets_update_own" on public.exercise_sets;
drop policy if exists "exercise_sets_delete_own" on public.exercise_sets;

drop policy if exists "workout_templates_select_own" on public.workout_templates;
drop policy if exists "workout_templates_insert_own" on public.workout_templates;
drop policy if exists "workout_templates_update_own" on public.workout_templates;
drop policy if exists "workout_templates_delete_own" on public.workout_templates;

drop policy if exists "workout_template_exercises_select_own" on public.workout_template_exercises;
drop policy if exists "workout_template_exercises_insert_own" on public.workout_template_exercises;
drop policy if exists "workout_template_exercises_update_own" on public.workout_template_exercises;
drop policy if exists "workout_template_exercises_delete_own" on public.workout_template_exercises;

drop policy if exists "workout_template_sets_select_own" on public.workout_template_sets;
drop policy if exists "workout_template_sets_insert_own" on public.workout_template_sets;
drop policy if exists "workout_template_sets_update_own" on public.workout_template_sets;
drop policy if exists "workout_template_sets_delete_own" on public.workout_template_sets;

create policy "workout_templates_select_own"
  on public.workout_templates for select
  using (auth.uid() = user_id);

create policy "workout_templates_insert_own"
  on public.workout_templates for insert
  with check (auth.uid() = user_id);

create policy "workout_templates_update_own"
  on public.workout_templates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "workout_templates_delete_own"
  on public.workout_templates for delete
  using (auth.uid() = user_id);

create policy "workout_template_exercises_select_own"
  on public.workout_template_exercises for select
  using (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id
        and t.user_id = auth.uid()
    )
  );

create policy "workout_template_exercises_insert_own"
  on public.workout_template_exercises for insert
  with check (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id
        and t.user_id = auth.uid()
    )
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_id
        and e.user_id = auth.uid()
    )
  );

create policy "workout_template_exercises_update_own"
  on public.workout_template_exercises for update
  using (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id
        and t.user_id = auth.uid()
    )
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_id
        and e.user_id = auth.uid()
    )
  );

create policy "workout_template_exercises_delete_own"
  on public.workout_template_exercises for delete
  using (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id
        and t.user_id = auth.uid()
    )
  );

create policy "workout_template_sets_select_own"
  on public.workout_template_sets for select
  using (
    exists (
      select 1
      from public.workout_template_exercises te
      join public.workout_templates t on t.id = te.template_id
      where te.id = template_exercise_id
        and t.user_id = auth.uid()
    )
  );

create policy "workout_template_sets_insert_own"
  on public.workout_template_sets for insert
  with check (
    exists (
      select 1
      from public.workout_template_exercises te
      join public.workout_templates t on t.id = te.template_id
      where te.id = template_exercise_id
        and t.user_id = auth.uid()
    )
  );

create policy "workout_template_sets_update_own"
  on public.workout_template_sets for update
  using (
    exists (
      select 1
      from public.workout_template_exercises te
      join public.workout_templates t on t.id = te.template_id
      where te.id = template_exercise_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workout_template_exercises te
      join public.workout_templates t on t.id = te.template_id
      where te.id = template_exercise_id
        and t.user_id = auth.uid()
    )
  );

create policy "workout_template_sets_delete_own"
  on public.workout_template_sets for delete
  using (
    exists (
      select 1
      from public.workout_template_exercises te
      join public.workout_templates t on t.id = te.template_id
      where te.id = template_exercise_id
        and t.user_id = auth.uid()
    )
  );

drop policy if exists "user_settings_select_own" on public.user_settings;
drop policy if exists "user_settings_insert_own" on public.user_settings;
drop policy if exists "user_settings_update_own" on public.user_settings;
drop policy if exists "user_settings_delete_own" on public.user_settings;

-- exercises: 自分のみ CRUD
create policy "exercises_select_own"
  on public.exercises for select
  using (auth.uid() = user_id);

create policy "exercises_insert_own"
  on public.exercises for insert
  with check (auth.uid() = user_id);

create policy "exercises_update_own"
  on public.exercises for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "exercises_delete_own"
  on public.exercises for delete
  using (auth.uid() = user_id);

-- workouts: 自分のみ CRUD
create policy "workouts_select_own"
  on public.workouts for select
  using (auth.uid() = user_id);

create policy "workouts_insert_own"
  on public.workouts for insert
  with check (auth.uid() = user_id);

create policy "workouts_update_own"
  on public.workouts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "workouts_delete_own"
  on public.workouts for delete
  using (auth.uid() = user_id);

-- workout_exercises: workout が自分のものなら CRUD
create policy "workout_exercises_select_own"
  on public.workout_exercises for select
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id
        and w.user_id = auth.uid()
    )
  );

create policy "workout_exercises_insert_own"
  on public.workout_exercises for insert
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id
        and w.user_id = auth.uid()
    )
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_id
        and e.user_id = auth.uid()
    )
  );

create policy "workout_exercises_update_own"
  on public.workout_exercises for update
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id
        and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id
        and w.user_id = auth.uid()
    )
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_id
        and e.user_id = auth.uid()
    )
  );

create policy "workout_exercises_delete_own"
  on public.workout_exercises for delete
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id
        and w.user_id = auth.uid()
    )
  );

-- exercise_sets: 親( workout_exercise -> workout ) が自分のものなら CRUD
create policy "exercise_sets_select_own"
  on public.exercise_sets for select
  using (
    exists (
      select 1
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id
        and w.user_id = auth.uid()
    )
  );

create policy "exercise_sets_insert_own"
  on public.exercise_sets for insert
  with check (
    exists (
      select 1
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id
        and w.user_id = auth.uid()
    )
  );

create policy "exercise_sets_update_own"
  on public.exercise_sets for update
  using (
    exists (
      select 1
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id
        and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id
        and w.user_id = auth.uid()
    )
  );

create policy "exercise_sets_delete_own"
  on public.exercise_sets for delete
  using (
    exists (
      select 1
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id
        and w.user_id = auth.uid()
    )
  );

-- user_settings: 自分のみ CRUD
create policy "user_settings_select_own"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "user_settings_insert_own"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "user_settings_update_own"
  on public.user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_settings_delete_own"
  on public.user_settings for delete
  using (auth.uid() = user_id);
