-- Migration 0009: Full-Text Search + Embedding Model Tracking
-- Adds:
--   1. unaccent extension for accent-insensitive FTS
--   2. immutable_unaccent() wrapper (required for GENERATED columns)
--   3. search_vector GENERATED column on cat_itens and cats (auto-maintained by PostgreSQL)
--   4. GIN indexes for FTS performance
--   5. embedding_model tracking columns on all embedding tables

-- 1. Enable unaccent extension
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- 2. Immutable wrapper around unaccent (GENERATED columns require IMMUTABLE functions;
--    the built-in unaccent() is STABLE, so we wrap it)
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text AS $$
  SELECT public.unaccent('public.unaccent', $1);
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE STRICT;

-- 3. FTS column on cat_itens (auto-populated on INSERT/UPDATE)
ALTER TABLE cat_itens
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('portuguese', immutable_unaccent(coalesce(descricao, '')))
  ) STORED;

CREATE INDEX cat_itens_fts_idx ON cat_itens USING gin (search_vector);

-- 4. FTS column on cats (auto-populated on INSERT/UPDATE)
ALTER TABLE cats
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('portuguese', immutable_unaccent(coalesce(descricao_tecnica, '')))
  ) STORED;

CREATE INDEX cats_fts_idx ON cats USING gin (search_vector);

-- 5. Embedding model tracking on all embedding tables
--    NULL = old model (gemini-embedding-001), needs re-embedding
--    'text-embedding-005' = current model
ALTER TABLE cats ADD COLUMN embedding_model text;
ALTER TABLE cat_itens ADD COLUMN embedding_model text;
ALTER TABLE edital_requisitos ADD COLUMN embedding_model text;
ALTER TABLE req_parcelas_relevancia ADD COLUMN embedding_model text;
