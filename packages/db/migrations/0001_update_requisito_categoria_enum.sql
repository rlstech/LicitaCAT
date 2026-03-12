-- Adiciona novos valores ao enum requisito_categoria para refletir a estrutura
-- padrão de editais de licitação brasileiros
ALTER TYPE requisito_categoria ADD VALUE IF NOT EXISTS 'habilitacao_fiscal_social_trabalhista';
ALTER TYPE requisito_categoria ADD VALUE IF NOT EXISTS 'qualificacao_economico_financeira';
ALTER TYPE requisito_categoria ADD VALUE IF NOT EXISTS 'qualificacao_tecnico_operacional';
ALTER TYPE requisito_categoria ADD VALUE IF NOT EXISTS 'qualificacao_tecnico_profissional';
ALTER TYPE requisito_categoria ADD VALUE IF NOT EXISTS 'declaracoes_outros';

-- Adiciona campo para referência a Anexos do edital nos requisitos
ALTER TABLE edital_requisitos
  ADD COLUMN IF NOT EXISTS referencia_anexo VARCHAR(100);
