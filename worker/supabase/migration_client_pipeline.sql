-- =====================================================================
-- MIGRAÇÃO: Pipeline Híbrido Client-Edge (Extração de Áudio e Fatiamento Local)
-- =====================================================================

-- 1. Permite o novo status 'awaiting_client_cut'
alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs add constraint jobs_status_check 
  check (status in (
    'queued',
    'downloading',
    'transcribing',
    'analyzing',
    'awaiting_client_cut',
    'cutting',
    'done',
    'failed',
    'canceled'
  ));

-- 2. Permite o modo de enquadramento 'grupo' junto com os modos existentes
alter table public.jobs drop constraint if exists jobs_vertical_mode_check;
alter table public.jobs add constraint jobs_vertical_mode_check 
  check (vertical_mode in (
    'crop',
    'blur',
    'split',
    'face_tracking',
    'split_face',
    'grupo'
  ));

-- 3. Adiciona colunas para controle do fluxo cliente-servidor
alter table public.jobs 
  add column if not exists client_pipeline_enabled boolean not null default false,
  add column if not exists pending_candidates jsonb default '[]'::jsonb,
  add column if not exists audio_storage_path text;

-- 4. Recarrega o cache do PostgREST
notify pgrst, 'reload schema';
