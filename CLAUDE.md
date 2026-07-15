# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é este projeto

**LicitaCAT** é uma plataforma SaaS multi-tenant que usa IA para:
1. Extrair requisitos de qualificação técnica de editais de licitação (PDFs grandes, 100+ páginas)
2. Armazenar e estruturar o acervo de CATs (Certidões de Acervo Técnico) de empresas de engenharia
3. Cruzar semanticamente os requisitos dos editais com as CATs e gerar um score de aderência + recomendação de participação
4. Monitorar novas licitações via integração com o PNCP (Portal Nacional de Compras Públicas)

**Usuários-alvo:** empresas de engenharia brasileiras que participam de licitações públicas.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend API | Node.js + Fastify + TypeScript |
| Banco de dados | PostgreSQL 16 + extensão pgvector |
| ORM | Drizzle ORM |
| Fila de jobs | BullMQ (Redis) |
| Storage | AWS S3 / MinIO (dev local) |
| OCR | Google Document AI |
| LLM | Google Gemini (`gemini-3-flash-preview`) |
| Embeddings | Google Gemini (`gemini-embedding-2-preview`, 768D, endpoint `v1beta`) |
| Autenticação | Better Auth (email+senha, sessões via `ba_session`/`ba_user`) |
| E-mail | Resend (reset de senha) |
| Monorepo | Turborepo + pnpm |
| Testes | Vitest (unit) + Playwright (e2e) |
| Deploy | Docker Swarm (produção) + Docker Compose (dev) |

---

## Comandos

```bash
# Desenvolvimento
docker-compose up -d          # PostgreSQL + Redis + MinIO
pnpm dev                      # api + web em paralelo (Turborepo)

# Banco de dados
pnpm db:migrate               # migrations pendentes (Drizzle)
pnpm db:generate              # gerar migration a partir de mudanças no schema
pnpm db:studio                # Drizzle Studio
pnpm db:seed                  # seed de dados de teste

# Qualidade
pnpm lint
pnpm typecheck
pnpm test                     # Vitest (todos os packages)
pnpm test:e2e                 # Playwright
pnpm build

# Deploy (Docker Swarm)
docker build -f apps/api/Dockerfile -t licitacat-api:latest .
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=... \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=... \
  -t licitacat-web:latest .
docker service update --force licitacat_worker
docker service update --image licitacat-api:latest licitacat_api
docker service update --image licitacat-web:latest licitacat_web

# Re-embedding após troca de modelo
docker cp direct-reembed.mjs <worker_container>:/app/direct-reembed.mjs
docker exec <worker_container> node /app/direct-reembed.mjs
```

Rodar um único teste: `pnpm --filter <package> test -- --run <test-file-pattern>`

---

## Estrutura do monorepo

```
apps/
  api/          # Fastify backend + worker entry point
  web/          # Next.js frontend
packages/
  db/           # Schema Drizzle + migrations SQL + seed
  ai/           # Wrappers Gemini LLM, OCR, embeddings, S3
  auth/         # Better Auth config (email+senha, Resend, Drizzle adapter)
  queue/        # Definições de filas BullMQ + processors + scheduler
  shared/       # Tipos TypeScript + schemas Zod compartilhados
```

### API — módulos Fastify (`apps/api/src/modules/`)

Cada módulo tem `routes.ts` + `service.ts` + `schema.ts` (Zod) + `repository.ts` (Drizzle):

| Módulo | Prefixo |
|--------|---------|
| `editais` | `/api/editais` |
| `cats` | `/api/cats` |
| `crossings` | `/api/crossings` |
| `uploads` | `/api/uploads` |
| `dashboard` | `/api/dashboard` |
| `users` | `/api/users` |
| `pncp-cache` | `/api/pncp-cache` |

### Frontend — rotas Next.js (`apps/web/src/app/`)

