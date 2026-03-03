/**
 * XML parser utilities for Claude LLM responses.
 * Uses regex-based extraction for structured XML tags returned by prompts.
 */

export interface ParsedRequisito {
  lote: string | null
  categoria: string
  descricao: string
  trechoOriginal: string | null
  paginaReferencia: number | null
  quantitativoExigido: number | null
  unidade: string | null
  aiConfidenceScore: number
}

export interface ParsedEditalMetadata {
  orgaoLicitante: string | null
  numeroEdital: string | null
  modalidade: string | null
  objeto: string | null
  valorEstimado: number | null
  dataAbertura: string | null
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i')
  const match = regex.exec(xml)
  if (!match?.[1]) return null
  const value = match[1].trim()
  if (value === '' || value.toLowerCase() === 'null') return null
  return value
}

function extractAllBlocks(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'gi')
  const blocks: string[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(xml)) !== null) {
    if (match[1]) {
      blocks.push(match[1].trim())
    }
  }

  return blocks
}

const VALID_CATEGORIAS = new Set([
  'qualificacao_tecnica',
  'qualificacao_economica',
  'regularidade_fiscal',
  'habilitacao_juridica',
  'outro',
])

const VALID_MODALIDADES = new Set([
  'pregao_eletronico',
  'pregao_presencial',
  'concorrencia',
  'tomada_de_precos',
  'convite',
  'leilao',
  'concurso',
  'rdc',
  'credenciamento',
  'outro',
])

export function parseEditalRequisitosXml(xml: string): ParsedRequisito[] {
  const requisitoBlocks = extractAllBlocks(xml, 'requisito')
  const requisitos: ParsedRequisito[] = []

  for (const block of requisitoBlocks) {
    const descricao = extractTag(block, 'descricao')
    if (!descricao) continue // Skip requisitos without description

    const categoriaRaw = extractTag(block, 'categoria') ?? 'qualificacao_tecnica'
    const categoria = VALID_CATEGORIAS.has(categoriaRaw) ? categoriaRaw : 'outro'

    const paginaStr = extractTag(block, 'pagina_referencia')
    const paginaReferencia = paginaStr ? parseInt(paginaStr, 10) : null

    const quantStr = extractTag(block, 'quantitativo_exigido')
    const quantitativoExigido = quantStr ? parseFloat(quantStr.replace(/[^\d.,\-]/g, '').replace(',', '.')) : null

    const scoreStr = extractTag(block, 'ai_confidence_score')
    let aiConfidenceScore = scoreStr ? parseInt(scoreStr, 10) : 50
    if (isNaN(aiConfidenceScore) || aiConfidenceScore < 0) aiConfidenceScore = 0
    if (aiConfidenceScore > 100) aiConfidenceScore = 100

    requisitos.push({
      lote: extractTag(block, 'lote'),
      categoria,
      descricao,
      trechoOriginal: extractTag(block, 'trecho_original'),
      paginaReferencia: paginaReferencia && !isNaN(paginaReferencia) ? paginaReferencia : null,
      quantitativoExigido: quantitativoExigido && !isNaN(quantitativoExigido) ? quantitativoExigido : null,
      unidade: extractTag(block, 'unidade'),
      aiConfidenceScore,
    })
  }

  return requisitos
}

export function parseEditalMetadataXml(xml: string): ParsedEditalMetadata {
  const modalidadeRaw = extractTag(xml, 'modalidade')
  const modalidade = modalidadeRaw && VALID_MODALIDADES.has(modalidadeRaw) ? modalidadeRaw : null

  const valorStr = extractTag(xml, 'valor_estimado')
  const valorEstimado = valorStr
    ? parseFloat(valorStr.replace(/[^\d.,\-]/g, '').replace(',', '.'))
    : null

  return {
    orgaoLicitante: extractTag(xml, 'orgao_licitante'),
    numeroEdital: extractTag(xml, 'numero_edital'),
    modalidade,
    objeto: extractTag(xml, 'objeto'),
    valorEstimado: valorEstimado && !isNaN(valorEstimado) ? valorEstimado : null,
    dataAbertura: extractTag(xml, 'data_abertura'),
  }
}
