-- ==============================================================================
-- Migração: Estilos de Legendas, Sound Design (SFX) e Fase 5 (Thumbnails / Capas)
-- ==============================================================================

-- 1. Novos campos de estilo e som na tabela public.jobs
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS subtitle_style text DEFAULT 'hormozi',
ADD COLUMN IF NOT EXISTS enable_sfx boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_emojis boolean DEFAULT true;

-- 2. Campo para thumbnail / capa inteligente na tabela public.clips
ALTER TABLE public.clips
ADD COLUMN IF NOT EXISTS thumbnail_url text DEFAULT null;

-- Comentários informativos
COMMENT ON COLUMN public.jobs.subtitle_style IS 'Estilo de tipografia das legendas animadas: hormozi, beast, apple, minimal';
COMMENT ON COLUMN public.jobs.enable_sfx IS 'Ativa Sound Design automático (whoosh nas transições, pop em emojis e ding no gancho)';
COMMENT ON COLUMN public.jobs.enable_emojis IS 'Injeta emojis contextuais dinâmicos nas palavras de alta retenção';
COMMENT ON COLUMN public.clips.thumbnail_url IS 'URL da thumbnail gerada pela IA ou selecionada pelo usuário';
