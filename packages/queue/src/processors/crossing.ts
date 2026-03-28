import { Worker, type Job } from 'bullmq'
import { db } from '@licitacat/db'
import {
    crossings,
    crossingItems,
    crossingItemCats,
    processingJobs,
    reqParcelasRelevancia,
    cats,
    catItens,
    editais,
} from '@licitacat/db/schema'
import {
    callLlm,
    DEFAULT_MODEL,
    calculateCostUsd,
} from '@licitacat/ai/llm'
import {
    parseCrossingEvaluationsXml,
    parseCrossingRecommendationXml,
} from '@licitacat/ai/llm'
import {
    CROSSING_SYSTEM_PROMPT,
    buildCrossingItemPrompt,
    buildCrossingRecommendationPrompt,
} from '@licitacat/ai/prompts'
import { generateEmbedding, cosineSimilarity } from '@licitacat/ai/embeddings'
import { eq, and, sql } from 'drizzle-orm'
import type { CrossingJobData } from '../queues/index.js'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
const TOP_K_CANDIDATES = 8       // max candidates sent to LLM per requisito
const SIMILARITY_THRESHOLD = 0.55 // minimum cosine similarity to be a semantic candidate
const KEYWORD_FALLBACK_SCORE = 0.4 // score assigned to keyword-only matches

const connection = {
    host: new URL(REDIS_URL).hostname,
    port: parseInt(new URL(REDIS_URL).port ?? '6379', 10),
}

interface CandidateResult {
    catId: string
    catItemId: string | null
    nivelMatch: 'cat' | 'item'
    descricao: string
    quantitativo: number | null
    unidade: string | null
    scoreSimilaridade: number
    isKeywordMatch?: boolean
}

