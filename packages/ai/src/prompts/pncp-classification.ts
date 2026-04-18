/**
 * Prompts para classificação de licitações PNCP em segmentos de atuação.
 * Usado no Estágio 2 (IA) do pipeline híbrido de classificação.
 */

export const PNCP_CLASSIFICATION_SYSTEM_PROMPT = `Você é um especialista em licitações públicas brasileiras.
Sua tarefa é classificar licitações nos segmentos de atuação de uma empresa de engenharia civil.
Responda APENAS com JSON válido, sem markdown, sem explicações fora do JSON.`

const SEGMENTOS_LIST = `- "Reformas, edificações e demolição"
- "Pavimentação, drenagem"
- "Serviços de terraplanagem"
- "Poços tubulares, artesianos, perfuratriz, mineração, escavação"
- "Supervisão de obras"
- "Projetos de engenharia e arquitetura, maquetes"`

export function buildPncpClassificationUserPrompt(
  objeto: string,
  infoComplementar?: string,
  orgao?: string,
  valor?: number,
): string {
  let contexto = `Objeto: ${objeto}`
  if (infoComplementar) {
    contexto += `\nInformações adicionais: ${infoComplementar.slice(0, 500)}`
  }
  if (orgao) {
    contexto += `\nÓrgão contratante: ${orgao}`
  }
  if (valor != null) {
    contexto += `\nValor estimado: R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  }

  return `Classifique a licitação abaixo nos segmentos disponíveis.

SEGMENTOS DISPONÍVEIS:
${SEGMENTOS_LIST}

LICITAÇÃO:
${contexto}

REGRAS DE CLASSIFICAÇÃO:
- "Reformas, edificações e demolição": qualquer intervenção física em edificação existente ou nova construção, incluindo adequações, manutenções prediais, telhados, fachadas, instalações elétricas/hidráulicas em imóveis, espaços físicos.
- "Pavimentação, drenagem": obras de vias, calçadas, drenagem pluvial.
- "Serviços de terraplanagem": movimentação de terra, nivelamento de terrenos.
- "Poços tubulares, artesianos, perfuratriz, mineração, escavação": perfuração de poços, sondagens, captação de água subterrânea.
- "Supervisão de obras": fiscalização, gerenciamento, acompanhamento de execução de obras.
- "Projetos de engenharia e arquitetura, maquetes": elaboração de projetos técnicos, anteprojetos, levantamentos, laudos, maquetes.
- Uma licitação pode se enquadrar em MAIS DE UM segmento.
- Se não se enquadrar em nenhum, retorne lista vazia.

Responda SOMENTE com este JSON:
{
  "segmentos": ["segmento1"],
  "confianca": "alta|media|baixa",
  "justificativa": "explicação em uma frase"
}`
}