- `(auth)/` — sign-in, sign-up, forgot-password, reset-password
- `(dashboard)/editais/` — listagem, upload, upload em lote, buscar-pncp, `[id]`
- `(dashboard)/cats/` — listagem, upload, upload em lote, profissionais, `[id]`
- `(dashboard)/cruzamentos/` — listagem, `[id]`
- `(dashboard)/dashboard/`
- `(dashboard)/configuracoes/` — usuários, monitoramento-pncp

---

## Autenticação

**Better Auth** substituiu o Clerk. A sessão é validada via Bearer token no header `Authorization`.

- `packages/auth/src/index.ts` — instância `auth` com Drizzle adapter (tabelas `ba_user`, `ba_session`, `ba_account`, `ba_verification`)
- `apps/api/src/middleware/auth.ts` — `requireAuth` busca a sessão em `ba_session`, faz auto-link por email se necessário, e popula `request.tenantId`, `request.userId`, `request.userRole`
- `apps/web/src/lib/auth-client.ts` — `createAuthClient` do `better-auth/react` com `useSession`, `signIn`, `signOut`, `signUp`
- Frontend usa `NEXT_PUBLIC_BETTER_AUTH_URL` para apontar ao Next.js (que proxy para Better Auth via `/api/auth/[...all]`)
- Envio de reset de senha via Resend (variáveis `RESEND_API_KEY`, `RESEND_FROM_EMAIL`)

---

## Modelo de dados

> Multi-tenant com RLS no PostgreSQL. Toda query **deve** passar `tenant_id` explicitamente.

### Tabelas de negócio principais

- **`tenants`** — empresas-cliente
- **`users`** — `role: admin|analyst|viewer`, `auth_provider_id` aponta para `ba_user.id`
- **`editais`** — status: `uploaded → ocr_processing → extracting → review_pending → ready | error`
- **`edital_requisitos`** — requisitos extraídos por IA; `embedding VECTOR(768)`, `embedding_model text`; status: `ai_extracted | human_approved | human_edited | human_rejected`
- **`cats`** — acervo de CATs; `embedding VECTOR(768)`, `search_vector tsvector GENERATED`
- **`cat_itens`** — itens de cada CAT; `embedding VECTOR(768)`, `search_vector tsvector GENERATED`
- **`crossings`** — resultado do cruzamento semântico; `score_aderencia 0-100`, `recomendacao: participar | participar_com_ressalvas | nao_participar`
- **`crossing_items`** — por requisito; `resultado: atendido | atendido_parcialmente | gap`
- **`crossing_item_cats`** — CATs/itens candidatos; `nivel_match: cat | item`, `score_similaridade NUMERIC(5,4)`
- **`processing_jobs`** — rastreamento de jobs; `status: queued | running | completed | failed | retrying`

### Tabelas de habilitação do edital (`edital-habilitacao.ts`)

Extraídas pelo LLM junto com `edital_requisitos`:
- `req_habilitacao_juridica`, `req_regularidade_fiscal`, `req_parcelas_relevancia` (com `embedding VECTOR(768)`), `req_atestados_profissionais`, `req_qualificacao_financeira`

### Tabelas PNCP (`pncp-cache.ts`)

- **`pncp_cache`** — licitações públicas sincronizadas do PNCP; global (sem RLS por tenant); `enrich_status: pending | done | error`
- **`pncp_sync_config`** — configuração de monitoramento por tenant (UF, município, modalidade, palavras-chave)

### Tabelas Better Auth (`auth.ts`)

`ba_user`, `ba_session`, `ba_account`, `ba_verification` — gerenciadas pelo Better Auth, não editar manualmente.

### Índices críticos

```sql
-- pgvector HNSW (768D, cosine)
CREATE INDEX ON edital_requisitos USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON cats              USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON cat_itens         USING hnsw (embedding vector_cosine_ops);
-- FTS português
CREATE INDEX cats_fts_idx      ON cats      USING gin (search_vector);
CREATE INDEX cat_itens_fts_idx ON cat_itens USING gin (search_vector);
```

