// Re-exporta funções puras de acesso ao PNCP de @licitacat/shared/pncp
// Funções específicas da API (que dependem de S3/AI) permanecem aqui
export {
  searchPncp,
  getPncpDetalhe,
  getPncpItens,
  getPncpArquivos,
  MODALIDADES_VALIDAS,
} from '@licitacat/shared/pncp'
export type {
  PncpBuscarParams,
  PncpContratacao,
  PncpDetalhe,
  PncpItem,
  PncpArquivo,
  PncpSearchResult,
} from '@licitacat/shared/pncp'

// ─── Funções específicas da API (dependem de storage/S3) ──────────────────

export async function downloadPncpFile(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { Accept: '*/*' },
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) throw new Error(`PNCP download falhou: ${response.status} ${response.statusText}`)
  return Buffer.from(await response.arrayBuffer())
}

export function isZipBuffer(buffer: Buffer): boolean {
  return buffer.length >= 4 &&
    buffer[0] === 0x50 && buffer[1] === 0x4B &&
    buffer[2] === 0x03 && buffer[3] === 0x04
}

import type { PncpArquivo as _PncpArquivo } from '@licitacat/shared/pncp'
export function findMainArquivo(arquivos: _PncpArquivo[]): _PncpArquivo | undefined {
  return arquivos.find(a => a.statusAtivo && /edital/i.test(a.tipoDocumentoNome))
    ?? arquivos.find(a => a.statusAtivo)
    ?? arquivos[0]
}

import type { PncpContratacao as _PncpContratacao } from '@licitacat/shared/pncp'
function mapModalidade(modalidadeNome: string): string {
  const n = modalidadeNome.toLowerCase()
  if (n.includes('pregão') && n.includes('eletrônico')) return 'pregao_eletronico'
  if (n.includes('pregão') && n.includes('presencial')) return 'pregao_presencial'
  if (n.includes('concorrência')) return 'concorrencia'
  if (n.includes('concurso')) return 'concurso'
  if (n.includes('convite')) return 'convite'
  if (n.includes('tomada de preços')) return 'tomada_de_precos'
  if (n.includes('leilão')) return 'leilao'
  if (n.includes('credenciamento')) return 'credenciamento'
  return 'outro'
}

export function mapPncpToEditalData(item: _PncpContratacao & { orgaoEntidade?: { cnpj?: string; nome?: string; razaoSocial?: string } }) {
  const numeroEdital = `${item.anoCompra}/${item.sequencialCompra}`
  return {
    fileName: `PNCP-${item.anoCompra}-${item.sequencialCompra}`,
    fileUrl: item.linkSistemaOrigem ?? '',
    orgaoLicitante: item.orgaoEntidade?.razaoSocial ?? item.orgaoEntidade?.nome ?? '',
    numeroEdital,
    modalidade: mapModalidade(item.modalidadeNome) as
      | 'pregao_eletronico'
      | 'pregao_presencial'
      | 'concorrencia'
      | 'tomada_de_precos'
      | 'convite'
      | 'leilao'
      | 'concurso'
      | 'rdc'
      | 'credenciamento'
      | 'outro',
    objeto: item.objetoCompra,
    valorEstimado: item.valorTotalEstimado != null ? String(item.valorTotalEstimado) : null,
    dataAbertura: item.dataPublicacaoPncp ? new Date(item.dataPublicacaoPncp) : null,
    uasg: item.orgaoEntidade?.cnpj ?? null,
  }
}
