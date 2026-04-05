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
    callLlmWithCache,
    createLlmCache,
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
import { generateEmbedding, CURRENT_EMBEDDING_MODEL } from '@licitacat/ai/embeddings'
import { eq, and, sql } from 'drizzle-orm'
import type { CrossingJobData } from '../queues/index.js'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
const SEMANTIC_RETRIEVAL_LIMIT = 30  // pgvector initial candidates (broader recall)
const FTS_RETRIEVAL_LIMIT = 30       // FTS initial candidates per table
const SIMILARITY_THRESHOLD = 0.35   // permissive threshold — RRF handles final ranking
const MAX_CANDIDATES_TO_LLM = 18    // final limit of candidates sent to LLM per requisito
const RRF_K = 60                     // standard RRF constant (higher = smoother blend)

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

/**
 * Strip common edital prefixes that are implicit in CAT descriptions.
 * Editais use "Execução de alvenaria de vedação" but CATs just say "Alvenaria de vedação"
 * because the execution is implied by having a CAT for the service.
 */
const EDITAL_PREFIX_PATTERNS = [
    /^fornecimento,?\s*(montagem\s+e\s+)?instala[çc][ãa]o\s+(e\s+execu[çc][ãa]o\s+)?(de|dos?|das?)\s+/i,
    /^fornecimento\s+e\s+execu[çc][ãa]o\s+(de|dos?|das?)\s+/i,
    /^execu[çc][ãa]o\s+(de|dos?|das?)\s+(servi[çc]os?\s+(de|dos?|das?)\s+)?/i,
    /^servi[çc]os?\s+(de|dos?|das?)\s+/i,
    /^fornecimento\s+(de|dos?|das?)\s+/i,
    /^instala[çc][ãa]o\s+(de|dos?|das?)\s+/i,
    /^constru[çc][ãa]o\s+(de|dos?|das?)\s+/i,
    /^implanta[çc][ãa]o\s+(de|dos?|das?)\s+/i,
]

function stripEditalPrefixes(text: string): string {
    let result = text.trim()
    for (const pattern of EDITAL_PREFIX_PATTERNS) {
        const stripped = result.replace(pattern, '')
        if (stripped !== result && stripped.length > 3) {
            console.log(`[crossing:prefix] "${result}" → "${stripped}"`)
            result = stripped
            break // apply only first matching prefix
        }
    }
    return result
}

/**
 * Full-text search using PostgreSQL tsvector/tsquery with Portuguese stemming.
 * Searches both cat_itens and cats tables via GIN indexes (added in migration 0009).
 * Uses plainto_tsquery for natural language input and ts_rank_cd for result ranking.
 */
async function findFtsCandidates(
    tenantId: string,
    descricao: string,
): Promise<CandidateResult[]> {
    let itemRows: unknown[] = []
    let catRows: unknown[] = []

    try {
        const itemResults = await db.execute(sql`
            SELECT ci.cat_id, ci.id as cat_item_id, 'item' as nivel_match,
                   ci.descricao,
                   ci.quantidade::float as quantitativo,
                   ci.unidade,
                   ts_rank_cd(ci.search_vector, query) as fts_score
            FROM cat_itens ci
            JOIN cats c ON c.id = ci.cat_id,
                 plainto_tsquery('portuguese', immutable_unaccent(${descricao})) query
            WHERE ci.tenant_id = ${tenantId}
              AND c.ativo = true
              AND ci.search_vector @@ query
            ORDER BY fts_score DESC
            LIMIT ${FTS_RETRIEVAL_LIMIT}
        `)

        const catResults = await db.execute(sql`
            SELECT c.id as cat_id, NULL as cat_item_id, 'cat' as nivel_match,
                   c.descricao_tecnica as descricao,
                   c.quantitativo_valor::float as quantitativo,
                   c.quantitativo_unidade as unidade,
                   ts_rank_cd(c.search_vector, query) as fts_score
            FROM cats c,
                 plainto_tsquery('portuguese', immutable_unaccent(${descricao})) query
            WHERE c.tenant_id = ${tenantId}
              AND c.ativo = true
              AND c.search_vector @@ query
            ORDER BY fts_score DESC
            LIMIT ${FTS_RETRIEVAL_LIMIT}
        `)

        itemRows = Array.from(itemResults as unknown as Iterable<unknown>)
        catRows = Array.from(catResults as unknown as Iterable<unknown>)
        console.log('[crossing:fts] results — cats:', catRows.length, 'items:', itemRows.length)
    } catch (e) {
        console.error('[crossing:fts] DB error:', e)
        return []
    }

    // Combine, dedup by key keeping highest fts_score
    const seen = new Map<string, CandidateResult>()
    for (const row of [...catRows, ...itemRows]) {
        const r = row as Record<string, unknown>
        const key = `${r['cat_id']}-${r['cat_item_id'] ?? 'null'}`
        const ftsScore = Number(r['fts_score'] ?? 0)
        const existing = seen.get(key)
        if (!existing || ftsScore > (existing.scoreSimilaridade ?? 0)) {
            seen.set(key, {
                catId: String(r['cat_id']),
                catItemId: r['cat_item_id'] ? String(r['cat_item_id']) : null,
                nivelMatch: String(r['nivel_match']) as 'cat' | 'item',
                descricao: String(r['descricao'] ?? ''),
                quantitativo: r['quantitativo'] != null ? Number(r['quantitativo']) : null,
                unidade: r['unidade'] ? String(r['unidade']) : null,
                scoreSimilaridade: ftsScore, // placeholder; replaced by RRF in hybrid merge
                isKeywordMatch: true,
            })
        }
    }

    const results = Array.from(seen.values())
        .sort((a, b) => b.scoreSimilaridade - a.scoreSimilaridade)

    console.log('[crossing:fts] Found', results.length, 'FTS candidates for:', descricao)
    return results
}

