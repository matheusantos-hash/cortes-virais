-- =====================================================================
-- Migração: Suporte a Motores de Transcrição (Deepgram vs Gemini Pro + Fallback)
-- =====================================================================

-- 1. Nova coluna na tabela public.jobs para definir o motor de transcrição do job
alter table public.jobs
  add column if not exists transcription_provider text not null default 'auto'
  check (transcription_provider in ('deepgram', 'gemini', 'auto'));

-- 2. Nova coluna na tabela public.usuarios para salvar a preferência padrão do usuário
alter table public.usuarios
  add column if not exists default_transcription_provider text not null default 'deepgram'
  check (default_transcription_provider in ('deepgram', 'gemini', 'auto'));

-- 3. RPC segura para o usuário atualizar sua preferência padrão de transcrição
create or replace function public.set_default_transcription_provider(p_provider text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return false;
  end if;

  if p_provider not in ('deepgram', 'gemini', 'auto') then
    raise exception 'Provedor de transcrição inválido: %', p_provider;
  end if;

  update public.usuarios
     set default_transcription_provider = p_provider
   where id = v_uid;

  return found;
end;
$$;

revoke all on function public.set_default_transcription_provider(text) from public, anon;
grant execute on function public.set_default_transcription_provider(text) to authenticated, service_role;
