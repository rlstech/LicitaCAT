-- Pipeline de classificação de licitações por segmentos de atuação
-- Adiciona colunas para armazenar resultado da classificação híbrida (keywords + IA)

ALTER TABLE pncp_cache
  ADD COLUMN segmentos                   TEXT[]      DEFAULT '{}',
  ADD COLUMN classificacao_confianca     VARCHAR(10),
  ADD COLUMN classificacao_metodo        VARCHAR(15),
  ADD COLUMN classificacao_justificativa TEXT,
  ADD COLUMN classificacao_keywords      TEXT[]      DEFAULT '{}',
  ADD COLUMN classificado_at             TIMESTAMPTZ;

-- GIN index para queries de filtro por segmento (operador @> e &&)
CREATE INDEX pncp_cache_segmentos_idx ON pncp_cache USING gin (segmentos);

-- Partial index para encontrar registros não classificados rapidamente
CREATE INDEX pncp_cache_nao_classificado_idx ON pncp_cache (classificado_at) WHERE classificado_at IS NULL;
