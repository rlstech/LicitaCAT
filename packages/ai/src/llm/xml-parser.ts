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
  referenciaAnexo: string | null
  aiConfidenceScore: number
}

export interface ParsedEditalMetadata {
  orgaoLicitante: string | null
  numeroEdital: string | null
  modalidade: string | null
  objeto: string | null
  valorEstimado: number | null
  dataAbertura: string | null
  regimeExecucao: string | null
  prazoExecucao: string | null
  leiRegente: string | null
  admiteConsorcio: string | null
  exigeSubcontratacao: string | null
  exigeVisitaTecnica: string | null
}

/**
 * Parses a numeric string that may be in Brazilian format (1.234,56)
 * or US/international format (1234.56 or 1,234.56).
 *
 * Rules:
 *  - Both '.' and ',' present AND last separator is ',' → BR format: remove dots, replace comma with dot
 *  - Both '.' and ',' present AND last separator is '.' → US format: remove commas
 *  - Only ',' present → decimal comma: replace with dot
 *  - Only '.' present → standard decimal: use as-is
 */
function parseNumericBR(str: string): number | null {
  const cleaned = str.replace(/[^\d.,\-]/g, '').trim()
  if (!cleaned) return null

  const hasDot = cleaned.includes('.')
  const hasComma = cleaned.includes(',')

  let normalized: string

  if (hasDot && hasComma) {
    const lastDot = cleaned.lastIndexOf('.')
    const lastComma = cleaned.lastIndexOf(',')
    if (lastComma > lastDot) {
      // BR format: 10.025,65 → remove dots → replace comma with dot
      normalized = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      // US format: 10,025.65 → remove commas
      normalized = cleaned.replace(/,/g, '')
    }
  } else if (hasComma && !hasDot) {
    normalized = cleaned.replace(',', '.')
  } else {
    normalized = cleaned
  }

  const num = parseFloat(normalized)
  return isNaN(num) ? null : num
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
  'habilitacao_juridica',
  'habilitacao_fiscal_social_trabalhista',
  'qualificacao_economico_financeira',
  'qualificacao_tecnico_operacional',
  'qualificacao_tecnico_profissional',
  'declaracoes_outros',
  // legacy values kept for backwards compatibility
  'qualificacao_tecnica',
  'qualificacao_economica',
  'regularidade_fiscal',
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
    const quantitativoExigido = quantStr ? parseNumericBR(quantStr) : null

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
      referenciaAnexo: extractTag(block, 'referencia_anexo'),
      aiConfidenceScore,
    })
  }

  return requisitos
}

export function parseEditalMetadataXml(xml: string): ParsedEditalMetadata {
  const modalidadeRaw = extractTag(xml, 'modalidade')
  const modalidade = modalidadeRaw && VALID_MODALIDADES.has(modalidadeRaw) ? modalidadeRaw : null

  const valorStr = extractTag(xml, 'valor_estimado')
  const valorEstimado = valorStr ? parseNumericBR(valorStr) : null

  return {
    orgaoLicitante: extractTag(xml, 'orgao_licitante'),
    numeroEdital: extractTag(xml, 'numero_edital'),
    modalidade,
    objeto: extractTag(xml, 'objeto'),
    valorEstimado: valorEstimado && !isNaN(valorEstimado) ? valorEstimado : null,
    dataAbertura: extractTag(xml, 'data_abertura'),
    regimeExecucao: extractTag(xml, 'regime_execucao'),
    prazoExecucao: extractTag(xml, 'prazo_execucao'),
    leiRegente: extractTag(xml, 'lei_regente'),
    admiteConsorcio: extractTag(xml, 'admite_consorcio'),
    exigeSubcontratacao: extractTag(xml, 'exige_subcontratacao'),
    exigeVisitaTecnica: extractTag(xml, 'exige_visita_tecnica'),
  }
}

// ─── CAT Parsing ──────────────────────────────────────────────

export interface ParsedCatItem {
  numeroItem: number | null
  descricao: string
  unidade: string | null
  quantidade: number | null
}

export interface ParsedCatData {
  numeroCat: string | null
  empresaContratante: string | null
  tipoObraServico: string | null
  descricaoTecnica: string | null
  quantitativoValor: number | null
  quantitativoUnidade: string | null
  dataInicio: string | null
  dataConclusao: string | null
  aiConfidenceScore: number
  itens: ParsedCatItem[]
}