/** Semantic-only search via pgvector — returns candidates above threshold, no fallback */
async function findSemanticOnly(
    tenantId: string,
    requisitoDescricao: string,
): Promise<CandidateResult[]> {
    let catResultRows: unknown[] = []
    let itemResultRows: unknown[] = []

    try {
        const queryEmbedding = await generateEmbedding(requisitoDescricao, 'query')
        const embeddingStr = `[${queryEmbedding.embedding.join(',')}]`

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
          AND c.embedding_model = ${CURRENT_EMBEDDING_MODEL}
          AND c.status_extracao IN ('review_pending', 'completed')
        ORDER BY c.embedding <=> ${embeddingStr}::vector
        LIMIT ${SEMANTIC_RETRIEVAL_LIMIT}
      `)

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
          AND ci.embedding_model = ${CURRENT_EMBEDDING_MODEL}
        ORDER BY ci.embedding <=> ${embeddingStr}::vector
        LIMIT ${SEMANTIC_RETRIEVAL_LIMIT}
      `)

        catResultRows = Array.from(catResults as unknown as Iterable<unknown>)
        itemResultRows = Array.from(itemResults as unknown as Iterable<unknown>)
        console.log('[crossing:semantic] pgvector results — cats:', catResultRows.length, 'items:', itemResultRows.length)
    } catch (e) {
        console.error('[crossing:semantic] pgvector error:', e)
        return []
    }

    // Filter by threshold and deduplicate
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

    const results = Array.from(seen.values())
        .sort((a, b) => b.scoreSimilaridade - a.scoreSimilaridade)

    console.log('[crossing:semantic] Found', results.length, 'semantic candidates for:', requisitoDescricao)
    return results
}

/**
 * Hybrid search: runs semantic (pgvector) + FTS (tsvector) in parallel,
 * then merges rankings via Reciprocal Rank Fusion (RRF).
 *
 * RRF score: sum(1 / (K + rank)) for each retrieval method that found the candidate.
 * Candidates found by both methods naturally rank higher.
 */
