# LicitaCAT — Guia do Projeto para Claude Code
Este arquivo é lido automaticamente pelo Claude Code em toda sessão.
**Nunca delete ou mova este arquivo da raiz do repositório.**
---
## 1. O que é este projeto
**LicitaCAT** é uma plataforma SaaS multi-tenant que usa IA para:
1. Extrair requisitos de qualificação técnica de editais de licitação (PDFs grandes, 100+ páginas)
2. Armazenar e estruturar o acervo de CATs (Certidões de Acervo Técnico) de empresas de engenharia
3. Cruzar semanticamente os requisitos dos editais com as CATs e gerar um score de aderência + recomendação de participação
**Usuários-alvo:** empresas de engenharia brasileiras que participam de licitações públicas.
---
## 2. Stack tecnológico
| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend API | Node.js + Fastify + TypeScript |
| Banco de dados | PostgreSQL 16 + extensão pgvector |
| ORM | Drizzle ORM |
| Fila de jobs | BullMQ (Redis) |
| Storage de arquivos | AWS S3 (ou compatível: MinIO para dev local) |
| OCR | Google Document AI |
| LLM principal | Anthropic Claude API (`claude-sonnet-4-6`) |
| Embeddings | Voyage AI (`voyage-large-2`) |
| Autenticação | Clerk |
| Monorepo | Turborepo |
| Testes | Vitest (unit) + Playwright (e2e) |
| CI/CD | GitHub Actions |
| Containerização | Docker + Docker Compose (dev) |
---
## 3. Estrutura do monorepo
```
licitacat/
├── apps/
│   ├── web/              # Next.js frontend
│   └── api/              # Fastify backend
├── packages/
│   ├── db/               # Schema Drizzle + migrations + seed
│   ├── ai/               # Wrappers de LLM, OCR, embeddings
│   ├── queue/            # Definições de jobs BullMQ
│   └── shared/           # Tipos TypeScript compartilhados, validações Zod
├── docker-compose.yml    # PostgreSQL + Redis + MinIO para dev
├── turbo.json
├── package.json
└── CLAUDE.md             # este arquivo
```
---
## 4. Modelo de dados — tabelas principais
> Banco PostgreSQL com Row-Level Security (RLS) por `tenant_id` em todas as tabelas de negócio.
### Multi-tenancy e acesso
- **`tenants`** — empresas-cliente (id, name, slug, plan, max_editais_per_month, max_cats_stored, active)
- **`users`** — (id, tenant_id, email, name, role: admin|analyst|viewer, auth_provider_id, active)
- **`audit_logs`** — imutável (id, tenant_id, user_id, action, entity_type, entity_id, metadata JSONB)
### Editais
- **`editais`** — (id, tenant_id, uploaded_by, file_name, file_url, page_count, pdf_type: copyable|scanned|mixed, status: uploaded|ocr_processing|extracting|review_pending|ready|error, orgao_licitante, numero_edital, modalidade, objeto, valor_estimado, data_abertura, ai_extraction_cost_usd, ocr_cost_usd)
- **`edital_requisitos`** — (id, tenant_id, edital_id, lote, categoria, descricao, trecho_original, pagina_referencia, quantitativo_exigido, unidade, ai_confidence_score 0-100, status: ai_extracted|human_approved|human_edited|human_rejected, edited_by, **embedding VECTOR(1536)**)
### Acervo de CATs
- **`profissionais_tecnicos`** — (id, tenant_id, nome, numero_crea_cau, conselho: CREA|CAU, uf_registro, ativo)
- **`cats`** — (id, tenant_id, profissional_id, uploaded_by, file_name, file_url, file_type: pdf_scanned|pdf_copyable|excel|manual, numero_cat, empresa_contratante, tipo_obra_servico, descricao_tecnica, quantitativo_valor, quantitativo_unidade, data_inicio, data_conclusao, status_extracao, ai_confidence_score, **embedding VECTOR(1536)**, ativo)
- **`cat_itens`** — (id, tenant_id, cat_id, numero_item, descricao, unidade, quantidade NUMERIC(15,4), origem: ai_extracted|human_added|excel_imported, ai_confidence_score, **embedding VECTOR(1536)**, ordem)
### Cruzamento
- **`crossings`** — (id, tenant_id, edital_id, triggered_by, status, score_aderencia 0-100, total_requisitos, requisitos_atendidos, requisitos_com_ressalva, requisitos_gap, recomendacao: participar|participar_com_ressalvas|nao_participar, recomendacao_justificativa, ai_cost_usd, processing_time_seconds)
- **`crossing_items`** — (id, tenant_id, crossing_id, requisito_id, resultado: atendido|atendido_parcialmente|gap, ai_justificativa, score_similaridade_max, human_override, human_override_by, human_override_note)
- **`crossing_item_cats`** — (id, crossing_item_id, cat_id, **cat_item_id nullable**, nivel_match: cat|item, score_similaridade NUMERIC(5,4), avaliacao_llm: atende|atende_parcialmente|nao_atende, justificativa_llm, rank_posicao)
### Jobs
- **`processing_jobs`** — (id, tenant_id, job_type: ocr|edital_extraction|cat_extraction|crossing|embedding_gen, entity_type, entity_id, status: queued|running|completed|failed|retrying, attempt_count max 3, error_message, started_at, completed_at, cost_usd)
### Índices críticos (além de PKs/FKs)
```sql
-- pgvector HNSW para busca semântica
CREATE INDEX ON edital_requisitos USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON cats             USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON cat_itens        USING hnsw (embedding vector_cosine_ops);
-- Compostos para queries de tenant
CREATE INDEX ON edital_requisitos (tenant_id, edital_id);
CREATE INDEX ON cat_itens         (tenant_id, cat_id);
CREATE INDEX ON cats              (tenant_id, tipo_obra_servico);
CREATE INDEX ON crossings         (tenant_id, edital_id);
CREATE INDEX ON processing_jobs   (tenant_id, status);
CREATE INDEX ON audit_logs        (tenant_id, created_at);
```
---
## 5. Convenções de código
### Geral
- **TypeScript strict mode** em todos os packages — sem `any` explícito
- **Zod** para validação de inputs em todas as rotas da API e em todos os jobs
- **Drizzle ORM** para todas as queries — sem SQL raw exceto para operações pgvector e migrations complexas
- Nomenclatura: `camelCase` no código, `snake_case` no banco
- Todas as respostas de erro da API seguem o formato: `{ error: { code: string, message: string, details?: unknown } }`
### Backend (Fastify)
- Cada domínio tem seu próprio plugin Fastify em `apps/api/src/modules/<dominio>/`
- Estrutura de módulo: `routes.ts` + `service.ts` + `schema.ts` (Zod) + `repository.ts` (Drizzle)
- Autenticação via middleware Clerk — `request.tenantId` e `request.userId` disponíveis em todas as rotas protegidas
- RLS ativado: toda query ao banco **deve** passar `tenant_id` explicitamente — nunca confiar só no RLS como única barreira
### Frontend (Next.js)
- App Router com Server Components por padrão — Client Components apenas onde necessário
- Fetch de dados via Server Actions ou Route Handlers — não usar `useEffect` para busca de dados
- UI components em `apps/web/src/components/ui/` (shadcn/ui como base)
- Estado global: Zustand (somente para estado de UI complexo — ex: polling de jobs)
### Jobs (BullMQ)
- Cada job type tem seu processor em `packages/queue/src/processors/<job_type>.ts`
- Todo job deve: (1) atualizar `processing_jobs.status` para `running` no início, (2) registrar custo de IA em `processing_jobs.cost_usd` ao final, (3) tratar erros com retry automático até `attempt_count = 3`
- Jobs de IA nunca fazem chamadas síncronas — sempre via fila
### IA / LLM
- Todas as chamadas ao Claude API ficam em `packages/ai/src/`
- Prompts são arquivos `.ts` separados em `packages/ai/src/prompts/` — nunca inline no código
- Toda chamada LLM deve: logar tokens consumidos, calcular custo estimado em USD e persistir em `processing_jobs.cost_usd`
- Respostas do LLM que precisam ser estruturadas usam XML tags de output — nunca confiar em JSON puro sem validação Zod
---
## 6. Segurança — regras inegociáveis
- **Nunca** expor `tenant_id` de outros tenants em nenhuma resposta de API
- **Nunca** processar arquivo de um tenant no contexto de outro tenant
- Todos os uploads de arquivo devem ser validados: tipo MIME, tamanho máximo (50MB por arquivo), extensões permitidas (.pdf, .xlsx, .xls)
- URLs de S3 para download são sempre **pré-assinadas** com expiração de 15 minutos — nunca URLs públicas permanentes
- Variáveis de ambiente sensíveis: nunca no código, sempre em `.env.local` (dev) ou secrets do CI/CD (prod)
---
## 7. Variáveis de ambiente necessárias
```bash
# Banco
DATABASE_URL=postgresql://...
# Redis
REDIS_URL=redis://...
# Storage
S3_BUCKET=
S3_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
# Auth
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
# IA
ANTHROPIC_API_KEY=
VOYAGE_API_KEY=
GOOGLE_DOCUMENT_AI_PROJECT_ID=
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=
GOOGLE_APPLICATION_CREDENTIALS=
# App
NEXT_PUBLIC_API_URL=http://localhost:3001
API_PORT=3001
```
---
## 8. Módulos do sistema e estado de desenvolvimento
| Módulo | Descrição | Status |
|--------|-----------|--------|
| M0 | Infraestrutura base (monorepo, DB, auth, multi-tenancy) | 🔲 Pendente |
| M1 | Upload + pipeline de editais (OCR + extração de requisitos) | 🔲 Pendente |
| M2 | Acervo de CATs (upload PDF/Excel, extração, cat_itens) | 🔲 Pendente |
| M3 | Motor de cruzamento semântico | 🔲 Pendente |
| M4 | Dashboard + exportação de relatórios | 🔲 Pendente |
| M5 | Gestão de usuários, planos e auditoria | 🔲 Pendente |
> **Atualize o status deste quadro a cada módulo concluído.**
> Use: 🔲 Pendente | 🔄 Em andamento | ✅ Concluído
---
## 9. Comandos úteis
```bash
# Instalar dependências
pnpm install
# Subir ambiente de desenvolvimento
docker-compose up -d          # PostgreSQL + Redis + MinIO
pnpm dev                      # Roda api + web em paralelo (Turborepo)
# Banco de dados
pnpm db:migrate               # Executa migrations pendentes
pnpm db:studio                # Abre Drizzle Studio
pnpm db:seed                  # Popula dados de teste
# Testes
pnpm test                     # Vitest (todos os packages)
pnpm test:e2e                 # Playwright
# Build
pnpm build                    # Build de produção (todos os apps)
```
---
## 10. Decisões de arquitetura já tomadas — não reverter sem discussão
1. **pgvector no PostgreSQL** para embeddings — não usar Pinecone/Weaviate no MVP (simplifica infraestrutura)
2. **Drizzle ORM** — não Prisma (melhor suporte a pgvector e tipos customizados)
3. **BullMQ** para fila — não SQS no MVP (evitar dependência de AWS para dev local)
4. **Clerk** para auth — não NextAuth/Auth.js (suporte nativo a multi-tenancy via Organizations)
5. **Voyage AI** para embeddings — não OpenAI (melhor performance em textos técnicos em português)
6. **Matching em dois níveis**: embeddings de `cats.descricao_tecnica` E de `cat_itens.descricao` — o cruzamento deve tentar ambos e registrar `nivel_match` em `crossing_item_cats`
7. **Revisão humana obrigatória** para requisitos com `ai_confidence_score < 70` antes de liberar cruzamento
