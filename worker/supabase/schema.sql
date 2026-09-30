-- =====================================================================
-- Cortes Virais — schema do Supabase (MVP)
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run.
-- Pode rodar mais de uma vez sem quebrar.
-- =====================================================================

-- ---------- Tabela de jobs (um pedido de cortes = um job) ------------
create table if not exists public.jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,

  source_type   text not null check (source_type in ('link', 'upload')),
  source_url    text,
  source_path   text,

  orientation   text not null default 'vertical' check (orientation in ('vertical', 'horizontal')),
  vertical_mode text not null default 'crop' check (vertical_mode in ('crop', 'blur', 'split')),
  crop_x        numeric not null default 0.5 check (crop_x between 0 and 1),
  clip_count    int  not null default 10 check (clip_count between 1 and 30),
  min_seconds   int  not null default 30 check (min_seconds >= 5),
  max_seconds   int  not null default 90 check (max_seconds <= 180),
  language      text not null default 'pt-BR',

  -- Vídeo de Referência e Diretrizes de Design
  reference_type       text not null default 'none' check (reference_type in ('link', 'upload', 'preset', 'none')),
  reference_url        text,
  reference_path       text,
  reference_style      text,
  design_instructions  text,

  status        text not null default 'queued'
                check (status in ('queued','downloading','transcribing','analyzing','cutting','done','failed','canceled')),
  progress      int  not null default 0 check (progress between 0 and 100),
  error         text,
  logs          text[] not null default '{}',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz,

  constraint jobs_min_lt_max check (min_seconds < max_seconds),
  constraint jobs_source_ok check (
    (source_type = 'link'   and source_url  is not null) or
    (source_type = 'upload' and source_path is not null)
  )
);

create index if not exists jobs_status_created_idx on public.jobs (status, created_at);
create index if not exists jobs_user_created_idx   on public.jobs (user_id, created_at desc);

-- ---------- Tabela de clipes (resultado de cada job) -----------------
create table if not exists public.clips (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references public.jobs(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  position       int  not null,
  title          text not null,
  hook           text,
  reason         text,
  score          int,
  start_seconds  numeric not null,
  end_seconds    numeric not null,
  file_path      text,
  created_at     timestamptz not null default now()
);

create index if not exists clips_job_idx on public.clips (job_id, position);

-- ---------- updated_at automático ------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- ---------- Fila: o worker "reivindica" o próximo job ----------------
-- FOR UPDATE SKIP LOCKED impede que dois workers peguem o mesmo job.
create or replace function public.claim_next_job()
returns setof public.jobs
language sql
as $$
  update public.jobs j
     set status = 'downloading',
         progress = 5,
         started_at = now()
   where j.id = (
     select id
       from public.jobs
      where status = 'queued'
      order by created_at
      for update skip locked
      limit 1
   )
  returning j.*;
$$;

revoke all on function public.claim_next_job() from public, anon, authenticated;
grant execute on function public.claim_next_job() to service_role;

-- ---------- RLS: cada usuário só vê o que é dele ---------------------
alter table public.jobs  enable row level security;
alter table public.clips enable row level security;

drop policy if exists "jobs: ver os proprios"    on public.jobs;
drop policy if exists "jobs: criar os proprios"  on public.jobs;
drop policy if exists "jobs: apagar os proprios" on public.jobs;
drop policy if exists "clips: ver os proprios"   on public.clips;

create policy "jobs: ver os proprios" on public.jobs
  for select to authenticated
  using (user_id = auth.uid());

-- O usuário só pode criar jobs novos, "limpos". Status e progresso quem atualiza é o worker.
create policy "jobs: criar os proprios" on public.jobs
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'queued' and progress = 0);

create policy "jobs: apagar os proprios" on public.jobs
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "jobs: cancelar os proprios" on public.jobs;
create policy "jobs: cancelar os proprios" on public.jobs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and status = 'canceled');

-- ---------- Cancelar job de forma atômica ----------------------------
create or replace function public.cancel_job(job_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.jobs
     set status = 'canceled',
         finished_at = now(),
         error = coalesce(error, 'Cancelado pelo usuário.')
   where id = job_id
     and (user_id = v_uid or v_uid is null)
     and status not in ('done', 'failed', 'canceled');
  return found;
end;
$$;

grant execute on function public.cancel_job(uuid) to authenticated, anon, service_role;

create policy "clips: ver os proprios" on public.clips
  for select to authenticated
  using (user_id = auth.uid());

-- Sem policies de UPDATE/INSERT em clips: só o worker (service_role) grava.

-- ---------- Progresso ao vivo no site (Realtime) ---------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jobs'
  ) then
    alter publication supabase_realtime add table public.jobs;
  end if;
end
$$;

-- ---------- Storage: buckets privados --------------------------------
insert into storage.buckets (id, name, public)
values ('sources', 'sources', false),
       ('clips',   'clips',   false)
on conflict (id) do nothing;

-- Convenção de caminho: <user_id>/<arquivo>. O usuário só acessa a própria pasta.
drop policy if exists "sources: enviar na propria pasta" on storage.objects;
drop policy if exists "sources: ler a propria pasta"     on storage.objects;
drop policy if exists "sources: apagar da propria pasta" on storage.objects;
drop policy if exists "clips: ler a propria pasta"       on storage.objects;

create policy "sources: enviar na propria pasta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sources' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "sources: ler a propria pasta" on storage.objects
  for select to authenticated
  using (bucket_id = 'sources' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "sources: apagar da propria pasta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'sources' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "clips: ler a propria pasta" on storage.objects
  for select to authenticated
  using (bucket_id = 'clips' and (storage.foldername(name))[1] = auth.uid()::text);

-- O worker usa a service_role key, que ignora RLS: ele grava em "clips" sem policy.
