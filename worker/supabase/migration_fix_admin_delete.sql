-- =====================================================================
-- Migração: Correção Definitiva de Permissão de Exclusão de Jobs/Clipes
-- =====================================================================

-- 1. Atualizar função is_admin() para reconhecer tanto is_xandao quanto xandao = 1
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.usuarios
     where id = auth.uid()
       and (xandao = 1 or is_xandao is true)
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- 2. Sincronizar a flag xandao legada para todos os administradores
update public.usuarios
   set xandao = 1
 where is_xandao = true;

-- 3. Atualizar política de exclusão na tabela public.jobs
drop policy if exists "jobs: apagar os proprios" on public.jobs;
drop policy if exists "jobs: admin apaga todos"   on public.jobs;

create policy "jobs: apagar os proprios ou admin" on public.jobs
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- 4. Atualizar política de exclusão na tabela public.clips
drop policy if exists "clips: apagar os proprios" on public.clips;
drop policy if exists "clips: admin apaga todos"   on public.clips;

create policy "clips: apagar os proprios ou admin" on public.clips
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());
