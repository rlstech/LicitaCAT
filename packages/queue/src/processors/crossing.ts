import { Worker, type Job } from 'bullmq'
import { db } from '@licitacat/db'
import {
    crossings,
    crossingItems,
    crossingItemCats,
    processingJobs,
    editalRequisitos,
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
const TOP_K_CANDIDATES = 5
const SIMILARITY_THRESHOLD = 0.3

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
}

async function findSemanticCandidates(
    tenantId: string,
    requisitoDescricao: string,
): Promise<CandidateResult[]> {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(requisitoDescricao, 'query')
    const embeddingStr = `[${queryEmbedding.embedding.join(',')}]`

    // Search CAT descriptions via pgvector
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

    // Search CAT item descriptions via pgvector
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

    // Merge and deduplicate by cat_id+cat_item_id, keeping highest score
    const seen = new Map<string, CandidateResult>()

    for (const row of [...(catResults.rows ?? []), ...(itemResults.rows ?? [])]) {
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

    return Array.from(seen.values())
        .sort((a, b) => b.scoreSimilaridade - a.scoreSimilaridade)
        .slice(0, TOP_K_CANDIDATES)
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

        // Fetch all approved requisitos for this edital
        const requisitos = await db
            .select()
            .from(editalRequisitos)
            .where(
                and(
                    eq(editalRequisitos.tenantId, tenantId),
                    eq(editalRequisitos.editalId, editalId),
                    sql`${editalRequisitos.status} IN ('ai_extracted', 'human_approved', 'human_edited')`,
                ),
            )

        await db
            .update(crossings)
            .set({ totalRequisitos: requisitos.length })
            .where(eq(crossings.id, crossingId))

        // Process each requisito
        for (const requisito of requisitos) {
            // 1. Find semantic candidates
            const candidates = await findSemanticCandidates(tenantId, requisito.descricao)

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
                // 2. Ask LLM to evaluate
                const userPrompt = buildCrossingItemPrompt(
                    {
                        descricao: requisito.descricao,
                        quantitativoExigido: requisito.quantitativoExigido ? parseFloat(requisito.quantitativoExigido) : null,
                        unidade: requisito.unidade,
                    },
                    candidates,
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

            // 3. Insert crossing_item
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

            // 4. Insert crossing_item_cats
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
                gapDescriptions.push(requisito.descricao.slice(0, 200))
            }
        }

        // 5. Calculate adherence score
        const totalReqs = requisitos.length
        const scoreAderencia = totalReqs > 0
            ? Math.round(((atendidos + parciais * 0.5) / totalReqs) * 100)
            : 0

        // 6. Get recommendation from LLM
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

        // 7. Update crossing with final results
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