---

## Pipeline de processamento (BullMQ)

Workers em `packages/queue/src/processors/`. Cada job deve: (1) atualizar `processing_jobs.status = 'running'`; (2) registrar custo IA em `processing_jobs.cost_usd`; (3) suportar retry até `attempt_count = 3`.

| Fila | Trigger | Descrição |
|------|---------|-----------|
| `edital_extraction` | upload de edital | OCR → extração de requisitos + habilitação via LLM |
| `cat_extraction` | upload de CAT | OCR / Document AI → extração de itens via LLM |
| `crossing` | manual/API | Busca híbrida RRF + avaliação LLM por requisito |
| `embedding_gen` | pós-extração | Gera embeddings Gemini para requisitos/CATs/itens |
| `reembed_batch` | manual | Re-embedding em lote após troca de modelo |
| `pncp_sync` | schedule (4h) | Sincroniza licitações do PNCP por tenant |
| `pncp_enrich` | schedule (15m) | Preenche `dataEncerramentoProposta` |
| `pncp_classify` | schedule (20m) | Classifica licitações por segmento de engenharia |
| `pncp_purge` | schedule (02:00) | Remove licitações expiradas do cache |

Schedules registrados em `packages/queue/src/scheduler.ts` ao iniciar o worker.

---

## IA / LLM

- `packages/ai/src/llm/client.ts` — `callLlm`, `callLlmWithCache`, `createLlmCache`, `streamLlm` (todos via Gemini)
- `packages/ai/src/llm/anthropic-client.ts` — wrapper alternativo para extração de edital via PDF inline (usa `callLlm` internamente, nome legacy)
- `packages/ai/src/embeddings/client.ts` — `generateEmbedding`, constante `CURRENT_EMBEDDING_MODEL`
- `packages/ai/src/ocr/document-ai.ts` — Google Document AI Form Parser para PDFs escaneados
- `packages/ai/src/prompts/` — um arquivo `.ts` por prompt; nunca colocar prompts inline no código
- Respostas estruturadas do LLM usam **XML tags** de output; parser em `packages/ai/src/llm/xml-parser.ts`
- Context caching via `createLlmCache`/`callLlmWithCache` — requer mínimo ~32K tokens no Gemini
- Todo `callLlm` deve logar tokens e persistir custo em `processing_jobs.cost_usd`

### Motor de cruzamento semântico

`packages/queue/src/processors/crossing.ts` — busca híbrida em dois níveis:
1. **pgvector** (cosine, threshold 0.35) → top-30 candidatos semânticos
2. **FTS** (`plainto_tsquery('portuguese', ...)`) → top-30 candidatos por keyword
3. **RRF** (k=60) → mescla e re-ranqueia, envia top-18 ao LLM
4. Match em dois níveis: `cats.descricao_tecnica` (nivel_match = `cat`) e `cat_itens.descricao` (nivel_match = `item`)
5. Normalização de unidades antes de comparar quantitativos (tabela `UNIT_CONVERSIONS` no mesmo arquivo)

---

## Convenções de código

- **TypeScript strict** — sem `any` explícito
- **Drizzle ORM** para todas as queries; SQL raw apenas para operações pgvector e migrations
- **Zod** para validação em todas as rotas e jobs
- Nomenclatura: `camelCase` no código, `snake_case` no banco
- Erro de API: `{ error: { code: string, message: string, details?: unknown } }`
- Server Components por padrão no Next.js; Client Components apenas onde necessário
- Busca de dados via Server Actions ou Route Handlers (não `useEffect`)
- `ApiClient` em `apps/web/src/lib/api.ts` — instanciado via hook `useApiClient` com token Better Auth
- Queries de busca semântica filtram por `embedding_model = CURRENT_EMBEDDING_MODEL` para evitar mistura de modelos

---

## Variáveis de ambiente

