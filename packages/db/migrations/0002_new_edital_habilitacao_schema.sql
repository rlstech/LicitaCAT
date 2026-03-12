-- Migration 0002: New Edital Habilitação Schema
-- Adds 11 specialized tables for structured edital extraction
-- and migrates crossing_items FK from edital_requisitos to req_parcelas_relevancia

-- ── Step 1: Add new columns to editais ────────────────────────────────────────
ALTER TABLE editais ADD COLUMN IF NOT EXISTS uasg VARCHAR(20);
ALTER TABLE editais ADD COLUMN IF NOT EXISTS regime_execucao VARCHAR(100);
ALTER TABLE editais ADD COLUMN IF NOT EXISTS criterio_julgamento VARCHAR(100);
ALTER TABLE editais ADD COLUMN IF NOT EXISTS prazo_execucao_meses INTEGER;
ALTER TABLE editais ADD COLUMN IF NOT EXISTS lei_regente VARCHAR(100);
ALTER TABLE editais ADD COLUMN IF NOT EXISTS admite_consorcio BOOLEAN;
ALTER TABLE editais ADD COLUMN IF NOT EXISTS exige_subcontratacao BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE editais ADD COLUMN IF NOT EXISTS subcontratacao_percentual_max NUMERIC(5,2);
ALTER TABLE editais ADD COLUMN IF NOT EXISTS trata_favorecido_me_epp BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE editais ADD COLUMN IF NOT EXISTS sicaf_substitui_documentos BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE editais ADD COLUMN IF NOT EXISTS observacoes_extraidas TEXT;

-- ── Step 2: New enum ───────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE alerta_nivel AS ENUM ('critico', 'atencao', 'informacao');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Step 3: Create 11 specialized habilitação tables ──────────────────────────

