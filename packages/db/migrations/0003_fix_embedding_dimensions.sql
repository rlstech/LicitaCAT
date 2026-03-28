-- Migration 0003: Fix embedding vector dimensions for cats, cat_itens, edital_requisitos
--
-- Context: The system switched from Voyage AI (1536 dims) to Google Gemini embedding-001
-- (768 dims). Migration 0002 already created req_parcelas_relevancia with VECTOR(768).
-- This migration aligns the remaining tables.
--
-- Since ALTER COLUMN TYPE is not supported for pgvector columns, we drop + re-add.
-- All existing embeddings are NULL (were never successfully stored), so no data is lost.

-- ── cats ────────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS cats_hnsw_embedding;
ALTER TABLE cats DROP COLUMN IF EXISTS embedding;
ALTER TABLE cats ADD COLUMN embedding VECTOR(768);
CREATE INDEX cats_hnsw_embedding ON cats USING hnsw (embedding vector_cosine_ops);

-- ── cat_itens ────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS cat_itens_hnsw_embedding;
ALTER TABLE cat_itens DROP COLUMN IF EXISTS embedding;
ALTER TABLE cat_itens ADD COLUMN embedding VECTOR(768);
CREATE INDEX cat_itens_hnsw_embedding ON cat_itens USING hnsw (embedding vector_cosine_ops);

-- ── edital_requisitos (legacy, kept for consistency) ────────────────────────────
DROP INDEX IF EXISTS edital_requisitos_hnsw_embedding;
ALTER TABLE edital_requisitos DROP COLUMN IF EXISTS embedding;
ALTER TABLE edital_requisitos ADD COLUMN embedding VECTOR(768);
CREATE INDEX edital_requisitos_hnsw_embedding ON edital_requisitos USING hnsw (embedding vector_cosine_ops);
