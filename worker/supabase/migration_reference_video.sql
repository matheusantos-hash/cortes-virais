-- =====================================================================
-- Migração: Adicionar suporte a Vídeo de Referência e Design de Cortes
-- Cole este arquivo no SQL Editor do seu Supabase e clique em RUN.
-- =====================================================================

-- 1. Adiciona colunas para layout e vídeo de referência
alter table public.jobs add column if not exists vertical_mode text not null default 'crop';
alter table public.jobs add column if not exists reference_type text not null default 'none';
alter table public.jobs add column if not exists reference_url text;
alter table public.jobs add column if not exists reference_path text;
alter table public.jobs add column if not exists reference_style text;
alter table public.jobs add column if not exists design_instructions text;

-- 2. Garante as constraints de validação
alter table public.jobs drop constraint if exists jobs_vertical_mode_check;
alter table public.jobs add constraint jobs_vertical_mode_check 
  check (vertical_mode in ('crop', 'blur', 'split'));

alter table public.jobs drop constraint if exists jobs_reference_type_check;
alter table public.jobs add constraint jobs_reference_type_check 
  check (reference_type in ('link', 'upload', 'preset', 'none'));
