-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enums
CREATE TYPE tenant_plan AS ENUM ('starter', 'professional', 'enterprise');
CREATE TYPE user_role AS ENUM ('admin', 'analyst', 'viewer');
CREATE TYPE edital_status AS ENUM ('uploaded', 'ocr_processing', 'extracting', 'review_pending', 'ready', 'error');
CREATE TYPE pdf_type AS ENUM ('copyable', 'scanned', 'mixed');
CREATE TYPE modalidade_licitacao AS ENUM ('pregao_eletronico', 'pregao_presencial', 'concorrencia', 'tomada_de_precos', 'convite', 'leilao', 'concurso', 'rdc', 'credenciamento', 'outro');
CREATE TYPE requisito_status AS ENUM ('ai_extracted', 'human_approved', 'human_edited', 'human_rejected');
CREATE TYPE requisito_categoria AS ENUM ('qualificacao_tecnica', 'qualificacao_economica', 'regularidade_fiscal', 'habilitacao_juridica', 'outro');
CREATE TYPE conselho AS ENUM ('CREA', 'CAU');
CREATE TYPE cat_file_type AS ENUM ('pdf_scanned', 'pdf_copyable', 'excel', 'manual');
CREATE TYPE cat_extraction_status AS ENUM ('pending', 'processing', 'review_pending', 'completed', 'error');
CREATE TYPE cat_item_origem AS ENUM ('ai_extracted', 'human_added', 'excel_imported');
CREATE TYPE crossing_status AS ENUM ('queued', 'processing', 'completed', 'error');
CREATE TYPE recomendacao AS ENUM ('participar', 'participar_com_ressalvas', 'nao_participar');
CREATE TYPE crossing_item_resultado AS ENUM ('atendido', 'atendido_parcialmente', 'gap');
CREATE TYPE nivel_match AS ENUM ('cat', 'item');
CREATE TYPE avaliacao_llm AS ENUM ('atende', 'atende_parcialmente', 'nao_atende');
CREATE TYPE job_type AS ENUM ('ocr', 'edital_extraction', 'cat_extraction', 'crossing', 'embedding_gen');
CREATE TYPE job_status AS ENUM ('queued', 'running', 'completed', 'failed', 'retrying');
CREATE TYPE job_entity_type AS ENUM ('edital', 'cat', 'crossing');

