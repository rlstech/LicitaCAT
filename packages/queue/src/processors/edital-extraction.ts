import { Worker, type Job } from 'bullmq'
import { db } from '@licitacat/db'
import {
    editais,
    processingJobs,
    reqHabilitacaoJuridica,
    reqRegularidadeFiscal,
    reqQualificacaoTecnica,
    reqProfissionais,
    reqParcelasRelevancia,
    reqAtestadosProfissionais,
    reqQualificacaoFinanceira,
    reqDeclaracoes,
    reqDeclaracoesEspeciais,
    reqAlertas,
    reqAnexosReferenciados,
} from '@licitacat/db/schema'
import { extractEditalFromPdf } from '@licitacat/ai/llm'
import {
    EDITAL_EXTRACTION_SYSTEM_PROMPT,
    buildEditalExtractionUserPrompt,
} from '@licitacat/ai/prompts'
import { downloadFromS3 } from '@licitacat/ai/storage'
import { EditalExtractionResponseSchema } from '@licitacat/shared/schemas'
import { eq } from 'drizzle-orm'
import type { EditalExtractionJobData } from '../queues/index.js'
import { embeddingGenQueue } from '../queues/index.js'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'

const connection = {
    host: new URL(REDIS_URL).hostname,
    port: parseInt(new URL(REDIS_URL).port ?? '6379', 10),
}