async function findCandidatesHybrid(
    tenantId: string,
    requisitoDescricao: string,
): Promise<CandidateResult[]> {
    // Strip implicit prefixes so "Execução de alvenaria de vedação" matches "Alvenaria de vedação"
    const coreDescription = stripEditalPrefixes(requisitoDescricao)

    // Run all searches in parallel
    const [semanticCore, semanticOriginal, ftsResults] = await Promise.all([
        findSemanticOnly(tenantId, coreDescription),
        coreDescription !== requisitoDescricao
            ? findSemanticOnly(tenantId, requisitoDescricao)
            : Promise.resolve([]),
        findFtsCandidates(tenantId, coreDescription),
    ])

    console.log('[crossing:hybrid] semantic(core):', semanticCore.length, 'semantic(original):', semanticOriginal.length, 'fts:', ftsResults.length)

    // Assign semantic ranks (sort by cosine similarity, best = rank 1)
    const allSemantic = [...semanticCore, ...semanticOriginal]
        .sort((a, b) => b.scoreSimilaridade - a.scoreSimilaridade)

    const semanticRanks = new Map<string, number>()
    const semanticScores = new Map<string, number>()
    allSemantic.forEach((r, i) => {
        const key = `${r.catId}-${r.catItemId ?? 'null'}`
        if (!semanticRanks.has(key)) {
            semanticRanks.set(key, i + 1)
            semanticScores.set(key, r.scoreSimilaridade)
        }
    })

    // Assign FTS ranks (already sorted by ts_rank_cd, best = rank 1)
    const ftsRanks = new Map<string, number>()
    ftsResults.forEach((r, i) => {
        const key = `${r.catId}-${r.catItemId ?? 'null'}`
        if (!ftsRanks.has(key)) ftsRanks.set(key, i + 1)
    })

    // Collect all unique candidates
    const allCandidates = new Map<string, CandidateResult>()
    for (const r of [...allSemantic, ...ftsResults]) {
        const key = `${r.catId}-${r.catItemId ?? 'null'}`
        if (!allCandidates.has(key)) allCandidates.set(key, { ...r })
    }

    // Compute RRF score and restore semantic similarity for the LLM prompt
    const rrfScored = Array.from(allCandidates.entries()).map(([key, candidate]) => {
        const semRank = semanticRanks.get(key)
        const ftsRank = ftsRanks.get(key)

        let rrfScore = 0
        if (semRank) rrfScore += 1 / (RRF_K + semRank)
        if (ftsRank) rrfScore += 1 / (RRF_K + ftsRank)

        // Restore cosine similarity score for display in LLM prompt (0 if only found via FTS)
        candidate.scoreSimilaridade = semanticScores.get(key) ?? 0

        return { candidate, rrfScore }
    })

    const results = rrfScored
        .sort((a, b) => b.rrfScore - a.rrfScore)
        .slice(0, MAX_CANDIDATES_TO_LLM)
        .map(({ candidate }) => candidate)

    console.log('[crossing:hybrid] RRF merged total:', results.length, 'for:', requisitoDescricao)
    return results
}

/**
 * Conversion table to a canonical base unit.
 * CAT extraction forces uppercase siglas (M, M2, M3, KG, UN, …).
 * Edital extraction may produce lowercase or accented variants (m², km, ton, …).
 * All entries map to the same uppercase sigla used by CATs.
 */
const UNIT_CONVERSIONS: Record<string, { factor: number; base: string }> = {
    // ── Length → M ────────────────────────────────────────────────────────────
    m: { factor: 1, base: 'M' },
    M: { factor: 1, base: 'M' },
    ml: { factor: 0.001, base: 'M' },   // milímetro linear (raro, mas existe)
    mm: { factor: 0.001, base: 'M' },
    MM: { factor: 0.001, base: 'M' },
    cm: { factor: 0.01, base: 'M' },
    CM: { factor: 0.01, base: 'M' },
    km: { factor: 1000, base: 'M' },
    KM: { factor: 1000, base: 'M' },
    // ── Area → M2 ─────────────────────────────────────────────────────────────
    'm2': { factor: 1, base: 'M2' },
    M2: { factor: 1, base: 'M2' },
    'm²': { factor: 1, base: 'M2' },
    'M²': { factor: 1, base: 'M2' },
    ha: { factor: 10_000, base: 'M2' },
    HA: { factor: 10_000, base: 'M2' },
    'km2': { factor: 1_000_000, base: 'M2' },
    KM2: { factor: 1_000_000, base: 'M2' },
    // ── Volume → M3 ───────────────────────────────────────────────────────────
    'm3': { factor: 1, base: 'M3' },
    M3: { factor: 1, base: 'M3' },
    'm³': { factor: 1, base: 'M3' },
    'M³': { factor: 1, base: 'M3' },
    l: { factor: 0.001, base: 'M3' },
    L: { factor: 0.001, base: 'M3' },
    lt: { factor: 0.001, base: 'M3' },
    LT: { factor: 0.001, base: 'M3' },
    // ── Mass → KG ─────────────────────────────────────────────────────────────
    kg: { factor: 1, base: 'KG' },
    KG: { factor: 1, base: 'KG' },
    g: { factor: 0.001, base: 'KG' },
    G: { factor: 0.001, base: 'KG' },
    ton: { factor: 1000, base: 'KG' },
    TON: { factor: 1000, base: 'KG' },
    t: { factor: 1000, base: 'KG' },   // tonelada métrica
    T: { factor: 1000, base: 'KG' },
    // ── Dimensionless / count — kept as-is ────────────────────────────────────
    un: { factor: 1, base: 'UN' },
    UN: { factor: 1, base: 'UN' },
    und: { factor: 1, base: 'UN' },
    UND: { factor: 1, base: 'UN' },
    unid: { factor: 1, base: 'UN' },
    UNID: { factor: 1, base: 'UN' },
}

