-- Migration 0010: Widen habilitação free-text columns from varchar(200) to text
--
-- O LLM (gemini-2.5-flash, pós-migração Vertex) ocasionalmente devolve textos
-- >200 chars nestes campos de referência legal/aplicação, causando falha
-- `value too long for type character varying(200)` na extração de editais.
-- Estes campos são texto livre, não códigos curtos — text remove o limite.
-- varchar->text no PostgreSQL é uma mudança de metadados (sem rewrite de tabela).

ALTER TABLE req_habilitacao_juridica  ALTER COLUMN aplica_a          TYPE text;
ALTER TABLE req_qualificacao_tecnica  ALTER COLUMN registro_conselho TYPE text;
ALTER TABLE req_declaracoes           ALTER COLUMN base_legal         TYPE text;
ALTER TABLE req_declaracoes_especiais ALTER COLUMN lei                TYPE text;