-- Tables
CREATE TABLE tenants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(300) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  plan tenant_plan NOT NULL DEFAULT 'starter',
  max_editais_per_month INTEGER NOT NULL DEFAULT 10,
  max_cats_stored INTEGER NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(300) NOT NULL,
  role user_role NOT NULL DEFAULT 'analyst',
  auth_provider_id VARCHAR(255) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE editais (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  page_count INTEGER,
  pdf_type pdf_type,
  status edital_status NOT NULL DEFAULT 'uploaded',
  orgao_licitante VARCHAR(500),
  numero_edital VARCHAR(100),
  modalidade modalidade_licitacao,
  objeto TEXT,
  valor_estimado NUMERIC(15,2),
  data_abertura TIMESTAMPTZ,
  ai_extraction_cost_usd NUMERIC(10,6),
  ocr_cost_usd NUMERIC(10,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE edital_requisitos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edital_id TEXT NOT NULL REFERENCES editais(id) ON DELETE CASCADE,
  lote VARCHAR(100),
  categoria requisito_categoria NOT NULL DEFAULT 'qualificacao_tecnica',
  descricao TEXT NOT NULL,
  trecho_original TEXT,
  pagina_referencia INTEGER,
  quantitativo_exigido NUMERIC(15,4),
  unidade VARCHAR(50),
  ai_confidence_score INTEGER NOT NULL DEFAULT 0,
  status requisito_status NOT NULL DEFAULT 'ai_extracted',
  edited_by TEXT REFERENCES users(id),
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE profissionais_tecnicos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome VARCHAR(300) NOT NULL,
  numero_crea_cau VARCHAR(50) NOT NULL,
  conselho conselho NOT NULL,
  uf_registro VARCHAR(2) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cats (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profissional_id TEXT NOT NULL REFERENCES profissionais_tecnicos(id) ON DELETE RESTRICT,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type cat_file_type NOT NULL,
  numero_cat VARCHAR(100),
  empresa_contratante VARCHAR(500),
  tipo_obra_servico VARCHAR(500),
  descricao_tecnica TEXT,
  quantitativo_valor NUMERIC(15,4),
  quantitativo_unidade VARCHAR(50),
  data_inicio TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  status_extracao cat_extraction_status NOT NULL DEFAULT 'pending',
  ai_confidence_score INTEGER,
  embedding VECTOR(1536),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cat_itens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cat_id TEXT NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  numero_item INTEGER,
  descricao TEXT NOT NULL,
  unidade VARCHAR(50),
  quantidade NUMERIC(15,4),
  origem cat_item_origem NOT NULL DEFAULT 'ai_extracted',
  ai_confidence_score INTEGER,
  embedding VECTOR(1536),
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE crossings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edital_id TEXT NOT NULL REFERENCES editais(id) ON DELETE CASCADE,
  triggered_by TEXT NOT NULL REFERENCES users(id),
  status crossing_status NOT NULL DEFAULT 'queued',
  score_aderencia INTEGER,
  total_requisitos INTEGER,
  requisitos_atendidos INTEGER,
  requisitos_com_ressalva INTEGER,
  requisitos_gap INTEGER,
  recomendacao recomendacao,
  recomendacao_justificativa TEXT,
  ai_cost_usd NUMERIC(10,6),
  processing_time_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE crossing_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  crossing_id TEXT NOT NULL REFERENCES crossings(id) ON DELETE CASCADE,
  requisito_id TEXT NOT NULL REFERENCES edital_requisitos(id),
  resultado crossing_item_resultado NOT NULL,
  ai_justificativa TEXT,
  score_similaridade_max NUMERIC(5,4),
  human_override BOOLEAN NOT NULL DEFAULT FALSE,
  human_override_by TEXT REFERENCES users(id),
  human_override_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE crossing_item_cats (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  crossing_item_id TEXT NOT NULL REFERENCES crossing_items(id) ON DELETE CASCADE,
  cat_id TEXT NOT NULL REFERENCES cats(id),
  cat_item_id TEXT REFERENCES cat_itens(id),
  nivel_match nivel_match NOT NULL,
  score_similaridade NUMERIC(5,4) NOT NULL,
  avaliacao_llm avaliacao_llm NOT NULL,
  justificativa_llm TEXT NOT NULL,
  rank_posicao INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE processing_jobs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_type job_type NOT NULL,
  entity_type job_entity_type NOT NULL,
  entity_id TEXT NOT NULL,
  status job_status NOT NULL DEFAULT 'queued',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cost_usd NUMERIC(10,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX editais_tenant_id_idx ON editais (tenant_id);
CREATE INDEX editais_tenant_status_idx ON editais (tenant_id, status);

CREATE INDEX edital_requisitos_tenant_edital_idx ON edital_requisitos (tenant_id, edital_id);
CREATE INDEX edital_requisitos_confidence_idx ON edital_requisitos (ai_confidence_score);
CREATE INDEX edital_requisitos_hnsw_embedding ON edital_requisitos USING hnsw (embedding vector_cosine_ops);

CREATE INDEX profissionais_tenant_idx ON profissionais_tecnicos (tenant_id);

CREATE INDEX cats_tenant_idx ON cats (tenant_id);
CREATE INDEX cats_tenant_tipo_idx ON cats (tenant_id, tipo_obra_servico);
CREATE INDEX cats_hnsw_embedding ON cats USING hnsw (embedding vector_cosine_ops);

CREATE INDEX cat_itens_tenant_cat_idx ON cat_itens (tenant_id, cat_id);
CREATE INDEX cat_itens_hnsw_embedding ON cat_itens USING hnsw (embedding vector_cosine_ops);

CREATE INDEX crossings_tenant_edital_idx ON crossings (tenant_id, edital_id);

CREATE INDEX processing_jobs_tenant_status_idx ON processing_jobs (tenant_id, status);
CREATE INDEX processing_jobs_entity_idx ON processing_jobs (entity_type, entity_id);

CREATE INDEX audit_logs_tenant_created_idx ON audit_logs (tenant_id, created_at);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_editais_updated_at BEFORE UPDATE ON editais FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_edital_requisitos_updated_at BEFORE UPDATE ON edital_requisitos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profissionais_updated_at BEFORE UPDATE ON profissionais_tecnicos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cats_updated_at BEFORE UPDATE ON cats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cat_itens_updated_at BEFORE UPDATE ON cat_itens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crossings_updated_at BEFORE UPDATE ON crossings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crossing_items_updated_at BEFORE UPDATE ON crossing_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_processing_jobs_updated_at BEFORE UPDATE ON processing_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE editais ENABLE ROW LEVEL SECURITY;
ALTER TABLE edital_requisitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE profissionais_tecnicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cats ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE crossings ENABLE ROW LEVEL SECURITY;
ALTER TABLE crossing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;
