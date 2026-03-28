-- 0005_pncp_cache.sql
-- Adiciona tabelas de cache local do PNCP e configuração de sync por tenant

-- Tabela global de cache (dados públicos — sem RLS por tenant)
CREATE TABLE pncp_cache (
  id                     TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_compra             INTEGER      NOT NULL,
  sequencial_compra      VARCHAR(20)  NOT NULL,
  cnpj_orgao             VARCHAR(18)  NOT NULL,
  uf                     VARCHAR(2)   NOT NULL,
  codigo_municipio_ibge  VARCHAR(7),
  nome_municipio         VARCHAR(200),
  razao_social           VARCHAR(500),
  codigo_modalidade      INTEGER      NOT NULL,
  modalidade_nome        VARCHAR(200),
  objeto                 TEXT,
  valor_total_estimado   NUMERIC(15,2),
  data_publicacao_pncp   DATE         NOT NULL,
  data_abertura_proposta TIMESTAMPTZ,
  situacao_compra_id     INTEGER,
  situacao_compra_nome   VARCHAR(100),
  link_sistema_origem    TEXT,
  raw_data               JSONB        NOT NULL,
  synced_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT pncp_cache_natural_key UNIQUE (ano_compra, sequencial_compra, cnpj_orgao)
);

CREATE INDEX pncp_cache_uf_idx          ON pncp_cache (uf);
CREATE INDEX pncp_cache_modalidade_idx  ON pncp_cache (codigo_modalidade);
CREATE INDEX pncp_cache_data_pub_idx    ON pncp_cache (data_publicacao_pncp DESC);
CREATE INDEX pncp_cache_municipio_idx   ON pncp_cache (codigo_municipio_ibge);
CREATE INDEX pncp_cache_valor_idx       ON pncp_cache (valor_total_estimado);
CREATE INDEX pncp_cache_synced_at_idx   ON pncp_cache (synced_at);
CREATE INDEX pncp_cache_objeto_trgm_idx ON pncp_cache USING gin (objeto gin_trgm_ops);

-- Configuração de sync por tenant
CREATE TABLE pncp_sync_config (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ufs               TEXT[]    NOT NULL DEFAULT '{}',
  modalidades       INTEGER[] NOT NULL DEFAULT '{}',
  retention_days    INTEGER   NOT NULL DEFAULT 90,
  is_active         BOOLEAN   NOT NULL DEFAULT TRUE,
  last_synced_at    TIMESTAMPTZ,
  last_sync_status  VARCHAR(20),
  last_sync_error   TEXT,
  last_sync_job_id  TEXT,
  records_synced    INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pncp_sync_config_tenant_unique UNIQUE (tenant_id)
);

CREATE INDEX pncp_sync_config_tenant_idx ON pncp_sync_config (tenant_id);
CREATE INDEX pncp_sync_config_active_idx ON pncp_sync_config (is_active) WHERE is_active = TRUE;
