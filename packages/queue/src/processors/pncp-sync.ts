import { Worker, type Job } from 'bullmq'
import { db } from '@licitacat/db'
import { pncpCache, pncpSyncConfig } from '@licitacat/db/schema'
import {
  searchPncp,
  MODALIDADES_VALIDAS,
  type PncpContratacao,
} from '@licitacat/shared/pncp'
import { eq, sql } from 'drizzle-orm'
import type { PncpSyncJobData } from '../queues/index.js'
import type { NewPncpCacheRecord } from '@licitacat/db/schema'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port ?? '6379', 10),
}

const PNCP_PAGE_SIZE = 50
const MAX_PAGES_PER_PAIR = 200  // cap de segurança: 10.000 registros por (uf, modalidade)

function formatPncpDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function subDays(d: Date, days: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() - days)
  return result
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() + days)
  return result
}

function mapToCache(item: PncpContratacao, uf: string): NewPncpCacheRecord {
  return {
    anoCompra:           item.anoCompra,
    sequencialCompra:    String(item.sequencialCompra),
    cnpjOrgao:           item.orgaoEntidade.cnpj,
    uf,
    codigoMunicipioIbge: null,  // API de busca não retorna código IBGE, apenas nome
    nomeMunicipio:       item.unidadeOrgao?.municipioNome ?? null,
    razaoSocial:         item.orgaoEntidade.razaoSocial ?? item.orgaoEntidade.nome ?? null,
    codigoModalidade:    item.modalidadeId,
    modalidadeNome:      item.modalidadeNome,
    objeto:              item.objetoCompra,
    valorTotalEstimado:  item.valorTotalEstimado != null ? String(item.valorTotalEstimado) : null,
    dataPublicacaoPncp:  item.dataPublicacaoPncp.slice(0, 10),
    dataAberturaProposta: item.dataAberturaProposta ? new Date(item.dataAberturaProposta) : null,
    situacaoCompraId:    item.situacaoCompraId ?? null,
    situacaoCompraNome:  item.situacaoCompraNome,
    linkSistemaOrigem:   item.linkSistemaOrigem ?? null,
    rawData:             item as unknown as Record<string, unknown>,
  }
}

const UPSERT_SET = {
  objeto:               sql`excluded.objeto`,
  valorTotalEstimado:   sql`excluded.valor_total_estimado`,
  dataAberturaProposta: sql`excluded.data_abertura_proposta`,
  situacaoCompraId:     sql`excluded.situacao_compra_id`,
  situacaoCompraNome:   sql`excluded.situacao_compra_nome`,
  rawData:              sql`excluded.raw_data`,
  syncedAt:             sql`NOW()`,
}

async function syncPairs(
  job: Job<PncpSyncJobData>,
  tipo: 'publicacao' | 'proposta',
  ufs: string[],
  modalidades: number[],
  dataInicial: string,
  dataFinal: string,
): Promise<number> {
  let totalUpserted = 0

  for (const uf of ufs) {
    for (const modalidade of modalidades) {
      let pagina = 1
      let hasMore = true

      while (hasMore && pagina <= MAX_PAGES_PER_PAIR) {
        let result
        try {
          result = await searchPncp({
            tipo,
            dataInicial,
            dataFinal,
            ufs: [uf],
            codigoModalidadeContratacao: modalidade,
            pagina,
            tamanhoPagina: PNCP_PAGE_SIZE,
          })
        } catch (err) {
          console.warn(`[pncp-sync] Timeout/erro tipo=${tipo} uf=${uf} modalidade=${modalidade} pagina=${pagina}:`, err instanceof Error ? err.message : err)
          break
        }

        if (result.empty || result.data.length === 0) break

        const records = result.data.map(item => mapToCache(item, uf))
        await db.insert(pncpCache)
          .values(records)
          .onConflictDoUpdate({
            target: [pncpCache.anoCompra, pncpCache.sequencialCompra, pncpCache.cnpjOrgao],
            set: UPSERT_SET,
          })

        totalUpserted += records.length
        await job.updateProgress(Math.min(99, Math.round((totalUpserted / 100) * 10)))

        hasMore = pagina < result.totalPaginas
        pagina++
      }
    }
  }

  return totalUpserted
}

async function processPncpSync(job: Job<PncpSyncJobData>): Promise<void> {
  const { configId } = job.data

  // 1. Carregar configuração
  const config = await db.query.pncpSyncConfig.findFirst({
    where: eq(pncpSyncConfig.id, configId),
  })
  if (!config || !config.isActive) return

  // 2. Marcar como running
  await db.update(pncpSyncConfig)
    .set({ lastSyncStatus: 'running', lastSyncJobId: job.id ?? null, updatedAt: new Date() })
    .where(eq(pncpSyncConfig.id, configId))

  try {
    const modalidades = (config.modalidades?.length ?? 0) > 0
      ? (config.modalidades as number[])
      : MODALIDADES_VALIDAS

    const ufs = (config.ufs as string[]) ?? []
    if (ufs.length === 0) {
      await db.update(pncpSyncConfig)
        .set({ lastSyncStatus: 'completed', lastSyncedAt: new Date(), recordsSynced: 0, updatedAt: new Date() })
        .where(eq(pncpSyncConfig.id, configId))
      return
    }

    const now = new Date()

    // Passagem 1: publicacao — editais publicados recentemente
    const dataFinalPub   = formatPncpDate(now)
    const since          = config.lastSyncedAt ?? subDays(now, config.retentionDays)
    const dataInicialPub = formatPncpDate(since)
    console.log(`[pncp-sync] Passagem 1 (publicacao): ${dataInicialPub} → ${dataFinalPub}`)
    const upserted1 = await syncPairs(job, 'publicacao', ufs, modalidades, dataInicialPub, dataFinalPub)

    // Passagem 2: proposta — editais com sessão abertura em -30d a +60d
    // Captura editais publicados há muito tempo mas com sessão futura/recente
    const dataInicialProp = formatPncpDate(subDays(now, 30))
    const dataFinalProp   = formatPncpDate(addDays(now, 60))
    console.log(`[pncp-sync] Passagem 2 (proposta): ${dataInicialProp} → ${dataFinalProp}`)
    const upserted2 = await syncPairs(job, 'proposta', ufs, modalidades, dataInicialProp, dataFinalProp)

    const totalUpserted = upserted1 + upserted2
    console.log(`[pncp-sync] Concluído: ${upserted1} pub + ${upserted2} prop = ${totalUpserted} registros`)

    // 6. Marcar concluído
    await db.update(pncpSyncConfig)
      .set({
        lastSyncStatus:  'completed',
        lastSyncedAt:    new Date(),
        recordsSynced:   totalUpserted,
        lastSyncError:   null,
        updatedAt:       new Date(),
      })
      .where(eq(pncpSyncConfig.id, configId))

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido'
    await db.update(pncpSyncConfig)
      .set({ lastSyncStatus: 'failed', lastSyncError: msg, updatedAt: new Date() })
      .where(eq(pncpSyncConfig.id, configId))
    throw error
  }
}

export function createPncpSyncWorker(): Worker<PncpSyncJobData> {
  return new Worker<PncpSyncJobData>('pncp_sync', processPncpSync, {
    connection,
    concurrency: 1,           // um sync por vez para não sobrecarregar o PNCP
    lockDuration: 300000,     // 5 min de lock — sync pode demorar vários minutos
    lockRenewTime: 120000,    // renova o lock a cada 2 min
  })
}
