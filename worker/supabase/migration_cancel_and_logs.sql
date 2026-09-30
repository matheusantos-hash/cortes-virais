-- =====================================================================
-- Migração: Adicionar suporte a Cancelamento e Logs do Terminal
-- Cole este arquivo no SQL Editor do seu Supabase e clique em RUN.
-- =====================================================================

-- 1. Atualiza a constraint de status para permitir 'canceled'
alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs add constraint jobs_status_check 
  check (status in ('queued','downloading','transcribing','analyzing','cutting','done','failed','canceled'));

-- 2. Adiciona a coluna de logs (array de texto) caso ainda não exista
alter table public.jobs add column if not exists logs text[] not null default '{}';

-- 3. Permite ao usuário autenticado cancelar seus próprios jobs (RLS)
drop policy if exists "jobs: cancelar os proprios" on public.jobs;
create policy "jobs: cancelar os proprios" on public.jobs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and status = 'canceled');

-- 4. Função segura para cancelar job
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
