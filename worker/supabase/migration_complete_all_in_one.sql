-- =====================================================================
-- MIGRAÇÃO COMPLETA: Cortes Virais AI
-- Execute este arquivo no SQL Editor do seu Supabase e clique em RUN.
-- Ele adiciona todas as colunas novas (B-Roll, Referência, Cancelamento, Logs)
-- e recarrega o cache do PostgREST automaticamente.
-- =====================================================================

-- 1. Colunas de Vídeo de Referência e Design
alter table public.jobs add column if not exists vertical_mode text not null default 'crop';
alter table public.jobs add column if not exists reference_type text not null default 'none';
alter table public.jobs add column if not exists reference_url text;
alter table public.jobs add column if not exists reference_path text;
alter table public.jobs add column if not exists reference_style text;
alter table public.jobs add column if not exists design_instructions text;

-- 2. Colunas de B-Roll (Pexels / Higgsfield)
alter table public.jobs add column if not exists use_broll boolean not null default false;
alter table public.jobs add column if not exists broll_source text not null default 'none';

-- 3. Coluna de Logs do Terminal PowerShell
alter table public.jobs add column if not exists logs text[] not null default '{}';

-- 4. Constraints de validação
alter table public.jobs drop constraint if exists jobs_vertical_mode_check;
alter table public.jobs add constraint jobs_vertical_mode_check 
  check (vertical_mode in ('crop', 'blur', 'split'));

alter table public.jobs drop constraint if exists jobs_reference_type_check;
alter table public.jobs add constraint jobs_reference_type_check 
  check (reference_type in ('link', 'upload', 'preset', 'none'));

alter table public.jobs drop constraint if exists jobs_broll_source_check;
alter table public.jobs add constraint jobs_broll_source_check 
  check (broll_source in ('pexels', 'higgsfield', 'none'));

-- Permite status 'canceled'
alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs add constraint jobs_status_check 
  check (status in ('queued','downloading','transcribing','analyzing','cutting','done','failed','canceled'));

-- 5. Permissão de RLS para o usuário atualizar/cancelar seus próprios pedidos
drop policy if exists "jobs: cancelar os proprios" on public.jobs;
create policy "jobs: cancelar os proprios" on public.jobs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 6. Função RPC de cancelamento seguro (UUID e Text)
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

create or replace function public.cancel_job(job_id text)
returns boolean
language plpgsql
security definer
as $$
begin
  return public.cancel_job(job_id::uuid);
exception
  when others then
    return false;
end;
$$;

grant execute on function public.cancel_job(uuid) to authenticated, anon, service_role;
grant execute on function public.cancel_job(text) to authenticated, anon, service_role;

-- 7. Recarrega o Schema Cache do PostgREST imediatamente
notify pgrst, 'reload schema';