-- 3.1 Habilitação Jurídica
CREATE TABLE IF NOT EXISTS req_habilitacao_juridica (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edital_id TEXT NOT NULL REFERENCES editais(id) ON DELETE CASCADE,
  documento TEXT NOT NULL,
  aplica_a VARCHAR(200),
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2 Regularidade Fiscal
CREATE TABLE IF NOT EXISTS req_regularidade_fiscal (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edital_id TEXT NOT NULL REFERENCES editais(id) ON DELETE CASCADE,
  documento TEXT NOT NULL,
  sigla VARCHAR(50),
  validade_dias INTEGER,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.3 Qualificação Técnica (1:1 per edital)
CREATE TABLE IF NOT EXISTS req_qualificacao_tecnica (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edital_id TEXT NOT NULL UNIQUE REFERENCES editais(id) ON DELETE CASCADE,
  registro_conselho VARCHAR(200),
  exige_visita_tecnica BOOLEAN NOT NULL DEFAULT FALSE,
  visita_tipo VARCHAR(100),
  exige_escritorio_local BOOLEAN NOT NULL DEFAULT FALSE,
  escritorio_descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.4 Profissionais Exigidos
CREATE TABLE IF NOT EXISTS req_profissionais (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edital_id TEXT NOT NULL REFERENCES editais(id) ON DELETE CASCADE,
  cargo TEXT NOT NULL,
  conselho VARCHAR(50),
  quantidade INTEGER,
  cbo VARCHAR(20),
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.5 Parcelas de Relevância (source for crossing)
CREATE TABLE IF NOT EXISTS req_parcelas_relevancia (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edital_id TEXT NOT NULL REFERENCES editais(id) ON DELETE CASCADE,
  servico TEXT NOT NULL,
  unidade VARCHAR(50),
  quantidade_minima NUMERIC(15,4),
  observacao TEXT,
  embedding VECTOR(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS req_parcelas_relevancia_embedding_idx
  ON req_parcelas_relevancia USING hnsw (embedding vector_cosine_ops);

-- 3.6 Atestados de Profissionais
CREATE TABLE IF NOT EXISTS req_atestados_profissionais (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edital_id TEXT NOT NULL REFERENCES editais(id) ON DELETE CASCADE,
  profissional TEXT NOT NULL,
  caracteristicas_exigidas TEXT,
  exige_cat BOOLEAN NOT NULL DEFAULT FALSE,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.7 Qualificação Financeira (1:1 per edital)
CREATE TABLE IF NOT EXISTS req_qualificacao_financeira (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edital_id TEXT NOT NULL UNIQUE REFERENCES editais(id) ON DELETE CASCADE,
  exige_balanco BOOLEAN NOT NULL DEFAULT FALSE,
  balanco_exercicios INTEGER,
  patrimonio_liquido_minimo NUMERIC(15,2),
  patrimonio_percentual_contrato NUMERIC(5,2),
  lc_minimo NUMERIC(5,2),
  lg_minimo NUMERIC(5,2),
  sg_minimo NUMERIC(5,2),
  exige_certidao_falencia BOOLEAN NOT NULL DEFAULT FALSE,
  certidao_falencia_prazo_dias INTEGER,
  exige_capital_social_minimo BOOLEAN NOT NULL DEFAULT FALSE,
  capital_social_minimo NUMERIC(15,2),
  exige_garantia_proposta BOOLEAN NOT NULL DEFAULT FALSE,
  garantia_proposta_percentual NUMERIC(5,2),
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.8 Declarações
CREATE TABLE IF NOT EXISTS req_declaracoes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edital_id TEXT NOT NULL REFERENCES editais(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  base_legal VARCHAR(200),
  lei_estadual BOOLEAN NOT NULL DEFAULT FALSE,
  penalidade_omissao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.9 Declarações Especiais (lei estadual)
CREATE TABLE IF NOT EXISTS req_declaracoes_especiais (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edital_id TEXT NOT NULL REFERENCES editais(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  lei VARCHAR(200),
  uf VARCHAR(2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.10 Alertas
CREATE TABLE IF NOT EXISTS req_alertas (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edital_id TEXT NOT NULL REFERENCES editais(id) ON DELETE CASCADE,
  nivel alerta_nivel NOT NULL,
  categoria VARCHAR(100),
  descricao TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.11 Anexos Referenciados
CREATE TABLE IF NOT EXISTS req_anexos_referenciados (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edital_id TEXT NOT NULL REFERENCES editais(id) ON DELETE CASCADE,
  identificacao VARCHAR(100) NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Step 4: Enable RLS on all new tables ──────────────────────────────────────
ALTER TABLE req_habilitacao_juridica ENABLE ROW LEVEL SECURITY;
ALTER TABLE req_regularidade_fiscal ENABLE ROW LEVEL SECURITY;
ALTER TABLE req_qualificacao_tecnica ENABLE ROW LEVEL SECURITY;
ALTER TABLE req_profissionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE req_parcelas_relevancia ENABLE ROW LEVEL SECURITY;
ALTER TABLE req_atestados_profissionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE req_qualificacao_financeira ENABLE ROW LEVEL SECURITY;
ALTER TABLE req_declaracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE req_declaracoes_especiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE req_alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE req_anexos_referenciados ENABLE ROW LEVEL SECURITY;

-- ── Step 5: Migrate crossing_items FK to req_parcelas_relevancia ──────────────
-- Clear existing crossings (schema incompatible — new FK target)
DELETE FROM crossing_item_cats;
DELETE FROM crossing_items;
DELETE FROM crossings;

-- Drop old FK (PostgreSQL auto-names it crossing_items_requisito_id_fkey)
ALTER TABLE crossing_items DROP CONSTRAINT IF EXISTS crossing_items_requisito_id_fkey;

-- Add new FK pointing to req_parcelas_relevancia
ALTER TABLE crossing_items ADD CONSTRAINT crossing_items_req_parcelas_fk
  FOREIGN KEY (requisito_id) REFERENCES req_parcelas_relevancia(id);