/**
 * Convert a (value, unit) pair to its canonical base unit.
 * Returns null if value is null/0 or if the unit is unknown (non-convertible,
 * e.g. kV, MVA, VB — no conversion makes semantic sense for those).
 */
function normalizeToBaseUnit(
    value: number | null,
    unit: string | null,
): { value: number; baseUnit: string } | null {
    if (value == null || value <= 0) return null
    if (unit == null) return { value, baseUnit: 'UN' }

    const conv = UNIT_CONVERSIONS[unit.trim()]
    if (!conv) {
        // Unknown unit — keep original value and upper-cased unit for same-unit comparisons
        return { value, baseUnit: unit.trim().toUpperCase() }
    }
    return { value: value * conv.factor, baseUnit: conv.base }
}

/**
 * Sum candidate quantities after normalizing all to the same base unit.
 * Returns the total in the base unit (e.g. M, M2, KG) so it can be compared
 * directly against the normalized required quantity.
 */
function calculateCombinedQuantity(
    candidates: CandidateResult[],
): { totalQty: number | null; unit: string | null } {
    const normalized = candidates
        .map(c => normalizeToBaseUnit(c.quantitativo, c.unidade))
        .filter((n): n is { value: number; baseUnit: string } => n !== null)

    if (normalized.length === 0) return { totalQty: null, unit: null }

    // Group by base unit; pick the most frequent one to avoid summing incompatible units
    const byUnit = new Map<string, number>()
    for (const { value, baseUnit } of normalized) {
        byUnit.set(baseUnit, (byUnit.get(baseUnit) ?? 0) + value)
    }

    const unitCounts = new Map<string, number>()
    for (const { baseUnit } of normalized) {
        unitCounts.set(baseUnit, (unitCounts.get(baseUnit) ?? 0) + 1)
    }

    let bestUnit = ''
    let bestCount = 0
    for (const [u, count] of unitCounts) {
        if (count > bestCount) { bestCount = count; bestUnit = u }
    }

    return { totalQty: byUnit.get(bestUnit) ?? null, unit: bestUnit }
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

        // Attempt to create a Gemini context cache for the system prompt.
        // This reduces input token cost when the same system prompt is sent on every
        // per-requisito LLM call. Requires ≥32K tokens in cached content — for small
        // system prompts this will fail silently and fall back to standard callLlm.
        let crossingCacheName: string | null = null
        if (requisitos.length > 3) {
            try {
                crossingCacheName = await createLlmCache({
                    systemInstruction: CROSSING_SYSTEM_PROMPT,
                    ttlSeconds: 600,
                })
                console.log('[crossing:cache] Context cache created:', crossingCacheName)
            } catch {
                console.log('[crossing:cache] Cache creation skipped (content below minimum threshold)')
            }
        }

        // Process each requisito
        for (const requisito of requisitos) {
            // 1. Find candidates (hybrid: semantic + FTS in parallel, merged via RRF)
            const candidates = await findCandidatesHybrid(tenantId, requisito.servico)

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

                const response = crossingCacheName
                    ? await callLlmWithCache({
                        cacheName: crossingCacheName,
                        max_tokens: 2048,
                        messages: [{ role: 'user', content: userPrompt }],
                    })
                    : await callLlm({
                        max_tokens: 2048,
                        system: CROSSING_SYSTEM_PROMPT,
                        messages: [{ role: 'user', content: userPrompt }],
                    })

                totalInputTokens += response.usage.input_tokens
                totalOutputTokens += response.usage.output_tokens

                console.log('[crossing:llm] Raw LLM response for:', requisito.servico, '\n', response.text)

                const parsed = parseCrossingEvaluationsXml(response.text)

                // If LLM marked individual CATs as "atende" but resultado_geral as "gap",
                // override based on actual evaluations and combined quantity.
                // Both the required quantity (from edital) and the combined CAT quantity are
                // normalized to the same base unit before comparison to avoid false positives
                // from unit mismatches (e.g. edital: "5 km" vs CAT total: "3000 M").
                const atendeCount = parsed.avaliacoes.filter(a => a.avaliacaoLlm === 'atende').length
                const parcialCount = parsed.avaliacoes.filter(a => a.avaliacaoLlm === 'atende_parcialmente').length

                // Normalize the required quantity to the same base unit used by calculateCombinedQuantity
                const rawReqQty = requisito.quantidadeMinima ? parseFloat(requisito.quantidadeMinima) : null
                const reqNorm = normalizeToBaseUnit(rawReqQty, requisito.unidade ?? null)
                const reqQtyNorm = reqNorm?.value ?? null
                const reqUnitNorm = reqNorm?.baseUnit ?? null

                // Combined CAT quantity is already in base units (from calculateCombinedQuantity)
                // Only compare if both units resolved to the same base (e.g. both M, both KG).
                // If units are incompatible or unknown, skip the mathematical override and trust the LLM.
                const unitsCompatible = reqUnitNorm == null || combinedUnit == null || reqUnitNorm === combinedUnit

                let llmResultado = parsed.resultadoGeral.resultado
                let llmJustificativa = parsed.resultadoGeral.justificativa

                // Safety net: if CATs individually atende AND combined quantity meets minimum, override gap
                if (llmResultado === 'gap' && atendeCount > 0) {
                    if (reqQtyNorm == null || (totalQty != null && totalQty >= reqQtyNorm && unitsCompatible)) {
                        console.log(`[crossing:override] LLM said gap but ${atendeCount} CATs atende and qty ${totalQty} ${combinedUnit} >= ${reqQtyNorm} ${reqUnitNorm}. Overriding to atendido.`)
                        llmResultado = 'atendido'
                        llmJustificativa = `${atendeCount} CATs atendem ao núcleo do requisito. Quantitativo combinado: ${totalQty?.toFixed(2) ?? 'N/A'} ${combinedUnit ?? ''} (mínimo: ${reqQtyNorm?.toFixed(2) ?? 'N/A'} ${reqUnitNorm ?? ''}).`
                    } else if (unitsCompatible && totalQty != null && reqQtyNorm != null && totalQty >= reqQtyNorm * 0.5) {
                        console.log(`[crossing:override] LLM said gap but ${atendeCount} CATs atende and qty ${totalQty} ${combinedUnit} >= 50% of ${reqQtyNorm} ${reqUnitNorm}. Overriding to atendido_parcialmente.`)
                        llmResultado = 'atendido_parcialmente'
                        llmJustificativa = `${atendeCount} CATs atendem ao serviço, mas quantitativo combinado (${totalQty.toFixed(2)} ${combinedUnit ?? ''}) está abaixo do mínimo exigido (${reqQtyNorm.toFixed(2)} ${reqUnitNorm ?? ''}).`
                    }
                }

                // Same for atendido_parcialmente when combined qty fully meets requirement
                if (llmResultado === 'atendido_parcialmente' && atendeCount > 0 && unitsCompatible && reqQtyNorm != null && totalQty != null && totalQty >= reqQtyNorm) {
                    console.log(`[crossing:override] LLM said parcial but qty ${totalQty} ${combinedUnit} >= ${reqQtyNorm} ${reqUnitNorm}. Overriding to atendido.`)
                    llmResultado = 'atendido'
                    llmJustificativa = `${atendeCount} CATs atendem ao núcleo do requisito. Quantitativo combinado: ${totalQty.toFixed(2)} ${combinedUnit ?? ''} (mínimo: ${reqQtyNorm.toFixed(2)} ${reqUnitNorm ?? ''}).`
                }

                resultado = llmResultado
                justificativa = llmJustificativa

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

            const recResponse = crossingCacheName
                ? await callLlmWithCache({
                    cacheName: crossingCacheName,
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: recPrompt }],
                })
                : await callLlm({
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
