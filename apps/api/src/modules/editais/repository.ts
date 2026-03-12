import { db } from '@licitacat/db'
import {
  editais,
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
import { eq, and, desc, count } from 'drizzle-orm'
import type { UpdateEditalInput } from '@licitacat/shared/schemas'

export async function listEditais(
  tenantId: string,
  page: number,
  limit: number,
  status?: string,
) {
  const offset = (page - 1) * limit
  const whereClause = status
    ? and(eq(editais.tenantId, tenantId), eq(editais.status, status as typeof editais.status._.data))
    : eq(editais.tenantId, tenantId)

  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(editais)
      .where(whereClause)
      .orderBy(desc(editais.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(editais).where(whereClause),
  ])

  return {
    data: rows,
    total: total?.count ?? 0,
    page,
    limit,
  }
}

export async function findEditalById(tenantId: string, editalId: string) {
  return db.query.editais.findFirst({
    where: and(eq(editais.id, editalId), eq(editais.tenantId, tenantId)),
  })
}

export async function updateEdital(
  tenantId: string,
  editalId: string,
  data: UpdateEditalInput,
) {
  const { valorEstimado, ...rest } = data
  const [updated] = await db
    .update(editais)
    .set({
      ...rest,
      ...(valorEstimado !== undefined ? { valorEstimado: valorEstimado.toFixed(2) } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(editais.id, editalId), eq(editais.tenantId, tenantId)))
    .returning()
  return updated
}

export async function deleteEdital(tenantId: string, editalId: string) {
  const [deleted] = await db
    .delete(editais)
    .where(and(eq(editais.id, editalId), eq(editais.tenantId, tenantId)))
    .returning()
  return deleted
}

export async function findEditalHabilitacao(tenantId: string, editalId: string) {
  const [
    habilitacaoJuridica,
    regularidadeFiscal,
    qualificacaoTecnica,
    profissionais,
    parcelasRelevancia,
    atestadosProfissionais,
    qualificacaoFinanceira,
    declaracoes,
    declaracoesEspeciais,
    alertas,
    anexosReferenciados,
  ] = await Promise.all([
    db.select().from(reqHabilitacaoJuridica).where(
      and(eq(reqHabilitacaoJuridica.tenantId, tenantId), eq(reqHabilitacaoJuridica.editalId, editalId)),
    ),
    db.select().from(reqRegularidadeFiscal).where(
      and(eq(reqRegularidadeFiscal.tenantId, tenantId), eq(reqRegularidadeFiscal.editalId, editalId)),
    ),
    db.query.reqQualificacaoTecnica.findFirst({
      where: and(eq(reqQualificacaoTecnica.tenantId, tenantId), eq(reqQualificacaoTecnica.editalId, editalId)),
    }),
    db.select().from(reqProfissionais).where(
      and(eq(reqProfissionais.tenantId, tenantId), eq(reqProfissionais.editalId, editalId)),
    ),
    db.select().from(reqParcelasRelevancia).where(
      and(eq(reqParcelasRelevancia.tenantId, tenantId), eq(reqParcelasRelevancia.editalId, editalId)),
    ),
    db.select().from(reqAtestadosProfissionais).where(
      and(eq(reqAtestadosProfissionais.tenantId, tenantId), eq(reqAtestadosProfissionais.editalId, editalId)),
    ),
    db.query.reqQualificacaoFinanceira.findFirst({
      where: and(eq(reqQualificacaoFinanceira.tenantId, tenantId), eq(reqQualificacaoFinanceira.editalId, editalId)),
    }),
    db.select().from(reqDeclaracoes).where(
      and(eq(reqDeclaracoes.tenantId, tenantId), eq(reqDeclaracoes.editalId, editalId)),
    ),
    db.select().from(reqDeclaracoesEspeciais).where(
      and(eq(reqDeclaracoesEspeciais.tenantId, tenantId), eq(reqDeclaracoesEspeciais.editalId, editalId)),
    ),
    db.select().from(reqAlertas).where(
      and(eq(reqAlertas.tenantId, tenantId), eq(reqAlertas.editalId, editalId)),
    ).orderBy(reqAlertas.nivel),
    db.select().from(reqAnexosReferenciados).where(
      and(eq(reqAnexosReferenciados.tenantId, tenantId), eq(reqAnexosReferenciados.editalId, editalId)),
    ),
  ])

  return {
    habilitacaoJuridica,
    regularidadeFiscal,
    qualificacaoTecnica: qualificacaoTecnica ?? null,
    profissionais,
    parcelasRelevancia,
    atestadosProfissionais,
    qualificacaoFinanceira: qualificacaoFinanceira ?? null,
    declaracoes,
    declaracoesEspeciais,
    alertas,
    anexosReferenciados,
  }
}