async function processEditalExtraction(
    job: Job<EditalExtractionJobData>,
): Promise<void> {
    const { tenantId, editalId, jobId, fileUrl } = job.data

    await db
        .update(processingJobs)
        .set({ status: 'running', startedAt: new Date() })
        .where(eq(processingJobs.id, jobId))

    try {
        // 1. Update status to extracting
        await db
            .update(editais)
            .set({ status: 'extracting' })
            .where(eq(editais.id, editalId))

        // 2. Download PDF from S3
        const pdfBuffer = await downloadFromS3(fileUrl)

        // 3. Call Claude with native PDF
        const userPrompt = buildEditalExtractionUserPrompt()
        const { json, inputTokens, outputTokens, costUsd } = await extractEditalFromPdf(
            pdfBuffer,
            EDITAL_EXTRACTION_SYSTEM_PROMPT,
            userPrompt,
        )

        // 4. Validate response
        const parsed = EditalExtractionResponseSchema.safeParse(json)
        if (!parsed.success) {
            throw new Error(`Invalid extraction response: ${parsed.error.message}`)
        }
        const data = parsed.data
        const meta = data.metadata

        // 5. Update editais with extracted metadata
        await db
            .update(editais)
            .set({
                orgaoLicitante: meta.orgaoLicitante ?? null,
                uasg: meta.uasg ?? null,
                numeroEdital: meta.numeroEdital ?? null,
                modalidade: meta.modalidade as typeof editais._.columns.modalidade._.data | null,
                objeto: meta.objeto ?? null,
                valorEstimado: meta.valorEstimado != null ? meta.valorEstimado.toFixed(2) : null,
                dataAbertura: meta.dataAbertura ? new Date(meta.dataAbertura) : null,
                regimeExecucao: meta.regimeExecucao ?? null,
                criterioJulgamento: meta.criterioJulgamento ?? null,
                prazoExecucaoMeses: meta.prazoExecucaoMeses ?? null,
                leiRegente: meta.leiRegente ?? null,
                admiteConsorcio: meta.admiteConsorcio ?? null,
                exigeSubcontratacao: meta.exigeSubcontratacao ?? false,
                subcontratacaoPercentualMax: meta.subcontratacaoPercentualMax != null
                    ? meta.subcontratacaoPercentualMax.toFixed(2)
                    : null,
                trataFavorecidoMeEpp: meta.trataFavorecidoMeEpp ?? false,
                sicafSubstituiDocumentos: meta.sicafSubstituiDocumentos ?? false,
                observacoesExtraidas: meta.observacoesExtraidas ?? null,
            })
            .where(eq(editais.id, editalId))

        // 6. Insert into 11 specialized tables in parallel
        await Promise.all([
            // Habilitação Jurídica
            data.habilitacaoJuridica.length > 0
                ? db.insert(reqHabilitacaoJuridica).values(
                    data.habilitacaoJuridica.map((item) => ({
                        tenantId,
                        editalId,
                        documento: item.documento,
                        aplicaA: item.aplicaA ?? null,
                        observacao: item.observacao ?? null,
                    })),
                )
                : Promise.resolve(),

            // Regularidade Fiscal
            data.regularidadeFiscal.length > 0
                ? db.insert(reqRegularidadeFiscal).values(
                    data.regularidadeFiscal.map((item) => ({
                        tenantId,
                        editalId,
                        documento: item.documento,
                        sigla: item.sigla ?? null,
                        validadeDias: item.validadeDias ?? null,
                        observacao: item.observacao ?? null,
                    })),
                )
                : Promise.resolve(),

            // Qualificação Técnica (1:1)
            data.qualificacaoTecnica
                ? db.insert(reqQualificacaoTecnica).values({
                    tenantId,
                    editalId,
                    registroConselho: data.qualificacaoTecnica.registroConselho ?? null,
                    exigeVisitaTecnica: data.qualificacaoTecnica.exigeVisitaTecnica ?? false,
                    visitaTipo: data.qualificacaoTecnica.visitaTipo ?? null,
                    exigeEscritorioLocal: data.qualificacaoTecnica.exigeEscritorioLocal ?? false,
                    escritorioDescricao: data.qualificacaoTecnica.escritorioDescricao ?? null,
                }).onConflictDoNothing()
                : Promise.resolve(),

            // Profissionais
            data.profissionais.length > 0
                ? db.insert(reqProfissionais).values(
                    data.profissionais.map((item) => ({
                        tenantId,
                        editalId,
                        cargo: item.cargo,
                        conselho: item.conselho ?? null,
                        quantidade: item.quantidade ?? null,
                        cbo: item.cbo ?? null,
                        observacao: item.observacao ?? null,
                    })),
                )
                : Promise.resolve(),

            // Atestados de Profissionais
            data.atestadosProfissionais.length > 0
                ? db.insert(reqAtestadosProfissionais).values(
                    data.atestadosProfissionais.map((item) => ({
                        tenantId,
                        editalId,
                        profissional: item.profissional,
                        caracteristicasExigidas: item.caracteristicasExigidas ?? null,
                        exigeCat: item.exigeCat ?? false,
                        observacao: item.observacao ?? null,
                    })),
                )
                : Promise.resolve(),

            // Qualificação Financeira (1:1)
            data.qualificacaoFinanceira
                ? db.insert(reqQualificacaoFinanceira).values({
                    tenantId,
                    editalId,
                    exigeBalanco: data.qualificacaoFinanceira.exigeBalanco ?? false,
                    balancoExercicios: data.qualificacaoFinanceira.balancoExercicios ?? null,
                    patrimonioLiquidoMinimo: data.qualificacaoFinanceira.patrimonioLiquidoMinimo != null
                        ? data.qualificacaoFinanceira.patrimonioLiquidoMinimo.toFixed(2)
                        : null,
                    patrimonioPercentualContrato: data.qualificacaoFinanceira.patrimonioPercentualContrato != null
                        ? data.qualificacaoFinanceira.patrimonioPercentualContrato.toFixed(2)
                        : null,
                    lcMinimo: data.qualificacaoFinanceira.lcMinimo != null
                        ? data.qualificacaoFinanceira.lcMinimo.toFixed(2)
                        : null,
                    lgMinimo: data.qualificacaoFinanceira.lgMinimo != null
                        ? data.qualificacaoFinanceira.lgMinimo.toFixed(2)
                        : null,
                    sgMinimo: data.qualificacaoFinanceira.sgMinimo != null
                        ? data.qualificacaoFinanceira.sgMinimo.toFixed(2)
                        : null,
                    exigeCertidaoFalencia: data.qualificacaoFinanceira.exigeCertidaoFalencia ?? false,
                    certidaoFalenciaPrazoDias: data.qualificacaoFinanceira.certidaoFalenciaPrazoDias ?? null,
                    exigeCapitalSocialMinimo: data.qualificacaoFinanceira.exigeCapitalSocialMinimo ?? false,
                    capitalSocialMinimo: data.qualificacaoFinanceira.capitalSocialMinimo != null
                        ? data.qualificacaoFinanceira.capitalSocialMinimo.toFixed(2)
                        : null,
                    exigeGarantiaProposta: data.qualificacaoFinanceira.exigeGarantiaProposta ?? false,
                    garantiaPropostaPercentual: data.qualificacaoFinanceira.garantiaPropostaPercentual != null
                        ? data.qualificacaoFinanceira.garantiaPropostaPercentual.toFixed(2)
                        : null,
                    observacao: data.qualificacaoFinanceira.observacao ?? null,
                }).onConflictDoNothing()
                : Promise.resolve(),

            // Declarações
            data.declaracoes.length > 0
                ? db.insert(reqDeclaracoes).values(
                    data.declaracoes.map((item) => ({
                        tenantId,
                        editalId,
                        descricao: item.descricao,
                        baseLegal: item.baseLegal ?? null,
                        leiEstadual: item.leiEstadual ?? false,
                        penalidadeOmissao: item.penalidadeOmissao ?? null,
                    })),
                )
                : Promise.resolve(),

            // Declarações Especiais
            data.declaracoesEspeciais.length > 0
                ? db.insert(reqDeclaracoesEspeciais).values(
                    data.declaracoesEspeciais.map((item) => ({
                        tenantId,
                        editalId,
                        descricao: item.descricao,
                        lei: item.lei ?? null,
                        uf: item.uf ?? null,
                    })),
                )
                : Promise.resolve(),

            // Alertas
            data.alertas.length > 0
                ? db.insert(reqAlertas).values(
                    data.alertas.map((item) => ({
                        tenantId,
                        editalId,
                        nivel: item.nivel,
                        categoria: item.categoria ?? null,
                        descricao: item.descricao,
                    })),
                )
                : Promise.resolve(),

            // Anexos Referenciados
            data.anexosReferenciados.length > 0
                ? db.insert(reqAnexosReferenciados).values(
                    data.anexosReferenciados.map((item) => ({
                        tenantId,
                        editalId,
                        identificacao: item.identificacao,
                        descricao: item.descricao ?? null,
                    })),
                )
                : Promise.resolve(),
        ])

        // 7. Insert parcelas de relevância and enqueue embeddings
        if (data.parcelasRelevancia.length > 0) {
            const insertedParcelas = await db
                .insert(reqParcelasRelevancia)
                .values(
                    data.parcelasRelevancia.map((item) => ({
                        tenantId,
                        editalId,
                        servico: item.servico,
                        unidade: item.unidade ?? null,
                        quantidadeMinima: item.quantidadeMinima != null
                            ? item.quantidadeMinima.toFixed(4)
                            : null,
                        observacao: item.observacao ?? null,
                    })),
                )
                .returning()

            for (const parcela of insertedParcelas) {
                const [embJob] = await db
                    .insert(processingJobs)
                    .values({
                        tenantId,
                        jobType: 'embedding_gen',
                        entityType: 'edital',
                        entityId: parcela.id,
                        status: 'queued',
                    })
                    .returning()

                if (embJob) {
                    await embeddingGenQueue.add('embedding_gen', {
                        tenantId,
                        entityType: 'parcela_relevancia',
                        entityId: parcela.id,
                        text: parcela.servico,
                        jobId: embJob.id,
                    })
                }
            }
        }

        // 8. Update edital status and cost
        await db
            .update(editais)
            .set({
                status: 'review_pending',
                aiExtractionCostUsd: costUsd.toFixed(6),
            })
            .where(eq(editais.id, editalId))

        await db
            .update(processingJobs)
            .set({
                status: 'completed',
                completedAt: new Date(),
                costUsd: costUsd.toFixed(6),
            })
            .where(eq(processingJobs.id, jobId))
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        const currentJob = await db.query.processingJobs.findFirst({
            where: eq(processingJobs.id, jobId),
        })

        const attemptCount = (currentJob?.attemptCount ?? 0) + 1
        const status = attemptCount >= 3 ? 'failed' : 'retrying'

        await db
            .update(processingJobs)
            .set({ status, errorMessage, attemptCount })
            .where(eq(processingJobs.id, jobId))

        if (status === 'failed') {
            await db
                .update(editais)
                .set({ status: 'error' })
                .where(eq(editais.id, editalId))
        }

        throw error
    }
}

export function createEditalExtractionWorker(): Worker<EditalExtractionJobData> {
    return new Worker<EditalExtractionJobData>(
        'edital_extraction',
        processEditalExtraction,
        {
            connection,
            concurrency: 2,
        },
    )
}