/** Normalize text for comparison: lowercase + remove diacritics (cedilha, tilde, etc.) */
function normalizeForCompare(str: string): string {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

async function findKeywordCandidates(
    tenantId: string,
    requisitoDescricao: string,
): Promise<CandidateResult[]> {
    const stopwords = new Set(['com', 'para', 'por', 'das', 'dos', 'uma', 'uns', 'umas', 'que', 'não', 'mais', 'ser', 'ter', 'sua', 'seu', 'num', 'numa', 'este', 'essa', 'tipo', 'obra', 'execucao', 'execução'])
    const keywords = requisitoDescricao
        .split(/\s+/)
        .map(w => w.replace(/[^a-zA-ZÀ-ÿ]/g, '').toLowerCase())
        .filter(w => w.length >= 4 && !stopwords.has(w) && !stopwords.has(normalizeForCompare(w)))
        .slice(0, 6)

    if (keywords.length === 0) {
        console.log('[crossing:keyword] No keywords extracted from:', requisitoDescricao)
        return []
    }

    // Fetch broader candidates using OR (any keyword matches) — we'll score and filter in JS
    const regexPattern = keywords.join('|')
    console.log('[crossing:keyword] Keywords:', keywords, 'for:', requisitoDescricao)

    let candidateRows: unknown[] = []
    try {
        const result = await db.execute(sql`
            SELECT ci.cat_id, ci.id as cat_item_id, 'item' as nivel_match,
                   ci.descricao,
                   ci.quantidade::float as quantitativo,
                   ci.unidade
            FROM cat_itens ci
            JOIN cats c ON c.id = ci.cat_id
            WHERE ci.tenant_id = ${tenantId}
              AND c.ativo = true
              AND ci.descricao ~* ${regexPattern}
            ORDER BY ci.descricao
            LIMIT 100
        `)
        candidateRows = Array.from(result as unknown as Iterable<unknown>)
    } catch (e) {
        console.error('[crossing:keyword] DB error:', e)
        return []
    }

    // Score each candidate by counting how many keywords match (with accent-insensitive comparison)
    // Require at least 3 matching keywords when requisito has 4+ keywords; otherwise 2
    const minMatches = keywords.length >= 4 ? Math.min(3, keywords.length) : Math.min(2, keywords.length)
    const normalizedKeywords = keywords.map(normalizeForCompare)

    const scored = candidateRows
        .map((row) => {
            const r = row as Record<string, unknown>
            const descNorm = normalizeForCompare(String(r['descricao'] ?? ''))
            const matchCount = normalizedKeywords.filter(kw => descNorm.includes(kw)).length
            const score = KEYWORD_FALLBACK_SCORE * (matchCount / keywords.length)
            return { r, matchCount, score }
        })
        .filter(({ matchCount }) => matchCount >= minMatches)
        .sort((a, b) => b.matchCount - a.matchCount || b.score - a.score)
        .slice(0, TOP_K_CANDIDATES)

    console.log('[crossing:keyword] After scoring: total candidates =', candidateRows.length, ', passing threshold =', scored.length)

    return scored.map(({ r, score }) => ({
        catId: String(r['cat_id']),
        catItemId: r['cat_item_id'] ? String(r['cat_item_id']) : null,
        nivelMatch: 'item' as const,
        descricao: String(r['descricao'] ?? ''),
        quantitativo: r['quantitativo'] != null ? Number(r['quantitativo']) : null,
        unidade: r['unidade'] ? String(r['unidade']) : null,
        scoreSimilaridade: Math.min(score, KEYWORD_FALLBACK_SCORE),
        isKeywordMatch: true,
    }))
}

async function findSemanticCandidates(
    tenantId: string,
    requisitoDescricao: string,
): Promise<CandidateResult[]> {
    let catResultRows: unknown[] = []
    let itemResultRows: unknown[] = []

    try {
        // Generate query embedding
        const queryEmbedding = await generateEmbedding(requisitoDescricao, 'query')
        const embeddingStr = `[${queryEmbedding.embedding.join(',')}]`

        // Search CAT descriptions via pgvector (only when embeddings exist)
        const catResults = await db.execute(sql`
        SELECT c.id as cat_id, NULL as cat_item_id, 'cat' as nivel_match,
               c.descricao_tecnica as descricao,
               c.quantitativo_valor::float as quantitativo,
               c.quantitativo_unidade as unidade,
               1 - (c.embedding <=> ${embeddingStr}::vector) as score
        FROM cats c
        WHERE c.tenant_id = ${tenantId}
          AND c.ativo = true
          AND c.embedding IS NOT NULL
          AND c.status_extracao IN ('review_pending', 'completed')
        ORDER BY c.embedding <=> ${embeddingStr}::vector
        LIMIT ${TOP_K_CANDIDATES}
      `)

        // Search CAT item descriptions via pgvector (only when embeddings exist)
        const itemResults = await db.execute(sql`
        SELECT ci.cat_id, ci.id as cat_item_id, 'item' as nivel_match,
               ci.descricao,
               ci.quantidade::float as quantitativo,
               ci.unidade,
               1 - (ci.embedding <=> ${embeddingStr}::vector) as score
        FROM cat_itens ci
        JOIN cats c ON c.id = ci.cat_id
        WHERE ci.tenant_id = ${tenantId}
          AND c.ativo = true
          AND ci.embedding IS NOT NULL
        ORDER BY ci.embedding <=> ${embeddingStr}::vector
        LIMIT ${TOP_K_CANDIDATES}
      `)

        // postgres-js driver returns results as a direct array (no .rows property)
        catResultRows = Array.from(catResults as unknown as Iterable<unknown>)
        itemResultRows = Array.from(itemResults as unknown as Iterable<unknown>)
        console.log('[crossing:semantic] pgvector results — cats:', catResultRows.length, 'items:', itemResultRows.length)
    } catch (e) {
        console.error('[crossing:semantic] pgvector error (falling back to keyword):', e)
    }

    // Merge and deduplicate by cat_id+cat_item_id, keeping highest score
    const seen = new Map<string, CandidateResult>()

    for (const row of [...catResultRows, ...itemResultRows]) {
        const r = row as Record<string, unknown>
        const score = Number(r['score'] ?? 0)
        if (score < SIMILARITY_THRESHOLD) continue

        const key = `${r['cat_id']}-${r['cat_item_id'] ?? 'null'}`
        const existing = seen.get(key)
        if (!existing || score > existing.scoreSimilaridade) {
            seen.set(key, {
                catId: String(r['cat_id']),
                catItemId: r['cat_item_id'] ? String(r['cat_item_id']) : null,
                nivelMatch: String(r['nivel_match']) as 'cat' | 'item',
                descricao: String(r['descricao'] ?? ''),
                quantitativo: r['quantitativo'] != null ? Number(r['quantitativo']) : null,
                unidade: r['unidade'] ? String(r['unidade']) : null,
                scoreSimilaridade: score,
            })
        }
    }

    const semanticResults = Array.from(seen.values())
        .sort((a, b) => b.scoreSimilaridade - a.scoreSimilaridade)
        .slice(0, TOP_K_CANDIDATES)

    // Keyword fallback: when no semantic results found (embeddings not yet generated or no match above threshold)
    console.log('[crossing:semantic] Found', semanticResults.length, 'semantic candidates for:', requisitoDescricao)
    if (semanticResults.length === 0) {
        console.log('[crossing:semantic] Falling back to keyword search')
        return findKeywordCandidates(tenantId, requisitoDescricao)
    }

    return semanticResults
}

function calculateCombinedQuantity(
    candidates: CandidateResult[],
): { totalQty: number | null; unit: string | null } {
    const withQty = candidates.filter(c => c.quantitativo != null && c.quantitativo > 0)
    if (withQty.length === 0) return { totalQty: null, unit: null }

    const totalQty = withQty.reduce((sum, c) => sum + (c.quantitativo ?? 0), 0)
    // Use the most common unit among candidates
    const unitCounts = new Map<string, number>()
    for (const c of withQty) {
        if (c.unidade) unitCounts.set(c.unidade, (unitCounts.get(c.unidade) ?? 0) + 1)
    }
    let unit: string | null = null
    let maxCount = 0
    for (const [u, count] of unitCounts) {
        if (count > maxCount) { maxCount = count; unit = u }
    }

    return { totalQty, unit }
}

async function processCrossing(job: Job<CrossingJobData>): Promise<void> {
    const { tenantId, crossingId, editalId, jobId } = job.data
    const startTime = Date.now()

    await db.update(processingJobs).set({ status: 'running', startedAt: new Date() }).where(eq(processingJobs.id, jobId))
    await db.update(crossings).set({ status: 'processing' }).where(eq(crossings.id, crossingId))

    try {
        let totalInputTokens = 0
        let totalOutputTokens = 0
        let atendidos = 0
        let parciais = 0
        let gaps = 0
        const gapDescriptions: string[] = []

        // Fetch parcelas de relevância — these are the technical requirements crossed with CATs
        const requisitos = await db
            .select()
            .from(reqParcelasRelevancia)
            .where(
                and(
                    eq(reqParcelasRelevancia.tenantId, tenantId),
                    eq(reqParcelasRelevancia.editalId, editalId),
                ),
            )

        await db
            .update(crossings)
            .set({ totalRequisitos: requisitos.length })
            .where(eq(crossings.id, crossingId))

        // Process each requisito
        for (const requisito of requisitos) {
            // 1. Find candidates (semantic + keyword fallback)
            const candidates = await findSemanticCandidates(tenantId, requisito.servico)

            let resultado: 'atendido' | 'atendido_parcialmente' | 'gap' = 'gap'
            let justificativa = 'Nenhuma CAT candidata encontrada para este requisito.'
            let scoreSimilaridadeMax = 0
            const avaliacoes: Array<{
                catId: string
                catItemId: string | null
                nivelMatch: 'cat' | 'item'
                scoreSimilaridade: number
                avaliacaoLlm: 'atende' | 'atende_parcialmente' | 'nao_atende'
                justificativaLlm: string
                rank: number
            }> = []

            if (candidates.length > 0) {
                // 2. Calculate combined quantity across all matching CATs
                const { totalQty, unit: combinedUnit } = calculateCombinedQuantity(candidates)

                // 3. Ask LLM to evaluate
                const userPrompt = buildCrossingItemPrompt(
                    {
                        descricao: requisito.servico,
                        quantitativoExigido: requisito.quantidadeMinima ? parseFloat(requisito.quantidadeMinima) : null,
                        unidade: requisito.unidade,
                    },
                    candidates,
                    totalQty,
                    combinedUnit,
                )

                const response = await callLlm({
                    max_tokens: 2048,
                    system: CROSSING_SYSTEM_PROMPT,
                    messages: [{ role: 'user', content: userPrompt }],
                })

                totalInputTokens += response.usage.input_tokens
                totalOutputTokens += response.usage.output_tokens

                const parsed = parseCrossingEvaluationsXml(response.text)

                resultado = parsed.resultadoGeral.resultado
                justificativa = parsed.resultadoGeral.justificativa

                // Map evaluations back to candidates
                for (let i = 0; i < candidates.length; i++) {
                    const candidate = candidates[i]!
                    const evaluation = parsed.avaliacoes.find(
                        (e) => e.catId === candidate.catId && (e.catItemId === candidate.catItemId || (!e.catItemId && !candidate.catItemId)),
                    )

                    if (candidate.scoreSimilaridade > scoreSimilaridadeMax) {
                        scoreSimilaridadeMax = candidate.scoreSimilaridade
                    }

                    avaliacoes.push({
                        catId: candidate.catId,
                        catItemId: candidate.catItemId,
                        nivelMatch: candidate.nivelMatch,
                        scoreSimilaridade: candidate.scoreSimilaridade,
                        avaliacaoLlm: evaluation?.avaliacaoLlm ?? 'nao_atende',
                        justificativaLlm: evaluation?.justificativa ?? '',
                        rank: i + 1,
                    })
                }
            }

            // 4. Insert crossing_item
            const [crossingItem] = await db
                .insert(crossingItems)
                .values({
                    tenantId,
                    crossingId,
                    requisitoId: requisito.id,
                    resultado,
                    aiJustificativa: justificativa,
                    scoreSimilaridadeMax: scoreSimilaridadeMax.toFixed(4),
                })
                .returning()

            if (!crossingItem) continue

            // 5. Insert crossing_item_cats
            if (avaliacoes.length > 0) {
                await db.insert(crossingItemCats).values(
                    avaliacoes.map((a) => ({
                        crossingItemId: crossingItem.id,
                        catId: a.catId,
                        catItemId: a.catItemId,
                        nivelMatch: a.nivelMatch,
                        scoreSimilaridade: a.scoreSimilaridade.toFixed(4),
                        avaliacaoLlm: a.avaliacaoLlm,
                        justificativaLlm: a.justificativaLlm,
                        rankPosicao: a.rank,
                    })),
                )
            }

            // Count results
            if (resultado === 'atendido') atendidos++
            else if (resultado === 'atendido_parcialmente') parciais++
            else {
                gaps++
                gapDescriptions.push(requisito.servico.slice(0, 200))
            }
        }

        // 6. Calculate adherence score
        const totalReqs = requisitos.length
        const scoreAderencia = totalReqs > 0
            ? Math.round(((atendidos + parciais * 0.5) / totalReqs) * 100)
            : 0

        // 7. Get recommendation from LLM
        const edital = await db.query.editais.findFirst({
            where: eq(editais.id, editalId),
        })

        let recomendacao: 'participar' | 'participar_com_ressalvas' | 'nao_participar' = 'nao_participar'
        let recomendacaoJustificativa = ''

        if (edital) {
            const recPrompt = buildCrossingRecommendationPrompt(
                edital.objeto ?? 'Não informado',
                { totalRequisitos: totalReqs, atendidos, atendidosParcialmente: parciais, gaps, scoreAderencia },
                gapDescriptions.slice(0, 5),
            )

            const recResponse = await callLlm({
                max_tokens: 1024,
                system: CROSSING_SYSTEM_PROMPT,
                messages: [{ role: 'user', content: recPrompt }],
            })

            totalInputTokens += recResponse.usage.input_tokens
            totalOutputTokens += recResponse.usage.output_tokens

            const parsedRec = parseCrossingRecommendationXml(recResponse.text)
            recomendacao = parsedRec.decisao
            recomendacaoJustificativa = parsedRec.justificativa
        }

        const totalCost = calculateCostUsd(DEFAULT_MODEL, totalInputTokens, totalOutputTokens)
        const processingTime = Math.round((Date.now() - startTime) / 1000)

        // 8. Update crossing with final results
        await db
            .update(crossings)
            .set({
                status: 'completed',
                scoreAderencia,
                totalRequisitos: totalReqs,
                requisitosAtendidos: atendidos,
                requisitosComRessalva: parciais,
                requisitosGap: gaps,
                recomendacao,
                recomendacaoJustificativa,
                aiCostUsd: totalCost.toFixed(6),
                processingTimeSeconds: processingTime,
            })
            .where(eq(crossings.id, crossingId))

        await db
            .update(processingJobs)
            .set({ status: 'completed', completedAt: new Date(), costUsd: totalCost.toFixed(6) })
            .where(eq(processingJobs.id, jobId))
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        const currentJob = await db.query.processingJobs.findFirst({ where: eq(processingJobs.id, jobId) })
        const attemptCount = (currentJob?.attemptCount ?? 0) + 1
        const status = attemptCount >= 3 ? 'failed' : 'retrying'

        await db.update(processingJobs).set({ status, errorMessage, attemptCount }).where(eq(processingJobs.id, jobId))

        if (status === 'failed') {
            await db.update(crossings).set({ status: 'error' }).where(eq(crossings.id, crossingId))
        }

        throw error
    }
}

export function createCrossingWorker(): Worker<CrossingJobData> {
    return new Worker<CrossingJobData>('crossing', processCrossing, {
        connection,
        concurrency: 1,
    })
}