```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
S3_BUCKET=            S3_REGION=           AWS_ACCESS_KEY_ID=    AWS_SECRET_ACCESS_KEY=
GEMINI_API_KEY=                          # LLM + Embeddings
GOOGLE_DOCUMENT_AI_PROJECT_ID=
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=
GOOGLE_APPLICATION_CREDENTIALS=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=https://licitacat.domain  # URL do Next.js (não da API)
NEXT_PUBLIC_BETTER_AUTH_URL=https://...
RESEND_API_KEY=                          # reset de senha
RESEND_FROM_EMAIL=
NEXT_PUBLIC_API_URL=http://localhost:3001
API_PORT=3001
```

---

## Segurança de segredos

> **Nunca** versionar chaves/segredos. Em produção, injetar via Docker secrets / variáveis externas (`docker-stack.yml` usa só `${VAR}`, carregadas de `/root/licitacat.secrets.env`). Em dev, usar `.env` (ignorado) e `secrets.env.example` como template.

- **Não** colocar valores reais em `docker-stack.yml`, Dockerfiles (`ARG`/`ENV` default), seed, README ou qualquer arquivo versionado — apenas `${VAR}` ou placeholders.
- Segredos ficam só em: `.env`, `*.secrets.env` (ambos no `.gitignore`) ou Docker secrets.
- **Hook de pré-commit** em `.githooks/pre-commit` bloqueia segredos antes do commit. Ative uma vez por clone:
  ```bash
  git config core.hooksPath .githooks
  ```
  Usa `gitleaks` se instalado; caso contrário, aplica varredura por padrões (Google `AIza…`, GitHub `ghp_…`, AWS `AKIA…`, PEM keys, etc.).
- Auditar todo o histórico: `gitleaks detect --source . --log-opts="--all"` (ou `git log --all -S '<valor>'`).
- Se um segredo vazar: **primeiro revogar/rotacionar** a chave no provedor (purgar o histórico não desfaz a exposição), depois reescrever o histórico com `git filter-repo --replace-text` + `git push --force`.

---

## Status dos módulos

| Módulo | Descrição | Status |
|--------|-----------|--------|
| M0 | Infraestrutura base (monorepo, DB, auth, multi-tenancy) | ✅ Concluído |
| M1 | Upload + pipeline de editais (OCR + extração de requisitos) | 🔄 Em andamento |
| M2 | Acervo de CATs (upload PDF/Excel, extração, cat_itens) | 🔄 Em andamento |
| M3 | Motor de cruzamento semântico | 🔄 Em andamento |
| M4 | Dashboard + exportação de relatórios | ✅ Concluído |
| M5 | Gestão de usuários, planos e auditoria | 🔲 Pendente |

---

## Decisões de arquitetura — não reverter sem discussão

1. **pgvector no PostgreSQL** para embeddings (não Pinecone/Weaviate)
2. **Drizzle ORM** (não Prisma — melhor suporte a pgvector e tipos customizados)
3. **BullMQ** para fila (não SQS — sem dependência AWS em dev)
4. **Better Auth** para auth (substituiu Clerk; sessões próprias no PostgreSQL)
5. **Google Gemini** — `gemini-3-flash-preview` (LLM) + `gemini-embedding-2-preview` 768D endpoint `v1beta`
6. **Matching em dois níveis**: `cats.descricao_tecnica` (cat) E `cat_itens.descricao` (item) — registrar `nivel_match` em `crossing_item_cats`
7. **Revisão humana obrigatória** para `ai_confidence_score < 70` antes de liberar cruzamento
8. **Busca híbrida V2**: pgvector + FTS mesclados via RRF (não regex `~*`)
9. **Tracking de modelo**: coluna `embedding_model` em todas as tabelas com embedding — filtrar por `CURRENT_EMBEDDING_MODEL` nas queries
10. **Normalização de unidades**: km→M, ha→M², ton→KG antes de comparar quantitativos
