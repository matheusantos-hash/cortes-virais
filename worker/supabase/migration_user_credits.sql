-- =====================================================================
-- Migração: Sistema de Créditos e Limites por Usuário
-- =====================================================================

-- 1. Novas colunas na tabela public.usuarios
alter table public.usuarios
  add column if not exists creditos_minutos numeric(10, 1) not null default 30.0,
  add column if not exists limite_max_video_minutos numeric(10, 1) not null default 60.0;

-- 2. Administradores existentes ganham saldo VIP ilimitado
update public.usuarios
   set creditos_minutos = 99999.0,
       limite_max_video_minutos = 3600.0
 where is_xandao = true;

-- 3. Atualizar trigger handle_new_user para garantir créditos iniciais
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (
    id,
    email,
    is_xandao,
    xandao,
    pagante,
    plano,
    creditos_minutos,
    limite_max_video_minutos,
    created_at
  ) values (
    new.id,
    new.email,
    false,
    0,
    false,
    'free',
    30.0,
    60.0,
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 4. Função segura para o Administrador alterar créditos e limites manualmente
create or replace function public.admin_set_user_credits(
  p_user_id uuid,
  p_creditos numeric,
  p_limite numeric
)
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
    raise exception 'Apenas administradores autenticados podem alterar créditos.';
  end if;

  select coalesce(is_xandao, false) into v_is_admin
    from public.usuarios
   where id = v_uid;

  if not v_is_admin then
    raise exception 'Permissão negada. Apenas administradores podem gerenciar créditos.';
  end if;

  update public.usuarios
     set creditos_minutos = round(p_creditos, 1),
         limite_max_video_minutos = round(p_limite, 1)
   where id = p_user_id;

  return found;
end;
$$;

revoke all on function public.admin_set_user_credits(uuid, numeric, numeric) from public, anon;
grant execute on function public.admin_set_user_credits(uuid, numeric, numeric) to authenticated, service_role;

-- 5. Função atômica para Débito de Créditos (executada pelo Worker)
create or replace function public.debit_user_credits(
  p_user_id uuid,
  p_minutes numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := false;
  v_current_credits numeric;
  v_new_credits numeric;
begin
  -- Checa se usuário é admin (admin não consome créditos)
  select coalesce(is_xandao, false), creditos_minutos
    into v_is_admin, v_current_credits
    from public.usuarios
   where id = p_user_id
   for update;

  if not found then
    raise exception 'Usuário não encontrado.';
  end if;

  if v_is_admin then
    return 99999.0;
  end if;

  if v_current_credits < p_minutes then
    return -1.0; -- Código de saldo insuficiente
  end if;

  update public.usuarios
     set creditos_minutos = round(creditos_minutos - p_minutes, 1)
   where id = p_user_id
   returning creditos_minutos into v_new_credits;

  return v_new_credits;
end;
$$;

revoke all on function public.debit_user_credits(uuid, numeric) from public, anon;
grant execute on function public.debit_user_credits(uuid, numeric) to service_role;

-- 6. Função atômica para Estorno de Créditos (executada pelo Worker se o job falhar)
create or replace function public.refund_user_credits(
  p_user_id uuid,
  p_minutes numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := false;
  v_new_credits numeric;
begin
  select coalesce(is_xandao, false)
    into v_is_admin
    from public.usuarios
   where id = p_user_id;

  if v_is_admin then
    return 99999.0;
  end if;

  update public.usuarios
     set creditos_minutos = round(creditos_minutos + p_minutes, 1)
   where id = p_user_id
   returning creditos_minutos into v_new_credits;

  return v_new_credits;
end;
$$;

revoke all on function public.refund_user_credits(uuid, numeric) from public, anon;
grant execute on function public.refund_user_credits(uuid, numeric) to service_role;
