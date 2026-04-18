/**
 * Segmentos de atuação para classificação de licitações PNCP.
 * Pipeline híbrido: keywords (rápido) + LLM (casos ambíguos).
 */

// ─── Segmentos ────────────────────────────────────────────────────────────────

export const SEGMENTOS = [
  'Reformas, edificações e demolição',
  'Pavimentação, drenagem',
  'Serviços de terraplanagem',
  'Poços tubulares, artesianos, perfuratriz, mineração, escavação',
  'Supervisão de obras',
  'Projetos de engenharia e arquitetura, maquetes',
] as const

export type Segmento = (typeof SEGMENTOS)[number]

export const SEGMENTO_LABELS: Record<Segmento, string> = {
  'Reformas, edificações e demolição': 'Reformas/Edificações',
  'Pavimentação, drenagem': 'Pavimentação/Drenagem',
  'Serviços de terraplanagem': 'Terraplanagem',
  'Poços tubulares, artesianos, perfuratriz, mineração, escavação': 'Poços/Mineração',
  'Supervisão de obras': 'Supervisão',
  'Projetos de engenharia e arquitetura, maquetes': 'Projetos/Arquitetura',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type Confianca = 'alta' | 'media' | 'baixa'
export type MetodoClassificacao = 'keyword' | 'ia' | 'sem_match'

export interface ClassificacaoResult {
  segmentos: string[]
  confianca: Confianca
  metodo: MetodoClassificacao
  justificativa: string
  keywordsEncontradas: string[]
}

// ─── Keywords por segmento ────────────────────────────────────────────────────

interface KeywordConfig {
  forte: string[]
  fraca: string[]
  exclusao: string[]
}

export const KEYWORDS_SEGMENTOS: Record<string, KeywordConfig> = {
  'Reformas, edificações e demolição': {
    forte: [
      'reforma', 'demolic', 'demolir', 'construc', 'edificac',
      'amplia', 'revitaliz', 'restaur', 'retrofit', 'adequac',
      'telhado', 'cobertura metal', 'fachada', 'alvenaria',
      'reboco', 'contrapiso', 'impermeabiliz',
      'manutencao predial', 'conservacao predial',
      'bem imovel', 'bens imoveis', 'imovel',
      'reparos no imovel', 'obra civil',
      'espaco de convivencia', 'salas de aula',
      'auditorio', 'sede', 'campus', 'polo base',
    ],
    fraca: [
      'cobertura', 'piso', 'pintura', 'revestimento',
      'instalacao eletrica', 'instalacao hidraulica',
      'climatizacao', 'ar-condicionado',
      'adequacao', 'manutencao', 'conservacao',
      'servicos de engenharia', 'execucao de servicos',
      'reparos', 'manutencoes',
    ],
    exclusao: [
      'software', 'sistema', 'tecnologia da informacao',
      'veiculo', 'equipamento medico', 'mobiliario',
      'limpeza', 'vigilancia', 'seguranca eletronica',
    ],
  },

  'Pavimentação, drenagem': {
    forte: [
      'paviment', 'asfalto', 'asfaltamento', 'recapeamento',
      'drenagem', 'microdrenagem', 'macrodrenagem',
      'galeria pluvial', 'bueiro', 'boca de lobo',
      'sarjeta', 'meio-fio', 'calcada', 'ciclovia',
      'pista de rolamento',
    ],
    fraca: [
      'via', 'rua', 'avenida', 'estrada', 'rodovia',
      'pluvial', 'escoamento',
    ],
    exclusao: [
      'software', 'sistema', 'veiculo',
    ],
  },

  'Serviços de terraplanagem': {
    forte: [
      'terraplenagem', 'terraplanagem', 'aterro',
      'corte e aterro', 'movimentacao de terra',
      'nivelamento de solo', 'nivelamento do terreno',
      'regularizacao de solo', 'compactacao de solo',
      'escavacao mecanizada',
    ],
    fraca: [
      'nivelamento', 'solo', 'terreno', 'limpeza de terreno',
      'destocamento',
    ],
    exclusao: [
      'software', 'sistema', 'poco', 'sondagem',
    ],
  },

  'Poços tubulares, artesianos, perfuratriz, mineração, escavação': {
    forte: [
      'poco tubular', 'poco artesiano', 'poco profundo',
      'perfuracao de poco', 'perfuratriz',
      'mineracao', 'sondagem', 'geotecnia',
      'perfuracao', 'escavacao de poco',
      'captacao de agua subterranea',
    ],
    fraca: [
      'poco', 'perfur', 'sond',
    ],
    exclusao: [
      'reforma', 'edificacao', 'pavimentacao',
    ],
  },

  'Supervisão de obras': {
    forte: [
      'supervisao de obra', 'fiscalizacao de obra',
      'gerenciamento de obra', 'gestao de obra',
      'coordenacao de obra', 'acompanhamento de obra',
      'controle tecnologico', 'controle de qualidade de obra',
    ],
    fraca: [
      'supervisao', 'fiscalizacao', 'gerenciamento',
      'coordenacao', 'acompanhamento',
    ],
    exclusao: [
      'software', 'sistema', 'veiculo', 'limpeza',
    ],
  },

  'Projetos de engenharia e arquitetura, maquetes': {
    forte: [
      'projeto executivo', 'projeto basico', 'anteprojeto',
      'projeto arquitetonico', 'projeto de arquitetura',
      'projeto estrutural', 'projeto eletrico',
      'projeto hidraulico', 'projeto de engenharia',
      'elaboracao de projeto', 'desenvolvimento de projeto',
      'maquete', 'maquete eletronica', 'bim',
      'levantamento topografico', 'topografia',
      'laudo tecnico', 'laudo de vistoria',
      'memorial descritivo', 'estudo de viabilidade',
    ],
    fraca: [
      'projeto', 'planta', 'desenho tecnico',
      'especificacao tecnica',
    ],
    exclusao: [
      'execucao', 'obra', 'construcao',
      'software de projeto', 'sistema',
    ],
  },
}

// ─── Normalização de texto ────────────────────────────────────────────────────

export function normalizeText(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// ─── Classificador por Keywords (Estágio 1) ──────────────────────────────────

function verificarExclusao(textoNorm: string, exclusoes: string[]): boolean {
  return exclusoes.some(ex => textoNorm.includes(normalizeText(ex)))
}

function contarMatches(textoNorm: string, keywords: string[]): string[] {
  return keywords.filter(kw => textoNorm.includes(normalizeText(kw)))
}

export function classificarPorKeywords(
  objeto: string,
  infoComplementar: string = '',
  minFracasParaMatch: number = 2,
): ClassificacaoResult {
  const textoCompleto = `${objeto} ${infoComplementar}`
  const textoNorm = normalizeText(textoCompleto)

  const segmentosMatch: string[] = []
  const todasKeywords: string[] = []
  let confiancaGeral: Confianca = 'baixa'

  for (const [segmento, config] of Object.entries(KEYWORDS_SEGMENTOS)) {
    if (verificarExclusao(textoNorm, config.exclusao)) {
      continue
    }

    const fortes = contarMatches(textoNorm, config.forte)
    const fracas = contarMatches(textoNorm, config.fraca)

    if (fortes.length > 0) {
      segmentosMatch.push(segmento)
      todasKeywords.push(...fortes)
      confiancaGeral = 'alta'
    } else if (fracas.length >= minFracasParaMatch) {
      segmentosMatch.push(segmento)
      todasKeywords.push(...fracas)
      if (confiancaGeral !== 'alta') {
        confiancaGeral = 'media'
      }
    }
  }

  if (segmentosMatch.length === 0) {
    return {
      segmentos: [],
      confianca: 'baixa',
      metodo: 'sem_match',
      justificativa: 'Nenhuma keyword encontrada.',
      keywordsEncontradas: [],
    }
  }

  const uniqueKeywords = [...new Set(todasKeywords)]

  return {
    segmentos: segmentosMatch,
    confianca: confiancaGeral,
    metodo: 'keyword',
    justificativa: `Keywords encontradas: ${uniqueKeywords.join(', ')}`,
    keywordsEncontradas: uniqueKeywords,
  }
}
