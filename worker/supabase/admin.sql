-- =====================================================================
-- Cortes Virais — tabela "usuarios" + permissão de administrador
-- RODE DEPOIS do schema.sql (este arquivo usa as tabelas jobs e clips).
-- Cole tudo no SQL Editor do Supabase e clique em Run.
-- Pode rodar mais de uma vez sem quebrar.
--
-- Regra: conta é ADMIN quando usuarios.xandao = 1. Qualquer outro valor = não é.
-- O valor só pode ser alterado manualmente (SQL Editor / Table Editor),
-- nunca pelo site: ninguém consegue se promover a admin pela API.
-- =====================================================================

-- ---------- Tabela usuarios (1 linha por conta de login) -------------
create table if not exists public.usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  xandao      smallint not null default 0 check (xandao in (0, 1)),
  created_at  timestamptz not null default now()
);

create index if not exists usuarios_email_idx on public.usuarios (email);

-- ---------- Cria a linha automaticamente a cada novo cadastro --------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usuarios (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Contas que já existiam antes deste script (ex.: seu usuário de teste)
insert into public.usuarios (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ---------- Função is_admin() ----------------------------------------
-- security definer: lê a tabela sem cair em loop de RLS.
-- Sempre olha o usuário logado (auth.uid()); não aceita parâmetro.
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
       and xandao = 1
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------- Privilégios: usuário logado só pode LER usuarios ---------
-- Sem INSERT/UPDATE/DELETE para "authenticated" e "anon": impede a escalada
-- de privilégio (mudar o próprio xandao). Quem grava é o trigger e você (SQL Editor).
revoke all on public.usuarios from anon, authenticated;
grant select on public.usuarios to authenticated;
grant all on public.usuarios to service_role;

-- ---------- RLS da tabela usuarios -----------------------------------
alter table public.usuarios enable row level security;

drop policy if exists "usuarios: ver a propria linha" on public.usuarios;
drop policy if exists "usuarios: admin ve todos"      on public.usuarios;

create policy "usuarios: ver a propria linha" on public.usuarios
  for select to authenticated
  using (id = auth.uid());

create policy "usuarios: admin ve todos" on public.usuarios
  for select to authenticated
  using (public.is_admin());

-- ---------- Admin enxerga tudo em jobs e clips -----------------------
drop policy if exists "jobs: admin ve todos"      on public.jobs;
drop policy if exists "jobs: admin apaga todos"   on public.jobs;
drop policy if exists "clips: admin ve todos"     on public.clips;

create policy "jobs: admin ve todos" on public.jobs
  for select to authenticated
  using (public.is_admin());

create policy "jobs: admin apaga todos" on public.jobs
  for delete to authenticated
  using (public.is_admin());

create policy "clips: admin ve todos" on public.clips
  for select to authenticated
  using (public.is_admin());

-- ---------- Admin pode ver os arquivos de todos (Storage) ------------
drop policy if exists "sources: admin le todos" on storage.objects;
drop policy if exists "clips: admin le todos"   on storage.objects;

create policy "sources: admin le todos" on storage.objects
  for select to authenticated
  using (bucket_id = 'sources' and public.is_admin());

create policy "clips: admin le todos" on storage.objects
  for select to authenticated
  using (bucket_id = 'clips' and public.is_admin());

-- =====================================================================
-- COMO TORNAR UMA CONTA ADMIN (rode separado, com o seu e-mail):
--
--   update public.usuarios set xandao = 1 where email = 'seu@email.com';
--
-- Para tirar o acesso de admin:
--
--   update public.usuarios set xandao = 0 where email = 'seu@email.com';
--
-- Para conferir quem é admin:
--
--   select email, xandao from public.usuarios order by created_at;
-- =====================================================================
