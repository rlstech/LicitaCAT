# LicitaCAT — Especificação Completa do Sistema

> **Versão:** 1.0  
> **Data:** 2026-04-08  
> **Status:** Documento vivo — atualizar a cada módulo concluído

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Modelo de Dados](#3-modelo-de-dados)
4. [API — Contratos de Interface](#4-api--contratos-de-interface)
5. [Pipeline de Processamento](#5-pipeline-de-processamento)
6. [Motor de Inteligência Artificial](#6-motor-de-inteligência-artificial)
7. [Frontend — Fluxos de Usuário](#7-frontend--fluxos-de-usuário)
8. [Autenticação e Multi-tenancy](#8-autenticação-e-multi-tenancy)
9. [Infraestrutura e Deploy](#9-infraestrutura-e-deploy)
10. [Segurança](#10-segurança)
11. [Monitoramento e Custos de IA](#11-monitoramento-e-custos-de-ia)
12. [Estado de Implementação](#12-estado-de-implementação)

---

## 1. Visão Geral

### 1.1 Propósito

O **LicitaCAT** é uma plataforma SaaS multi-tenant que utiliza Inteligência Artificial para automatizar a análise de participação em licitações públicas de engenharia no Brasil.

O sistema resolve três problemas centrais das empresas de engenharia:

| Problema | Solução LicitaCAT |
|----------|------------------|
| Ler 100+ páginas de edital para extrair requisitos de habilitação | Extração automática por IA com estruturação em 11 categorias |
| Inventariar manualmente o acervo técnico (CATs) para verificar aderência | Indexação semântica + FTS de todo o acervo |
| Decidir "vale a pena concorrer?" de forma subjetiva | Crossing automático com score 0–100 e recomendação fundamentada |

### 1.2 Usuários-Alvo

- **Empresas de engenharia** brasileiras que participam de licitações públicas
- Perfis de usuário: administradores, analistas, visualizadores

### 1.3 Fluxo Principal

```
Edital PDF/PNCP → OCR → Extração IA → Requisitos Estruturados
                                              ↓
CATs PDF/Excel  → OCR → Extração IA → Itens de Acervo Indexados
                                              ↓
                              Crossing (Semântico + LLM)
                                              ↓
                         Score + Recomendação + Justificativa
```

---

## 2. Arquitetura do Sistema

### 2.1 Visão Macro

```
┌─────────────────────────────────────────────────────────┐
│                    USUÁRIO (Browser)                     │
│              Next.js 14 — App Router (SSR/CSR)          │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS (Traefik)
┌──────────────────────────▼──────────────────────────────┐
│              Fastify API  (Node.js 20)                   │
│   /api/editais  /api/cats  /api/crossings  /api/users   │
│   /api/uploads  /api/dashboard  /api/pncp-cache         │
└────────┬────────────────┬────────────────┬──────────────┘
         │                │                │
    ┌────▼────┐    ┌──────▼──────┐   ┌────▼────┐
    │  PgSQL  │    │    Redis     │   │   S3    │
    │  16+    │    │  (BullMQ +  │   │ (MinIO) │
    │pgvector │    │   Pub/Sub)  │   │         │
    └─────────┘    └──────┬──────┘   └─────────┘
                          │
              ┌───────────▼───────────┐
              │     BullMQ Worker     │
              │  (mesmo container     │
              │   da API em prod)     │
              └───────────┬───────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
   ┌──────────┐   ┌──────────────┐  ┌────────────┐
   │ Gemini   │   │ Google Doc   │  │   PNCP     │
   │  API     │   │     AI       │  │    API     │
   │(LLM+Emb) │   │   (OCR)      │  │ (público)  │
   └──────────┘   └──────────────┘  └────────────┘
```

### 2.2 Estrutura do Monorepo (Turborepo)

```
licitacat/
├── apps/
│   ├── api/                    # Fastify backend
│   │   ├── src/
│   │   │   ├── server.ts       # Bootstrap + plugins
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts     # requireAuth + requireRole
│   │   │   └── modules/
│   │   │       ├── editais/    # routes, service, schema, repository
│   │   │       ├── cats/       # routes, service, schema, repository
│   │   │       ├── crossings/  # routes, service, schema, repository
│   │   │       ├── uploads/    # routes, schema
│   │   │       ├── dashboard/  # routes
│   │   │       ├── users/      # routes, repository
│   │   │       └── pncp-cache/ # routes, repository, schema
│   └── web/                    # Next.js frontend
│       └── src/app/
│           ├── (dashboard)/    # Layout autenticado com sidebar
│           │   ├── dashboard/
│           │   ├── editais/
│           │   ├── cats/
│           │   ├── cruzamentos/
│           │   └── configuracoes/
│           ├── (auth)/         # sign-in, sign-up
│           └── api/auth/       # Better Auth handler
├── packages/
│   ├── db/                     # Schema Drizzle + migrations SQL
│   ├── ai/                     # LLM, OCR, Embeddings, Storage, Prompts
│   ├── queue/                  # Processors BullMQ + worker
│   ├── auth/                   # Better Auth config
│   └── shared/                 # Tipos TypeScript + Zod schemas
```

### 2.3 Tecnologias

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | Next.js + TypeScript | 14.2 |
| Backend API | Fastify + TypeScript | 4.26 |
| Banco de Dados | PostgreSQL + pgvector | 16 |
| ORM | Drizzle ORM | — |
| Fila de Jobs | BullMQ + Redis | — |
| Storage | MinIO (dev) / AWS S3 (prod) | — |
| OCR | Google Document AI | — |
| LLM | Google Gemini | `gemini-3-flash-preview` |
| Embeddings | Google Gemini | `gemini-embedding-2-preview` (1536D) |
| Autenticação | Better Auth | 1.2 |
| Monorepo | Turborepo + pnpm | — |
| Containerização | Docker Swarm (prod) / Compose (dev) | — |

---

## 3. Modelo de Dados

### 3.1 Diagrama ER Simplificado

```
tenants ─┬─< users
         ├─< editais ─< edital_requisitos (embedding)
         │            └─< req_habilitacao_juridica
         │            └─< req_regularidade_fiscal
         │            └─< req_qualificacao_tecnica
         │            └─< req_profissionais
         │            └─< req_parcelas_relevancia (embedding)
         │            └─< req_atestados_profissionais
         │            └─< req_qualificacao_financeira
         │            └─< req_declaracoes
         │            └─< req_declaracoes_especiais
         │            └─< req_alertas
         │            └─< req_anexos_referenciados
         ├─< profissionais_tecnicos ─< cats (embedding, FTS)
         │                            └─< cat_itens (embedding, FTS)
         ├─< crossings ─< crossing_items ─< crossing_item_cats
         ├─< processing_jobs
         ├─< audit_logs
         └─< pncp_sync_config

[global] pncp_cache (sem RLS — dados públicos)
[auth]   ba_user, ba_session, ba_account, ba_verification
```

### 3.2 Tabelas de Multi-tenancy e Acesso

#### `tenants`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| name | TEXT | Nome da empresa |
| slug | TEXT UNIQUE | URL-friendly slug |
| plan | ENUM | starter \| professional \| enterprise |
| max_editais_per_month | INT | Quota mensal de editais |
| max_cats_stored | INT | Quota de CATs armazenadas |
| active | BOOL | Conta ativa |

#### `users`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| tenant_id | UUID FK | Tenant de origem |
| email | TEXT | Email (único por tenant) |
| name | TEXT | Nome do usuário |
| role | ENUM | admin \| analyst \| viewer |
| auth_provider_id | TEXT NULL | ID no Better Auth (nullable para convites) |
| active | BOOL | Usuário ativo |

#### `audit_logs`
Imutável. Registra: action, entity_type, entity_id, metadata JSONB, created_at.

---

### 3.3 Tabelas de Editais

#### `editais`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | — |
| tenant_id | UUID FK | Isolamento multi-tenant |
| uploaded_by | UUID FK | Usuário que fez upload |
| file_name | TEXT | Nome original do arquivo |
| file_url | TEXT | URL S3 pré-assinada de origem |
| page_count | INT | Número de páginas |
| pdf_type | ENUM | copyable \| scanned \| mixed |
| status | ENUM | uploaded → ocr_processing → extracting → review_pending → ready \| error |
| orgao_licitante | TEXT | Órgão responsável |
| numero_edital | TEXT | Número/ano do edital |
| modalidade | TEXT | Concorrência, Pregão, etc. |
| objeto | TEXT | Objeto da licitação |
| valor_estimado | NUMERIC | Valor estimado (R$) |
| data_abertura | DATE | Data de abertura das propostas |
| uasg | TEXT | Unidade administrativa |
| regime_execucao | TEXT | Empreitada global, unitária, etc. |
| criterio_julgamento | TEXT | Menor preço, técnica e preço, etc. |
| prazo_execucao_meses | INT | Prazo de execução |
| admite_consorcio | BOOL | — |
| exige_subcontratacao | BOOL | — |
| trata_favorecido_me_epp | BOOL | Cota para ME/EPP |
| sicaf_substitui_documentos | BOOL | — |
| ai_extraction_cost_usd | NUMERIC | Custo IA para extração |
| ocr_cost_usd | NUMERIC | Custo OCR |

#### `edital_requisitos`
Requisitos genéricos extraídos (legacy). Contém:
- `categoria` ENUM (qualificacao_tecnica, qualificacao_economica, regularidade_fiscal, habilitacao_juridica, outros)
- `descricao`, `trecho_original`, `pagina_referencia`
- `quantitativo_exigido`, `unidade`
- `ai_confidence_score` (0–100)
- `status` (ai_extracted → human_approved \| human_edited \| human_rejected)
- `embedding VECTOR(1536)` + `embedding_model TEXT`

#### Tabelas de Habilitação Estruturada (11 tabelas `req_*`)

| Tabela | Conteúdo |
|--------|----------|
| `req_habilitacao_juridica` | Documentos jurídicos obrigatórios |
| `req_regularidade_fiscal` | Certidões fiscais (CND, CRF, CNDT) |
| `req_qualificacao_tecnica` | CREA/CAU, visita técnica, escritório local |
| `req_profissionais` | Equipe técnica obrigatória (cargo, conselho, qty) |
| `req_parcelas_relevancia` | **Parcelas de maior relevância** com `embedding VECTOR(768)` |
| `req_atestados_profissionais` | Atestados necessários por profissional |
| `req_qualificacao_financeira` | Índices mínimos (PL, LC, LG, SG), garantia |
| `req_declaracoes` | Declarações federais obrigatórias |
| `req_declaracoes_especiais` | Declarações por lei estadual |
| `req_alertas` | Alertas críticos / atenção / informação |
| `req_anexos_referenciados` | Anexos mencionados no edital |

> **Nota:** `req_parcelas_relevancia` é a principal tabela usada pelo crossing — contém os requisitos técnicos quantificados que serão cruzados com o acervo.

---

### 3.4 Tabelas de Acervo de CATs

#### `profissionais_tecnicos`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | — |
| tenant_id | UUID FK | — |
| nome | TEXT | Nome completo |
| numero_crea_cau | TEXT | Registro profissional |
| conselho | ENUM | CREA \| CAU |
| uf_registro | CHAR(2) | UF do conselho |
| ativo | BOOL | — |

#### `cats`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | — |
| tenant_id | UUID FK | — |
| profissional_id | UUID FK | Profissional responsável |
| uploaded_by | UUID FK | — |
| file_name / file_url / file_type | — | pdf_scanned \| pdf_copyable \| excel \| manual |
| numero_cat | TEXT | Número da CAT no CREA/CAU |
| empresa_contratante | TEXT | Quem contratou |
| tipo_obra_servico | TEXT | Categoria da obra |
| descricao_tecnica | TEXT | Descrição completa |
| quantitativo_valor | NUMERIC | Valor do contrato |
| quantitativo_unidade | TEXT | Unidade do valor |
| data_inicio / data_conclusao | DATE | Período da obra |
| status_extracao | ENUM | pending → processing → review_pending → completed |
| ai_confidence_score | INT | 0–100 |
| **embedding** | VECTOR(1536) | Gemini embedding da descrição |
| **embedding_model** | TEXT | Modelo usado (rastreamento) |
| **search_vector** | TSVECTOR GENERATED | Para FTS em português |
| ativo | BOOL | — |

#### `cat_itens`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | — |
| tenant_id / cat_id | UUID FK | — |
| numero_item | INT | Ordem no documento |
| descricao | TEXT | Descrição do serviço |
| unidade | TEXT | Sigla (M2, M3, KG, UN, ...) |
| quantidade | NUMERIC(15,4) | Quantidade executada |
| origem | ENUM | ai_extracted \| human_added \| excel_imported |
| ai_confidence_score | INT | — |
| **embedding** | VECTOR(1536) | — |
| **embedding_model** | TEXT | — |
| **search_vector** | TSVECTOR GENERATED | — |
| ordem | INT | Posição para exibição |

---

### 3.5 Tabelas de Cruzamento

#### `crossings`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | — |
| tenant_id / edital_id | UUID FK | — |
| triggered_by | UUID FK | Usuário que iniciou |
| status | ENUM | queued → processing → completed \| error |
| score_aderencia | NUMERIC | 0–100 |
| total_requisitos | INT | — |
| requisitos_atendidos | INT | — |
| requisitos_com_ressalva | INT | — |
| requisitos_gap | INT | — |
| recomendacao | ENUM | participar \| participar_com_ressalvas \| nao_participar |
| recomendacao_justificativa | TEXT | Texto gerado pela IA |
| ai_cost_usd | NUMERIC | Custo total da análise |
| processing_time_seconds | INT | Tempo de processamento |

#### `crossing_items`
Um registro por requisito × crossing.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| resultado | ENUM | atendido \| atendido_parcialmente \| gap |
| ai_justificativa | TEXT | Justificativa da IA |
| score_similaridade_max | NUMERIC | Maior score entre os candidatos |
| human_override | BOOL | Se foi alterado manualmente |
| human_override_by | UUID FK | — |
| human_override_note | TEXT | Nota do revisor |

#### `crossing_item_cats`
Candidatas avaliadas por item do crossing.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| cat_id | UUID FK | CAT candidata |
| cat_item_id | UUID FK NULL | Item específico da CAT (quando nivel_match=item) |
| nivel_match | ENUM | cat \| item |
| score_similaridade | NUMERIC(5,4) | Score cosine 0–1 |
| avaliacao_llm | ENUM | atende \| atende_parcialmente \| nao_atende |
| justificativa_llm | TEXT | — |
| rank_posicao | INT | Posição no ranking RRF |

---

### 3.6 Tabelas de Jobs e Cache

#### `processing_jobs`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| job_type | ENUM | ocr \| edital_extraction \| cat_extraction \| crossing \| embedding_gen |
| entity_type | ENUM | edital \| cat \| crossing |
| entity_id | UUID | ID da entidade processada |
| status | ENUM | queued → running → completed \| failed \| retrying |
| attempt_count | INT | Máximo 3 |
| error_message | TEXT NULL | Mensagem de erro |
| cost_usd | NUMERIC | Custo acumulado |
| started_at / completed_at | TIMESTAMP | — |

#### `pncp_cache`
Cache global (sem RLS) de contratações públicas do PNCP.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| (ano_compra, sequencial_compra, cnpj_orgao) | UNIQUE | Chave natural PNCP |
| uf / codigo_municipio_ibge | — | Localização |
| modalidade / valor_total_estimado | — | Filtros principais |
| data_publicacao_pncp / data_abertura_proposta / data_encerramento_proposta | — | Datas |
| raw_data | JSONB | Payload completo do PNCP |
| segmentos | TEXT[] | Categorias (classificação IA) |
| classificacao_confianca | ENUM | alta \| media \| baixa |
| classificacao_metodo | TEXT | keyword \| llm |

#### `pncp_sync_config`
Config de sincronização por tenant:
- `ufs TEXT[]`, `modalidades TEXT[]`, `retention_days INT`
- `is_active BOOL`, `last_synced_at`, `last_sync_status`

---

### 3.7 Índices Críticos

```sql
-- Busca semântica (pgvector HNSW)
CREATE INDEX ON cats             USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON cat_itens        USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON edital_requisitos USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON req_parcelas_relevancia USING hnsw (embedding vector_cosine_ops);

-- Full-Text Search (GIN — stemming português via unaccent)
CREATE INDEX cats_fts_idx      ON cats      USING gin (search_vector);
CREATE INDEX cat_itens_fts_idx ON cat_itens USING gin (search_vector);

-- Queries por tenant
CREATE INDEX ON edital_requisitos (tenant_id, edital_id);
CREATE INDEX ON cat_itens         (tenant_id, cat_id);
CREATE INDEX ON cats              (tenant_id, tipo_obra_servico);
CREATE INDEX ON crossings         (tenant_id, edital_id);
CREATE INDEX ON processing_jobs   (tenant_id, status);
CREATE INDEX ON audit_logs        (tenant_id, created_at);

-- PNCP
CREATE UNIQUE INDEX ON pncp_cache (ano_compra, sequencial_compra, cnpj_orgao);
```

---

## 4. API — Contratos de Interface

### 4.1 Autenticação

Todas as rotas (exceto `/health`) exigem:
```
Authorization: Bearer {session_token}
```
Token validado contra `ba_session`. Após validação, `request.tenantId`, `request.userId` e `request.userRole` ficam disponíveis.

**Formato de erro padrão:**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token inválido ou expirado",
    "details": null
  }
}
```

### 4.2 Roles e Permissões

| Role | Permissões |
|------|-----------|
| `viewer` | Leitura de todas as entidades |
| `analyst` | viewer + criar/editar editais, CATs, crossings, uploads |
| `admin` | analyst + gerenciar usuários, deletar, reprocessar, sincronizar PNCP |

---

### 4.3 Módulo — Editais

#### `GET /api/editais`
Listagem paginada.

**Query params:** `page`, `limit`, `status`  
**Resposta:** `{ data: Edital[], total, page, limit }`

---

#### `POST /api/editais/pncp/importar`
Importa edital diretamente do PNCP.

**Body:**
```json
{
  "cnpjOrgao": "string",
  "anoCompra": "number",
  "sequencialCompra": "number"
}
```
**Fluxo interno:**
1. Busca detalhes no PNCP API
2. Lista arquivos disponíveis e identifica PDF/ZIP
3. Faz download do arquivo (PNCP → S3)
4. Se ZIP, extrai PDF (magic bytes PK detection)
5. Cria registro `editais` com status `uploaded`
6. Enfileira job `edital_extraction`

**Resposta:** `201 { editalId, jobId }`

---

#### `GET /api/editais/:editalId/habilitacao`
Retorna todos os dados estruturados de habilitação (11 tabelas `req_*` unificadas).

**Resposta:**
```json
{
  "habilitacaoJuridica": [...],
  "regularidadeFiscal": [...],
  "qualificacaoTecnica": {...},
  "profissionais": [...],
  "parcelasRelevancia": [...],
  "atestadosProfissionais": [...],
  "qualificacaoFinanceira": {...},
  "declaracoes": [...],
  "declaracoesEspeciais": [...],
  "alertas": [...],
  "anexosReferenciados": [...]
}
```

---

#### `POST /api/editais/:editalId/reprocess` (admin)
Re-enfileira job de extração. Útil após correção de configurações de IA.

---

### 4.4 Módulo — CATs

#### `GET /api/cats/search`
Busca semântica + FTS nas CATs do tenant.

**Query params:** `q` (string obrigatório), `catId` (opcional — restringe a uma CAT)  
**Fluxo:**
1. Gera embedding do query via Gemini
2. Busca pgvector (cosine) em `cat_itens.embedding`
3. Busca FTS com `plainto_tsquery('portuguese', q)`
4. Mescla via RRF (K=60)
5. Retorna top resultados com score

---

#### `POST /api/cats/chat`
Chat RAG sobre o acervo completo.

**Body:**
```json
{
  "message": "string",
  "history": [{ "role": "user|assistant", "content": "string" }],
  "cacheName": "string|null"
}
```
**Fluxo:**
1. Busca semântica + FTS (RRF) para encontrar CATs relevantes
2. Monta contexto com até 10 CATs + seus itens
3. Chama Gemini com system prompt + contexto injetado
4. Tenta criar LLM cache para próximos turnos (reutiliza `cacheName`)

**Resposta:**
```json
{ "text": "string", "cacheName": "string|null", "contextCats": [...] }
```

---

#### `POST /api/cats/rebuild-embeddings` (analyst+)
Re-gera embeddings para CATs/itens com embedding NULL ou modelo desatualizado.

---

### 4.5 Módulo — Cruzamentos

#### `POST /api/crossings`
Dispara novo crossing.

**Body:** `{ "editalId": "uuid" }`  
**Resposta:** `202 { crossingId, status: "queued" }`

---

#### `GET /api/crossings/:crossingId/stream`
SSE (Server-Sent Events) para acompanhar processamento em tempo real.

**Protocolo:**
- Eventos: `{ type: "progress", data: { currentStep, totalSteps, message } }`
- Eventos: `{ type: "completed", data: CrossingSummary }`
- Eventos: `{ type: "error", data: { message } }`
- Heartbeat a cada 20s para manter conexão viva
- Sem buffering no Traefik (roteador SSE dedicado)

---

#### `PATCH /api/crossings/:crossingId/items/:itemId/override` (analyst+)
Sobrescreve manualmente o resultado de um item.

**Body:**
```json
{
  "resultado": "atendido|atendido_parcialmente|gap",
  "note": "string"
}
```
Recalcula automaticamente `score_aderencia` e contadores do crossing.

---

#### `GET /api/crossings/:crossingId/export/csv`
Gera CSV completo do relatório de crossing:
- Header: metadata do edital + score + recomendação
- Linhas: um requisito por linha com resultado + justificativa + CATs que cobrem

---

### 4.6 Módulo — PNCP Cache

#### `GET /api/pncp-cache/search`
Busca em contratações públicas cacheadas.

**Query params:** `uf`, `modalidade`, `dataInicio`, `dataFim`, `valorMin`, `valorMax`, `q`  
**Resposta:** `{ data: PncpContratacao[], total }`

---

#### `POST /api/pncp-cache/sync` (admin)
Dispara sincronização manual do PNCP para o tenant.

---

### 4.7 Módulo — Uploads

#### `POST /api/uploads`
Upload de arquivo para S3.

- Multipart form-data
- Validações: MIME type, tamanho máximo 50MB, extensões `.pdf`, `.xlsx`, `.xls`
- Retorna: `{ fileUrl }` — URL S3 de origem (não pré-assinada para uso interno)

---

## 5. Pipeline de Processamento

### 5.1 Pipeline de Edital

```
1. UPLOAD
   └── Usuário envia PDF ou importa do PNCP
   └── Arquivo salvo no S3
   └── `editais.status` = uploaded
   └── Job `edital_extraction` enfileirado

2. EXTRAÇÃO (Worker)
   ├── Se pdf_type = scanned → OCR (Google Document AI)
   │   └── `editais.status` = ocr_processing
   └── LLM call (Gemini com PDF nativo ou texto OCR)
       └── `editais.status` = extracting
       
3. ESTRUTURAÇÃO
   ├── Parse do output XML/JSON do LLM
   ├── Validação Zod (schema rigoroso)
   ├── Insert em `editais` (metadados gerais)
   ├── Insert em 11 tabelas `req_*` (habilitação estruturada)
   └── `editais.status` = review_pending

4. EMBEDDING (assíncrono)
   ├── Job `embedding_gen` para cada `req_parcela_relevancia`
   └── Gemini Embedding 2 Preview (1536D para editais)

5. APROVAÇÃO
   └── Revisor humano: `editais.status` = ready (libera para crossing)
```

---

### 5.2 Pipeline de CAT

```
1. UPLOAD
   └── Usuário envia PDF/Excel
   └── Arquivo salvo no S3
   └── `cats.status_extracao` = pending
   └── Job `cat_extraction` enfileirado

2. EXTRAÇÃO (Worker)
   ├── Se pdf_scanned → chunk em 3 páginas → OCR (Google Document AI)
   └── Extração por LLM por chunk
       └── `cats.status_extracao` = processing

3. ESTRUTURAÇÃO
   ├── Parse XML do LLM
   ├── Validação Zod
   ├── Insert em `cats` (metadados + descricao_tecnica)
   ├── Insert em `cat_itens` (itens com quantidade explícita)
   └── `cats.status_extracao` = review_pending

4. EMBEDDING (assíncrono)
   ├── `cats.embedding` ← Gemini embed de `descricao_tecnica`
   ├── `cat_itens.embedding` ← Gemini embed de `descricao`
   ├── `cats.search_vector` ← GENERATED TSVECTOR (automático)
   └── `cat_itens.search_vector` ← GENERATED TSVECTOR (automático)

5. REVISÃO
   └── Analista valida/corrige itens extraídos
   └── `cats.status_extracao` = completed
```

---

### 5.3 Pipeline de Crossing (Motor de Análise)

Este é o pipeline mais complexo do sistema.

```
1. TRIGGER
   └── POST /api/crossings → cria crossing (status=queued) → enfileira job

2. BUSCA DE REQUISITOS
   └── Carrega req_parcelas_relevancia do edital (com embeddings)
   └── Se disponível: usa Gemini LLM cache para contexto do edital

3. POR CADA REQUISITO (paralelo com controle de concorrência)
   │
   ├── 3a. BUSCA SEMÂNTICA (pgvector)
   │    └── cosine similarity em cats.embedding + cat_itens.embedding
   │    └── Filtra por embedding_model = CURRENT_MODEL (evita mistura)
   │    └── Top 30 candidatos
   │
   ├── 3b. BUSCA FTS (PostgreSQL)
   │    └── plainto_tsquery('portuguese', descricao_requisito)
   │    └── @@ operator em search_vector (GIN index)
   │    └── Top 30 candidatos
   │
   ├── 3c. RRF MERGE (Reciprocal Rank Fusion, K=60)
   │    └── score_rrf = Σ(1 / (K + rank_i))
   │    └── Top 18 candidatos unificados
   │
   ├── 3d. PRÉ-PROCESSAMENTO
   │    └── Strip de prefixos implícitos ("Execução de", "Serviço de")
   │    └── Normalização de unidades (km→M, ha→M², ton→KG)
   │    └── Equivalências técnicas (ETE = Estação de Tratamento)
   │
   ├── 3e. AVALIAÇÃO LLM (Gemini)
   │    └── Prompt: requisito + top 18 candidatos
   │    └── Output XML: avaliação por candidato (atende|atende_parcialmente|nao_atende)
   │    └── Regra de especificidade:
   │         • Edital genérico ← CAT específica → ATENDE
   │         • Edital específico ← CAT diferente → NÃO ATENDE
   │
   └── 3f. INSERT RESULTADOS
        └── crossing_items (resultado consolidado por requisito)
        └── crossing_item_cats (match por CAT/item candidato)

4. CÁLCULO FINAL
   ├── score_aderencia = ((atendidos + parciais*0.5) / total) * 100
   └── recomendacao:
        • >= 70 → participar
        • >= 40 → participar_com_ressalvas
        • < 40  → nao_participar

5. PUBLICAÇÃO
   ├── crossing.status = completed
   └── Pub/Sub Redis → SSE frontend (atualizações em tempo real)
```

---

### 5.4 Pipeline PNCP

```
1. SYNC (agendado ou manual)
   ├── Para cada (UF × modalidade) configurado pelo tenant
   ├── Chama PNCP API com paginação (50/página, máx 200 páginas)
   └── Upsert em pncp_cache (natural key)

2. CLASSIFY (job após sync)
   ├── Estratégia 1: keyword matching (rápido, confidence=baixa)
   └── Estratégia 2: LLM Gemini (se keywords insuficientes, confidence=alta)

3. PURGE (job periódico)
   └── Delete registros mais antigos que retention_days por tenant
```

---

## 6. Motor de Inteligência Artificial

### 6.1 Modelos Utilizados

| Uso | Modelo | Endpoint |
|-----|--------|----------|
| Extração de editais | `gemini-3-flash-preview` | v1beta |
| Extração de CATs | `gemini-3-flash-preview` | v1beta |
| Crossing (avaliação) | `gemini-3-flash-preview` | v1beta |
| Chat RAG | `gemini-3-flash-preview` | v1beta |
| Classificação PNCP | `gemini-3-flash-preview` | v1beta |
| Embeddings | `gemini-embedding-2-preview` | v1beta |
| OCR | Google Document AI | — |

### 6.2 Dimensões de Embedding

| Entidade | Dimensões | Modelo |
|----------|-----------|--------|
| `cats.embedding` | 1536 | gemini-embedding-2-preview |
| `cat_itens.embedding` | 1536 | gemini-embedding-2-preview |
| `edital_requisitos.embedding` | 1536 | gemini-embedding-2-preview |
| `req_parcelas_relevancia.embedding` | 768 | gemini-embedding-2-preview |

> A coluna `embedding_model` rastrea qual modelo gerou cada embedding. Queries de busca filtram por `embedding_model = CURRENT_EMBEDDING_MODEL` para evitar mistura de modelos.

### 6.3 Prompts do Sistema

#### Extração de Editais (`packages/ai/src/prompts/edital-extraction.ts`)
- Especialista em licitações e habilitação de engenharia
- Extrai JSON com metadados do edital + 11 categorias de habilitação
- Regra principal: **COMPLETUDE** — nenhum requisito pode ser omitido
- Parcelas de relevância são críticas para o crossing
- Input: PDF nativo (visão multimodal) ou texto OCR

#### Extração de CATs (`packages/ai/src/prompts/cat-extraction.ts`)
- Especialista em CATs CREA/CAU
- Extrai apenas itens com **quantidade numérica explícita**
- Ignora: títulos de seção, selos/carimbos sobrepostos
- Unidades: apenas siglas padronizadas (M2, M3, KG, UN, KM, HA...)
- Output: XML estruturado

#### Avaliação de Crossing (`packages/ai/src/prompts/crossing.ts`)
**Regra de especificidade** (mais importante):
- Edital genérico ← CAT específica = ATENDE (CAT supera o mínimo)
- Edital específico ← CAT diferente = NÃO ATENDE (CAT não cobre)
- Foco no NÚCLEO do serviço, ignore detalhes extras na CAT
- Prefixos implícitos: "Execução de", "Serviço de" são implícitos
- Equivalências técnicas: ETE = Estação de Tratamento de Esgoto

#### Chat RAG (`packages/ai/src/prompts/cat-chat.ts`)
- Contexto: lista de até 10 CATs relevantes encontradas por busca
- Responde perguntas sobre o acervo técnico do tenant
- Suporta múltiplos turnos com histórico

### 6.4 Context Caching

O Gemini suporta caching de contexto para reduzir custos em multi-turn:
- `createLlmCache(contents, ttl)` — cria cache no Gemini
- `callLlmWithCache(cacheName, prompt)` — usa cache existente
- Requisito mínimo: ~32K tokens para ser efetivo
- Usado no crossing (cache do contexto do edital) e no chat RAG

### 6.5 Rastreamento de Custos

Todo job de IA registra:
1. Tokens de input/output consumidos
2. Custo estimado em USD (baseado nas tarifas do Gemini)
3. Persistido em `processing_jobs.cost_usd`
4. Acumulado em `crossings.ai_cost_usd`, `editais.ai_extraction_cost_usd`

---

## 7. Frontend — Fluxos de Usuário

### 7.1 Layout e Navegação

Layout autenticado com sidebar lateral contendo:
- Dashboard (KPIs)
- Editais (upload, busca PNCP, listagem)
- CATs (profissionais, upload, listagem, chat)
- Cruzamentos (análise, histórico)
- Configurações (usuários, monitoramento PNCP)

### 7.2 Fluxo: Importar Edital do PNCP

```
1. Acessar /editais/buscar-pncp
2. Filtrar por UF, modalidade, período
3. Selecionar edital na lista de resultados
4. Clicar em "Importar" → POST /api/editais/pncp/importar
5. Aguardar processamento (polling de status)
6. Quando status = review_pending → revisar habilitação extraída
7. Aprovar → status = ready → edital disponível para crossing
```

### 7.3 Fluxo: Upload de CAT

```
1. Acessar /cats/upload
2. Selecionar profissional (CREA/CAU)
3. Fazer upload do PDF ou Excel
4. Aguardar extração automática (polling)
5. Revisar itens extraídos (corrigir se necessário)
6. Ativar CAT → disponível para crossing
```

### 7.4 Fluxo: Executar Crossing

```
1. Acessar /cruzamentos
2. Selecionar edital com status = ready
3. Clicar em "Analisar" → POST /api/crossings
4. Página redireciona para /cruzamentos/:id
5. SSE stream atualiza painel em tempo real
   - Progresso: "Analisando requisito 3 de 15..."
   - Cada requisito aparece com resultado imediatamente
6. Análise concluída:
   - Score de aderência (0–100)
   - Recomendação (participar | ressalvas | não participar)
   - Justificativa da IA
   - Tabela: requisito × CATs que cobrem × resultado
7. Opcional: override manual de resultados
8. Exportar relatório CSV
```

### 7.5 Fluxo: Chat RAG com IA

```
1. Acessar /cats (ou /cats/:id)
2. Abrir drawer de chat (ícone de chat)
3. Fazer perguntas sobre o acervo:
   - "Temos CATs de pavimentação acima de 10km?"
   - "Quais profissionais têm experiência em saneamento?"
4. IA busca no acervo (semântico + FTS) e responde
5. Contexto mantido entre turnos (Gemini cache)
```

### 7.6 Configurações — Monitoramento PNCP

```
/configuracoes/monitoramento-pncp
├── Configurar UFs de interesse
├── Configurar modalidades monitoradas
├── Definir retenção de dados (dias)
├── Ativar/desativar sincronização automática
└── Histórico de sincronizações (status, registros sincronizados)
```

---

## 8. Autenticação e Multi-tenancy

### 8.1 Better Auth

**Tabelas:**
- `ba_user` — perfil de autenticação
- `ba_session` — tokens de sessão com expiração
- `ba_account` — provedores de identidade (email, OAuth)
- `ba_verification` — codes de verificação/MFA

**Fluxo de login:**
1. Frontend chama `/api/auth/*` (Better Auth handler)
2. Better Auth valida credenciais e cria `ba_session`
3. Token retornado ao frontend (cookie ou localStorage)
4. Cada request subsequente inclui `Authorization: Bearer {token}`

**Middleware da API:**
```
requireAuth:
1. Extrai token do header Authorization
2. Consulta ba_session (valida token + expiração)
3. Busca user via auth_provider_id ou email (fallback para convites)
4. Verifica user.active
5. Injeta tenantId, userId, userRole no request
```

### 8.2 Multi-tenancy

**Isolamento por application layer:**
- Toda query ao banco recebe `WHERE tenant_id = request.tenantId` explicitamente
- Drizzle ORM garante tipagem — sem SQL raw nos módulos de negócio
- RLS PostgreSQL como camada secundária (configurada mas não dependente)

**Fluxo de convite:**
1. Admin cria usuário → `users.auth_provider_id = NULL` (pendente)
2. Email de convite enviado
3. Usuário cria conta no Better Auth
4. Middleware vincula via email fallback → preenche `auth_provider_id`

### 8.3 Planos e Quotas

| Plano | Editais/mês | CATs armazenadas |
|-------|------------|-----------------|
| Starter | — | — |
| Professional | — | — |
| Enterprise | Ilimitado | Ilimitado |

> Valores específicos definidos em `tenants.max_editais_per_month` e `tenants.max_cats_stored`.

---

## 9. Infraestrutura e Deploy

### 9.1 Desenvolvimento Local

```bash
# Pré-requisitos: Docker, Node >= 20, pnpm >= 9

# 1. Subir serviços
docker-compose up -d  # PostgreSQL 16 + Redis 7 + MinIO

# 2. Instalar dependências
pnpm install

# 3. Configurar .env.local (ver seção 9.3)

# 4. Rodar migrations
pnpm db:migrate

# 5. Iniciar dev servers
pnpm dev  # api (3001) + web (3000) em paralelo via Turborepo
```

### 9.2 Produção — Docker Swarm

**Serviços:**

| Serviço | Imagem | Réplicas |
|---------|--------|---------|
| `licitacat_web` | apps/web/Dockerfile | 1+ |
| `licitacat_api` | apps/api/Dockerfile | 1+ |
| `licitacat_worker` | apps/api/Dockerfile (entrypoint diferente) | 1+ |
| `postgres` | postgres:16-alpine | 1 (manager) |
| `redis` | redis:7-alpine | 1 |
| `minio` | minio/minio | 1 |
| `traefik` | traefik:v3 | 1 |

**Deploy:**
```bash
# Build
docker build -f apps/api/Dockerfile -t licitacat-api:latest .
docker build -f apps/web/Dockerfile -t licitacat-web:latest .

# Update (rolling restart)
docker service update --force licitacat_worker
docker service update --force licitacat_api
docker service update --force licitacat_web
```

**Traefik — Configurações especiais:**
- HTTPS automático com Let's Encrypt
- Middleware de buffering 50MB para `/api/uploads`
- Roteadores SSE **sem buffering** para:
  - `/api/crossings/*/stream` (SSE real-time)
  - `/api/cats/chat` (resposta streaming)

### 9.3 Variáveis de Ambiente

```bash
# Banco
DATABASE_URL=postgresql://licitacat:senha@postgres:5432/licitacat

# Redis
REDIS_URL=redis://redis:6379

# Storage (MinIO local ou AWS S3)
S3_BUCKET=licitacat
S3_REGION=us-east-1
S3_ENDPOINT=http://minio:9000     # Omitir em produção AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Autenticação
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=https://app.licitacat.com.br

# IA (Google)
GEMINI_API_KEY=
GOOGLE_DOCUMENT_AI_PROJECT_ID=
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=
GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/gcp_credentials

# App
NEXT_PUBLIC_API_URL=https://app.licitacat.com.br/api
API_PORT=3001
```

---

## 10. Segurança

### 10.1 Regras Inegociáveis

1. **Isolamento de tenant:** `tenant_id` jamais exposto de outro tenant. Toda query filtra por `request.tenantId`.
2. **URLs de S3 pré-assinadas:** expiram em 15 minutos. Sem URLs públicas permanentes.
3. **Validação de uploads:**
   - Tipo MIME verificado (não apenas extensão)
   - Tamanho máximo: 50MB por arquivo
   - Extensões permitidas: `.pdf`, `.xlsx`, `.xls`
4. **Variáveis sensíveis:** exclusivamente em `.env.local` (dev) ou Docker Secrets (prod)
5. **TypeScript strict:** sem `any` — reduz vetores de injection

### 10.2 Autenticação de API

- Tokens de sessão com expiração (Better Auth)
- `user.active` verificado em todo request
- Rate limiting por IP via `@fastify/rate-limit`

### 10.3 Arquitetura de Defesa em Profundidade

```
Internet → Traefik (TLS, rate limit header)
         → Fastify (requireAuth + requireRole)
         → Application layer (tenant_id filter)
         → PostgreSQL (RLS como camada secundária)
```

---

## 11. Monitoramento e Custos de IA

### 11.1 Rastreamento por Job

Cada `processing_job` rastreia:
- Tipo de operação e entidade processada
- Tempo de execução (started_at → completed_at)
- Número de tentativas (attempt_count)
- Custo estimado em USD (cost_usd)
- Mensagem de erro detalhada (se failed)

### 11.2 Retry Logic

- Tentativas automáticas: máximo 3 (attempt_count)
- Status: `queued → running → retrying → failed`
- Erros transientes (network, rate limit) retentados com backoff
- Erros permanentes (parsing inválido): falham após 3 tentativas

### 11.3 Auditoria

`audit_logs` registra todas as ações relevantes:
- Upload de arquivo
- Aprovação de edital
- Override de resultado
- Alteração de usuário
- Criação de crossing

---

## 12. Estado de Implementação

### 12.1 Status dos Módulos

| Módulo | Descrição | Status |
|--------|-----------|--------|
| **M0** | Infraestrutura base (monorepo, DB, auth, multi-tenancy) | ✅ Concluído |
| **M1** | Upload + pipeline de editais (OCR + extração estruturada) | ✅ Concluído |
| **M2** | Acervo de CATs (upload PDF/Excel, extração, cat_itens) | ✅ Concluído |
| **M3** | Motor de cruzamento semântico + chat RAG | ✅ Concluído |
| **M4** | Dashboard + exportação de relatórios | ✅ Concluído |
| **M5** | Cache PNCP + monitoramento | ✅ Concluído |
| **M6** | Gestão de usuários, planos e auditoria | 🔄 Parcial |

### 12.2 Decisões de Arquitetura Consolidadas

| Decisão | Motivo |
|---------|--------|
| pgvector no PostgreSQL (não Pinecone) | Simplifica infraestrutura no MVP |
| Drizzle ORM (não Prisma) | Melhor suporte a pgvector e tipos customizados |
| BullMQ + Redis (não SQS) | Sem dependência de AWS para dev local |
| Better Auth (não Clerk/NextAuth) | Controle completo + suporte multi-tenant |
| Gemini para LLM + Embeddings | Custo-benefício + suporte a PDF nativo |
| Busca híbrida V2: pgvector + FTS + RRF | Melhor recall que só semântico ou só keyword |
| Tracking de modelo de embedding | Evita mistura de modelos incompatíveis |
| Normalização de unidades no crossing | Comparação correta (km→M, ha→M², ton→KG) |
| Matching em dois níveis (cat + cat_item) | Cobertura máxima: CAT completa OU item específico |

### 12.3 Pendências Conhecidas

| Item | Prioridade |
|------|-----------|
| RLS PostgreSQL nativo (atualmente só application layer) | Alta |
| Rate limiting por tenant (atualmente só por IP) | Média |
| Testes unitários com cobertura adequada | Alta |
| Backup automático configurado | Alta |
| Compressão de PDFs antigos no S3 | Baixa |
| Notificações (email/webhook) ao fim do crossing | Média |
| Painel de custos de IA por tenant | Média |
