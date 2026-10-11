-- =====================================================================
-- Migração: Otimizações de Desempenho e Alta Escala (Fase 1)
-- =====================================================================

-- 1. Índice parcial para resgate atômico ultra-rápido de jobs na fila
create index if not exists idx_jobs_claim_queue
  on public.jobs (job_type, created_at asc)
  where status = 'queued';

-- 2. Índice parcial para monitoramento e resgate de jobs órfãos/inativos (heartbeat)
create index if not exists idx_jobs_heartbeat_lease
  on public.jobs (heartbeat_at asc, retry_count)
  where status in ('downloading', 'transcribing', 'analyzing', 'cutting');

-- 3. Índice para busca de jobs por clipe em trimming
create index if not exists idx_jobs_target_clip
  on public.jobs (target_clip_id)
  where target_clip_id is not null;
