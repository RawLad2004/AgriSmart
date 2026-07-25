-- ==========================================================
-- Animal record-keeping: feed, vaccinations, health, growth
-- Ownership chain mirrors the rest of the app:
--   farms.owner_id -> enterprises.farm_id -> livestock_animals.enterprise_id
--   -> these tables.animal_id
-- ==========================================================

-- ---------- FEED LOGS ----------
create table if not exists public.animal_feed_logs (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.livestock_animals(id) on delete cascade,
  feed_type text not null,
  quantity numeric not null,
  unit text not null default 'kg',
  feeding_date date not null default current_date,
  cost numeric,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists animal_feed_logs_animal_id_idx on public.animal_feed_logs(animal_id);

alter table public.animal_feed_logs enable row level security;

drop policy if exists "Owners manage their animals' feed logs" on public.animal_feed_logs;
create policy "Owners manage their animals' feed logs"
  on public.animal_feed_logs for all
  using (
    exists (
      select 1
      from public.livestock_animals a
      join public.enterprises e on e.id = a.enterprise_id
      join public.farms f on f.id = e.farm_id
      where a.id = animal_feed_logs.animal_id
        and f.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.livestock_animals a
      join public.enterprises e on e.id = a.enterprise_id
      join public.farms f on f.id = e.farm_id
      where a.id = animal_feed_logs.animal_id
        and f.owner_id = auth.uid()
    )
  );

-- ---------- VACCINATIONS ----------
create table if not exists public.animal_vaccinations (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.livestock_animals(id) on delete cascade,
  vaccine_name text not null,
  date_administered date not null default current_date,
  next_due_date date,
  dosage text,
  administered_by text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists animal_vaccinations_animal_id_idx on public.animal_vaccinations(animal_id);
create index if not exists animal_vaccinations_next_due_idx on public.animal_vaccinations(next_due_date);

alter table public.animal_vaccinations enable row level security;

drop policy if exists "Owners manage their animals' vaccinations" on public.animal_vaccinations;
create policy "Owners manage their animals' vaccinations"
  on public.animal_vaccinations for all
  using (
    exists (
      select 1
      from public.livestock_animals a
      join public.enterprises e on e.id = a.enterprise_id
      join public.farms f on f.id = e.farm_id
      where a.id = animal_vaccinations.animal_id
        and f.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.livestock_animals a
      join public.enterprises e on e.id = a.enterprise_id
      join public.farms f on f.id = e.farm_id
      where a.id = animal_vaccinations.animal_id
        and f.owner_id = auth.uid()
    )
  );

-- ---------- HEALTH RECORDS ----------
create table if not exists public.animal_health_records (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.livestock_animals(id) on delete cascade,
  record_type text not null check (record_type in ('illness', 'treatment', 'injury', 'checkup', 'deworming', 'other')),
  description text not null,
  date_recorded date not null default current_date,
  treatment_given text,
  vet_name text,
  cost numeric,
  follow_up_date date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists animal_health_records_animal_id_idx on public.animal_health_records(animal_id);

alter table public.animal_health_records enable row level security;

drop policy if exists "Owners manage their animals' health records" on public.animal_health_records;
create policy "Owners manage their animals' health records"
  on public.animal_health_records for all
  using (
    exists (
      select 1
      from public.livestock_animals a
      join public.enterprises e on e.id = a.enterprise_id
      join public.farms f on f.id = e.farm_id
      where a.id = animal_health_records.animal_id
        and f.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.livestock_animals a
      join public.enterprises e on e.id = a.enterprise_id
      join public.farms f on f.id = e.farm_id
      where a.id = animal_health_records.animal_id
        and f.owner_id = auth.uid()
    )
  );

-- ---------- GROWTH RECORDS ----------
create table if not exists public.animal_growth_records (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.livestock_animals(id) on delete cascade,
  weight_kg numeric not null,
  date_recorded date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists animal_growth_records_animal_id_idx on public.animal_growth_records(animal_id);

alter table public.animal_growth_records enable row level security;

drop policy if exists "Owners manage their animals' growth records" on public.animal_growth_records;
create policy "Owners manage their animals' growth records"
  on public.animal_growth_records for all
  using (
    exists (
      select 1
      from public.livestock_animals a
      join public.enterprises e on e.id = a.enterprise_id
      join public.farms f on f.id = e.farm_id
      where a.id = animal_growth_records.animal_id
        and f.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.livestock_animals a
      join public.enterprises e on e.id = a.enterprise_id
      join public.farms f on f.id = e.farm_id
      where a.id = animal_growth_records.animal_id
        and f.owner_id = auth.uid()
    )
  );

-- ---------- SPECIES TEMPLATES (reference data, not user-owned) ----------
create table if not exists public.species_templates (
  id uuid primary key default gen_random_uuid(),
  species_name text not null,
  enterprise_type text not null check (enterprise_type in ('livestock', 'dairy', 'poultry', 'aquaculture', 'apiary')),
  common_breeds jsonb not null default '[]'::jsonb,
  suggested_vaccinations jsonb not null default '[]'::jsonb,
  suggested_feed_types jsonb not null default '[]'::jsonb
);

alter table public.species_templates enable row level security;

drop policy if exists "Anyone signed in can read species templates" on public.species_templates;
create policy "Anyone signed in can read species templates"
  on public.species_templates for select
  using (auth.role() = 'authenticated');
