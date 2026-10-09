-- Migration: Campos de telemetria e aprendizagem para estilos de clonagem salvos
ALTER TABLE public.saved_references 
ADD COLUMN IF NOT EXISTS learning_status text DEFAULT 'ready',
ADD COLUMN IF NOT EXISTS learning_metrics jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS sample_videos text[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS sample_subtitles text[] DEFAULT '{}'::text[];

COMMENT ON COLUMN public.saved_references.learning_status IS 'Status da aprendizagem do estilo (ready, learning, pending)';
COMMENT ON COLUMN public.saved_references.learning_metrics IS 'Métricas e Style Blueprint extraídos dos vídeos e legendas de exemplo';
COMMENT ON COLUMN public.saved_references.sample_videos IS 'Nomes dos vídeos utilizados como material de treino';
COMMENT ON COLUMN public.saved_references.sample_subtitles IS 'Nomes dos arquivos de legenda utilizados como material de treino';
