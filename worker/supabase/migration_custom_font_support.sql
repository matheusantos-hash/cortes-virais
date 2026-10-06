-- ==============================================================================
-- Migração: Suporte a Fontes Tipográficas Customizadas (.ttf, .otf, .woff, .woff2)
-- ==============================================================================

ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS custom_font_path text,
ADD COLUMN IF NOT EXISTS custom_font_name text;

ALTER TABLE public.saved_references 
ADD COLUMN IF NOT EXISTS custom_font_path text,
ADD COLUMN IF NOT EXISTS custom_font_name text;

COMMENT ON COLUMN public.jobs.custom_font_path IS 'Caminho no Storage para arquivo de fonte customizada (.ttf, .otf, .woff)';
COMMENT ON COLUMN public.jobs.custom_font_name IS 'Nome de exibição ou família da fonte tipográfica customizada';
COMMENT ON COLUMN public.saved_references.custom_font_path IS 'Caminho no Storage para arquivo de fonte customizada (.ttf, .otf, .woff)';
COMMENT ON COLUMN public.saved_references.custom_font_name IS 'Nome de exibição ou família da fonte tipográfica customizada';
