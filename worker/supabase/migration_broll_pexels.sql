-- =====================================================================
-- Migração: Adicionar suporte a B-Rolls automáticos (Pexels / Higgsfield)
-- Cole este arquivo no SQL Editor do seu Supabase e clique em RUN.
-- =====================================================================

-- 1. Adiciona colunas para B-Roll
alter table public.jobs add column if not exists use_broll boolean not null default false;
alter table public.jobs add column if not exists broll_source text not null default 'none';

-- 2. Constraint de validação para os provedores de B-Roll
alter table public.jobs drop constraint if exists jobs_broll_source_check;
alter table public.jobs add constraint jobs_broll_source_check 
  check (broll_source in ('pexels', 'higgsfield', 'none'));
