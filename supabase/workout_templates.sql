-- Workout templates schema + RLS policies (copy/paste into Supabase SQL Editor)

-- workout_templates
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

-- workout_template_exercises
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

-- workout_template_sets
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

-- enable RLS
alter table public.workout_templates enable row level security;
alter table public.workout_template_exercises enable row level security;
alter table public.workout_template_sets enable row level security;

-- drop policies if exist
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

-- policies: workout_templates
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

-- policies: workout_template_exercises
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

-- policies: workout_template_sets
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
