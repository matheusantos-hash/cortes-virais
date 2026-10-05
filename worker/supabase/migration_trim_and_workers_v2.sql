-- =====================================================================
-- Migração: Suporte a Re-render Real (Trim) e Fila Escalável de Workers
-- =====================================================================

-- 1. Novas colunas em public.clips
alter table public.clips
  add column if not exists version integer not null default 1,
  add column if not exists is_trimming boolean not null default false;

-- 2. Novas colunas em public.jobs para Trim e Lease de Workers
alter table public.jobs
  add column if not exists job_type text not null default 'full',
  add column if not exists target_clip_id uuid references public.clips(id) on delete cascade,
  add column if not exists trim_start numeric,
  add column if not exists trim_end numeric,
  add column if not exists locked_by text,
  add column if not exists locked_at timestamptz,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists retry_count integer not null default 0;

-- 3. Atualizar restrições de source_type e source_ok para aceitar jobs de trim
alter table public.jobs drop constraint if exists jobs_source_type_check;
alter table public.jobs add constraint jobs_source_type_check
  check (source_type in ('link', 'upload', 'clip'));

alter table public.jobs drop constraint if exists jobs_source_ok;
alter table public.jobs add constraint jobs_source_ok
  check (
    (job_type = 'trim' and target_clip_id is not null) or
    (source_type = 'link' and source_url is not null) or
    (source_type = 'upload' and source_path is not null)
  );

-- 4. Função RPC request_clip_trim: cria solicitação de re-render seguro
create or replace function public.request_clip_trim(
  p_clip_id uuid,
  p_start numeric,
  p_end numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_clip public.clips%rowtype;
  v_job_id uuid;
begin
  if v_uid is null then
    raise exception 'Apenas usuários autenticados podem solicitar ajuste de corte.';
  end if;

  select * into v_clip
    from public.clips
   where id = p_clip_id;

  if not found then
    raise exception 'Clipe não encontrado.';
  end if;

  if v_clip.user_id <> v_uid then
    -- Se não for dono, verifica se é admin
    if not exists (select 1 from public.usuarios where id = v_uid and is_xandao = true) then
      raise exception 'Permissão negada para editar este corte.';
    end if;
  end if;

  if p_start < 0 or p_end <= p_start then
    raise exception 'Intervalo de tempo inválido para o corte.';
  end if;

  -- Marca clipe como em reprocessamento
  update public.clips
     set is_trimming = true
   where id = p_clip_id;

  -- Cria job prioritário de trim na fila
  insert into public.jobs (
    user_id,
    job_type,
    source_type,
    target_clip_id,
    trim_start,
    trim_end,
    orientation,
    vertical_mode,
    clip_count,
    min_seconds,
    max_seconds,
    status,
    progress
  ) values (
    v_clip.user_id,
    'trim',
    'clip',
    v_clip.id,
    p_start,
    p_end,
    'vertical',
    'crop',
    1,
    5,
    3600,
    'queued',
    0
  ) returning id into v_job_id;

  return v_job_id;
end;
$$;

revoke all on function public.request_clip_trim(uuid, numeric, numeric) from public, anon;
grant execute on function public.request_clip_trim(uuid, numeric, numeric) to authenticated, service_role;

-- 5. Função evoluída claim_next_job: suporta worker_id, prioridade de trim e resgate de órfãos
create or replace function public.claim_next_job(p_worker_id text default 'worker-default')
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
begin
  select id into v_job_id
    from public.jobs
   where (
     status = 'queued'
     or (
       status in ('downloading', 'transcribing', 'analyzing', 'cutting')
       and heartbeat_at < now() - interval '3 minutes'
       and retry_count < 3
     )
   )
   order by
     (case when job_type = 'trim' then 0 else 1 end),
     created_at asc
   limit 1
   for update skip locked;

  if v_job_id is not null then
    return query
    update public.jobs
       set status = 'downloading',
           progress = 5,
           started_at = coalesce(started_at, now()),
           locked_by = p_worker_id,
           locked_at = now(),
           heartbeat_at = now(),
           retry_count = retry_count + (case when status <> 'queued' then 1 else 0 end)
     where id = v_job_id
    returning *;
  end if;

  return;
end;
$$;

-- 6. RPC para o Worker atualizar o Heartbeat periodicamente
create or replace function public.job_heartbeat(p_job_id uuid, p_worker_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.jobs
     set heartbeat_at = now()
   where id = p_job_id
     and locked_by = p_worker_id;
  return found;
end;
$$;

revoke all on function public.job_heartbeat(uuid, text) from public, anon;
grant execute on function public.job_heartbeat(uuid, text) to authenticated, service_role;
