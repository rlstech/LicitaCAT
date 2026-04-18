-- Adiciona data de encerramento de propostas e status de enriquecimento ao cache PNCP
ALTER TABLE pncp_cache
  ADD COLUMN data_encerramento_proposta TIMESTAMPTZ,
  ADD COLUMN enrich_status VARCHAR(20) NOT NULL DEFAULT 'pending';

CREATE INDEX pncp_cache_data_enc_idx ON pncp_cache (data_encerramento_proposta DESC NULLS LAST);
CREATE INDEX pncp_cache_enrich_status_idx ON pncp_cache (enrich_status) WHERE enrich_status = 'pending';
