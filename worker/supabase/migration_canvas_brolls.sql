-- =====================================================================
-- Migração: Suporte a B-Rolls Canvas & Overlays Dinâmicos na Timeline
-- =====================================================================

-- 1. Novas colunas para persistir os overlays gráficos em clips e jobs
alter table public.clips
  add column if not exists canvas_brolls jsonb not null default '[]'::jsonb;

alter table public.jobs
  add column if not exists canvas_brolls jsonb default '[]'::jsonb;

-- 2. Função RPC para salvar B-Rolls Canvas editados pelo usuário
create or replace function public.save_clip_canvas_brolls(
  p_clip_id uuid,
  p_canvas_brolls jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_clip public.clips%rowtype;
begin
  if v_uid is null then
    raise exception 'Apenas usuários autenticados podem salvar B-Rolls.';
  end if;

  select * into v_clip
    from public.clips
   where id = p_clip_id;

  if not found then
    raise exception 'Clipe não encontrado.';
  end if;

  if v_clip.user_id <> v_uid then
    -- Se não for dono, verifica se é administrador
    if not exists (select 1 from public.usuarios where id = v_uid and is_xandao = true) then
      raise exception 'Permissão negada para editar este corte.';
    end if;
  end if;

  update public.clips
     set canvas_brolls = coalesce(p_canvas_brolls, '[]'::jsonb)
   where id = p_clip_id;

  return true;
end;
$$;

revoke all on function public.save_clip_canvas_brolls(uuid, jsonb) from public, anon;
grant execute on function public.save_clip_canvas_brolls(uuid, jsonb) to authenticated, service_role;

-- 3. Atualização da função request_clip_trim para suportar re-render com B-Rolls Canvas
create or replace function public.request_clip_trim(
  p_clip_id uuid,
  p_start numeric,
  p_end numeric,
  p_canvas_brolls jsonb default null
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
  v_active_brolls jsonb;
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
    if not exists (select 1 from public.usuarios where id = v_uid and is_xandao = true) then
      raise exception 'Permissão negada para editar este corte.';
    end if;
  end if;

  if p_start < 0 or p_end <= p_start then
    raise exception 'Intervalo de tempo inválido para o corte.';
  end if;

  -- Se foram fornecidos novos canvas_brolls, atualiza; senão mantém os existentes
  v_active_brolls := coalesce(p_canvas_brolls, v_clip.canvas_brolls, '[]'::jsonb);

  -- Marca clipe como em reprocessamento
  update public.clips
     set is_trimming = true,
         canvas_brolls = v_active_brolls
   where id = p_clip_id;

  -- Cria job prioritário de trim na fila com os canvas_brolls associados
  insert into public.jobs (
    user_id,
    job_type,
    source_type,
    target_clip_id,
    trim_start,
    trim_end,
    canvas_brolls,
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
    v_active_brolls,
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

revoke all on function public.request_clip_trim(uuid, numeric, numeric, jsonb) from public, anon;
grant execute on function public.request_clip_trim(uuid, numeric, numeric, jsonb) to authenticated, service_role;
