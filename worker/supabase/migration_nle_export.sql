-- ==============================================================================
-- Migração: Suporte a Exportação NLE Profissional (Premiere Pro / DaVinci Resolve)
-- ==============================================================================

-- 1. Novos campos na tabela public.jobs
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS source_meta jsonb DEFAULT null,
ADD COLUMN IF NOT EXISTS file_name text DEFAULT null;

COMMENT ON COLUMN public.jobs.source_meta IS 'Metadados técnicos do arquivo original (fps exato, resolução, timecode, áudio, vfr) via ffprobe para reconstrução precisa de timeline';
COMMENT ON COLUMN public.jobs.file_name IS 'Nome original do arquivo submetido pelo usuário, preservado para conform / relink no NLE';

-- 2. Novo campo na tabela public.clips para decisões de edição detalhadas
ALTER TABLE public.clips
ADD COLUMN IF NOT EXISTS edit_decisions jsonb DEFAULT null;

COMMENT ON COLUMN public.clips.edit_decisions IS 'Decisões de edição estruturadas: enquadramento temporal (Motion), B-rolls com offset, marcadores de áudio (SFX) e palavras com timestamps para geração de XML, EDL e SRT';
