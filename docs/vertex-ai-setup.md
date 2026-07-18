# Setup Google Cloud — Migração para Vertex AI

> Passo a passo para (re)criar toda a infraestrutura Google Cloud do LicitaCAT numa
> conta/projeto novo. O projeto antigo (`engcheck`) foi descontinuado.
>
> **Contexto:** o crédito de $300 do Free Trial **não paga** a Gemini API do AI Studio
> (exclusão do Google desde março/2026), mas **paga** o Vertex AI. Por isso migramos
> LLM + embeddings do AI Studio para o Vertex AI. O código já foi migrado
> (`AI_PROVIDER=vertex`, SDK `@google/genai`); falta a infra Google Cloud abaixo.

## Visão geral
Tudo **no mesmo projeto novo** (o que tem o crédito de $300):
projeto → billing → 2 APIs (Vertex AI + Document AI) → 1 processador Document AI
(**região US**) → 1 service account com 2 papéis → 1 chave JSON. Essa chave alimenta
tanto o Vertex (LLM/embeddings) quanto o Document AI (OCR).

---

## A) Projeto + billing (crédito $300)
1. https://console.cloud.google.com/projectcreate → crie o projeto (anote o **Project ID**, ex.: `licitacat-prod`).
2. Menu ☰ → *Billing* → *Link a billing account* → vincule a conta com os $300.

→ produz: `GOOGLE_VERTEX_PROJECT` e `GOOGLE_DOCUMENT_AI_PROJECT_ID` (é o mesmo Project ID).

## B) Ativar as 2 APIs (abrir e clicar **Enable**)
- Vertex AI: https://console.cloud.google.com/apis/library/aiplatform.googleapis.com
- Document AI: https://console.cloud.google.com/apis/library/documentai.googleapis.com

## C) Document AI — criar processador Form Parser ⚠️ região **US**
1. https://console.cloud.google.com/ai/document-ai/processors
2. **Create Processor** → tipo **Form Parser**.
3. **Region = United States (us)** — obrigatório (o código usa `location = 'us'` fixo em `packages/ai/src/ocr/document-ai.ts`).
4. Abra o processador → copie o **ID** (em "Prediction endpoint": `.../locations/us/processors/<ESSE_ID>`).

→ produz: `GOOGLE_DOCUMENT_AI_PROCESSOR_ID`.

## D) Service account + papéis + chave JSON
1. https://console.cloud.google.com/iam-admin/serviceaccounts → **Create service account** (ex.: `licitacat-ai`).
2. **Grant roles** (os dois):
   - **Vertex AI User** (`roles/aiplatform.user`)
   - **Document AI API User** (`roles/documentai.apiUser`)
3. Abra a SA → aba **Keys** → **Add key → Create new key → JSON** → baixa o `.json`.

→ esse JSON vira o secret `gcp_credentials` (passo F2).

## E) Nome do modelo LLM no Vertex
`gemini-3-flash-preview` (do AI Studio) **pode não existir** no Vertex. Confira no
Model Garden: https://console.cloud.google.com/vertex-ai/model-garden (busque "Gemini Flash").
Anote o ID exato (ex.: `gemini-2.5-flash`).

→ produz: `LLM_MODEL` (se diferente de `gemini-3-flash-preview`).
Embeddings já têm default no código: `gemini-embedding-001` (768 dims) — não precisa mexer.

---

## F) Onde colocar os valores (no servidor de deploy)

### F1. `/root/licitacat.secrets.env`
```bash
AI_PROVIDER=vertex
GOOGLE_VERTEX_PROJECT=<seu-project-id>
GOOGLE_VERTEX_LOCATION=us-central1
GOOGLE_DOCUMENT_AI_PROJECT_ID=<seu-project-id>
LLM_MODEL=<nome-do-modelo-do-passo-E>   # deixe vazio se for gemini-3-flash-preview
# EMBEDDING_MODEL: deixe vazio (usa gemini-embedding-001)
```

### F2. Trocar o secret `gcp_credentials` (Swarm secrets são imutáveis → criar novo)
```bash
docker secret create gcp_credentials_v2 /root/licitacat-sa.json
# depois: atualizar docker-stack.yml (gcp_credentials → gcp_credentials_v2 nos serviços e no bloco secrets)
```

### F3. Ajuste pendente no `docker-stack.yml`
`GOOGLE_DOCUMENT_AI_PROCESSOR_ID` está **fixo** como `"6547814ce6130bd6"` (do engcheck).
Trocar pelo novo Processor ID (ou passar a ler de env `${GOOGLE_DOCUMENT_AI_PROCESSOR_ID}`).

---

## G) Alternativa rápida via `gcloud` (faz A–D de uma vez)
```bash
gcloud projects create licitacat-prod --name="LicitaCAT"
gcloud config set project licitacat-prod
gcloud billing projects link licitacat-prod --billing-account=XXXXXX-XXXXXX-XXXXXX
gcloud services enable aiplatform.googleapis.com documentai.googleapis.com
gcloud iam service-accounts create licitacat-ai --display-name="LicitaCAT AI"
SA="licitacat-ai@licitacat-prod.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding licitacat-prod --member="serviceAccount:$SA" --role="roles/aiplatform.user"
gcloud projects add-iam-policy-binding licitacat-prod --member="serviceAccount:$SA" --role="roles/documentai.apiUser"
gcloud iam service-accounts keys create /root/licitacat-sa.json --iam-account="$SA"
```
O processador Document AI (Form Parser, região **us**) é mais fácil criar pelo Console (passo C).

---

## Valores a coletar (checklist para retomar)
- [ ] **Project ID** → `GOOGLE_VERTEX_PROJECT` + `GOOGLE_DOCUMENT_AI_PROJECT_ID`
- [ ] **Processor ID** (Form Parser, região `us`) → `GOOGLE_DOCUMENT_AI_PROCESSOR_ID`
- [ ] **Nome do modelo LLM** (Model Garden) → `LLM_MODEL`
- [ ] **JSON da service account** → secret `gcp_credentials_v2`

## Depois que a infra estiver pronta (feito pelo assistente)
1. Atualizar `docker-stack.yml` (processor id + nome do secret).
2. Adicionar as linhas ao `/root/licitacat.secrets.env`.
3. `docker secret create gcp_credentials_v2 ...` + build + deploy (`api`, `worker`, `web`).
4. Reprocessar um edital → validar extração sem erro de billing (`prepayment credits depleted`).
5. Disparar a fila `reembed_batch` para regerar embeddings com `gemini-embedding-001`.
6. Rodar um cruzamento e conferir score/itens.

## Rollback
Setar `AI_PROVIDER=studio` no secrets + redeploy volta ao AI Studio sem alterar código
(precisa de uma `GEMINI_API_KEY` com saldo pré-pago — não coberto pelo $300).
