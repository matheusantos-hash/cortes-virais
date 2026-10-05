-- Migration: Correção de Segurança no cancel_job
-- Impede cancelamento anônimo e restringe a chamada ao proprietário ou admin

create or replace function public.cancel_job(job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
begin
  if v_uid is null then
    return false;
  end if;

  select coalesce(is_xandao, false) into v_is_admin
    from public.usuarios
   where id = v_uid;

  update public.jobs
     set status = 'canceled',
         finished_at = now(),
         error = coalesce(error, 'Cancelado pelo usuário.')
   where id = job_id
     and (user_id = v_uid or v_is_admin is true)
     and status not in ('done', 'failed', 'canceled');

  return found;
end;
$$;

create or replace function public.cancel_job(job_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if job_id is null or job_id = '' then
    return false;
  end if;
  return public.cancel_job(job_id::uuid);
exception
  when others then
    return false;
end;
$$;

revoke all on function public.cancel_job(uuid) from public, anon;
revoke all on function public.cancel_job(text) from public, anon;
grant execute on function public.cancel_job(uuid) to authenticated, service_role;
grant execute on function public.cancel_job(text) to authenticated, service_role;
