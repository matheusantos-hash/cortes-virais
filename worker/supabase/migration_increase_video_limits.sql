-- ==============================================================================
-- Migration: Suporte a vídeos longos e pesados (180 minutos / 3 horas)
-- ==============================================================================

-- 1. Altera o valor padrão da coluna para 180 minutos
ALTER TABLE public.usuarios 
  ALTER COLUMN limite_max_video_minutos SET DEFAULT 180.0;

-- 2. Atualiza usuários existentes que ainda estavam com o limite antigo de 60 minutos
UPDATE public.usuarios 
SET limite_max_video_minutos = 180.0 
WHERE limite_max_video_minutos <= 60.0;