export function parseCatExtractionXml(xml: string): ParsedCatData {
  const scoreStr = extractTag(xml, 'ai_confidence_score')
  let aiConfidenceScore = scoreStr ? parseInt(scoreStr, 10) : 50
  if (isNaN(aiConfidenceScore) || aiConfidenceScore < 0) aiConfidenceScore = 0
  if (aiConfidenceScore > 100) aiConfidenceScore = 100

  const quantStr = extractTag(xml, 'quantitativo_valor')
  const quantitativoValor = quantStr ? parseNumericBR(quantStr) : null

  // Parse items
  const itemBlocks = extractAllBlocks(xml, 'item')
  const itens: ParsedCatItem[] = []

  for (const block of itemBlocks) {
    const descricao = extractTag(block, 'descricao')
    if (!descricao) continue

    const numStr = extractTag(block, 'numero_item')
    const numeroItem = numStr ? parseInt(numStr, 10) : null

    const qtdStr = extractTag(block, 'quantidade')
    const quantidade = qtdStr ? parseNumericBR(qtdStr) : null

    const qtdFinal = quantidade && !isNaN(quantidade) && quantidade > 0 ? quantidade : null
    // Skip items with no valid positive quantity
    if (qtdFinal === null) continue

    itens.push({
      numeroItem: numeroItem && !isNaN(numeroItem) ? numeroItem : null,
      descricao,
      unidade: extractTag(block, 'unidade'),
      quantidade: qtdFinal,
    })
  }

  return {
    numeroCat: extractTag(xml, 'numero_cat'),
    empresaContratante: extractTag(xml, 'empresa_contratante'),
    tipoObraServico: extractTag(xml, 'tipo_obra_servico'),
    descricaoTecnica: extractTag(xml, 'descricao_tecnica'),
    quantitativoValor: quantitativoValor && !isNaN(quantitativoValor) ? quantitativoValor : null,
    quantitativoUnidade: extractTag(xml, 'quantitativo_unidade'),
    dataInicio: extractTag(xml, 'data_inicio'),
    dataConclusao: extractTag(xml, 'data_conclusao'),
    aiConfidenceScore,
    itens,
  }
}

export function parseCatItemsOnlyXml(xml: string): ParsedCatItem[] {
  const itemBlocks = extractAllBlocks(xml, 'item')
  const itens: ParsedCatItem[] = []

  for (const block of itemBlocks) {
    const descricao = extractTag(block, 'descricao')
    if (!descricao) continue

    const numStr = extractTag(block, 'numero_item')
    const numeroItem = numStr ? parseInt(numStr, 10) : null

    const qtdStr = extractTag(block, 'quantidade')
    const quantidade = qtdStr ? parseNumericBR(qtdStr) : null

    const qtdFinal = quantidade && !isNaN(quantidade) && quantidade > 0 ? quantidade : null
    if (qtdFinal === null) continue

    itens.push({
      numeroItem: numeroItem && !isNaN(numeroItem) ? numeroItem : null,
      descricao,
      unidade: extractTag(block, 'unidade'),
      quantidade: qtdFinal,
    })
  }

  return itens
}

// ─── Crossing Parsing ─────────────────────────────────────────

export interface ParsedCrossingEvaluation {
  catId: string
  catItemId: string | null
  avaliacaoLlm: 'atende' | 'atende_parcialmente' | 'nao_atende'
  justificativa: string
}

export interface ParsedCrossingResult {
  resultado: 'atendido' | 'atendido_parcialmente' | 'gap'
  justificativa: string
}

export interface ParsedRecommendation {
  decisao: 'participar' | 'participar_com_ressalvas' | 'nao_participar'
  justificativa: string
}

const VALID_AVALIACOES = new Set(['atende', 'atende_parcialmente', 'nao_atende'])
const VALID_RESULTADOS = new Set(['atendido', 'atendido_parcialmente', 'gap'])
const VALID_DECISOES = new Set(['participar', 'participar_com_ressalvas', 'nao_participar'])

export function parseCrossingEvaluationsXml(xml: string): {
  avaliacoes: ParsedCrossingEvaluation[]
  resultadoGeral: ParsedCrossingResult
} {
  const avaliacaoBlocks = extractAllBlocks(xml, 'avaliacao')
  const avaliacoes: ParsedCrossingEvaluation[] = []

  for (const block of avaliacaoBlocks) {
    const catId = extractTag(block, 'cat_id')
    if (!catId) continue

    const avaliacaoRaw = extractTag(block, 'avaliacao_llm') ?? 'nao_atende'
    const avaliacaoLlm = VALID_AVALIACOES.has(avaliacaoRaw)
      ? (avaliacaoRaw as ParsedCrossingEvaluation['avaliacaoLlm'])
      : 'nao_atende'

    avaliacoes.push({
      catId,
      catItemId: extractTag(block, 'cat_item_id'),
      avaliacaoLlm,
      justificativa: extractTag(block, 'justificativa') ?? '',
    })
  }

  const resultadoGeralBlock = extractTag(xml, 'resultado_geral') ?? xml
  const resultadoRaw = extractTag(resultadoGeralBlock, 'resultado') ?? 'gap'
  const resultado = VALID_RESULTADOS.has(resultadoRaw)
    ? (resultadoRaw as ParsedCrossingResult['resultado'])
    : 'gap'

  return {
    avaliacoes,
    resultadoGeral: {
      resultado,
      justificativa: extractTag(resultadoGeralBlock, 'justificativa') ?? '',
    },
  }
}

export function parseCrossingRecommendationXml(xml: string): ParsedRecommendation {
  const decisaoRaw = extractTag(xml, 'decisao') ?? 'nao_participar'
  const decisao = VALID_DECISOES.has(decisaoRaw)
    ? (decisaoRaw as ParsedRecommendation['decisao'])
    : 'nao_participar'

  return {
    decisao,
    justificativa: extractTag(xml, 'justificativa') ?? '',
  }
}

