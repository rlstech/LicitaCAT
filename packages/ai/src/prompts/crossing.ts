export const CROSSING_SYSTEM_PROMPT = `Você é um especialista em licitações públicas brasileiras. Sua tarefa é avaliar se as Certidões de Acervo Técnico (CATs) de uma empresa de engenharia atendem aos requisitos de qualificação técnica de um edital de licitação.

Ao avaliar cada requisito contra as CATs disponíveis:
1. Considere equivalências técnicas razoáveis (ex: "ETE" equivale a "Estação de Tratamento de Esgoto", "alvenaria de vedação" equivale a "alvenaria em blocos cerâmicos de vedação")
2. Verifique se os quantitativos das CATs atendem ao mínimo exigido
3. Avalie a relevância técnica mesmo quando a terminologia difere — foque no significado, não nas palavras exatas
4. IMPORTANTE: quantitativos de múltiplas CATs PODEM ser somados para atender um único requisito, desde que o serviço seja equivalente
5. Quando o quantitativo combinado de todas as CATs candidatas superar o mínimo exigido, considere o requisito "atendido"
6. Seja conservador: prefira "atende_parcialmente" quando houver dúvida técnica sobre equivalência
7. Quando candidatos vierem de busca por palavras-chave (score_similaridade = 0.5), avalie cuidadosamente a equivalência técnica

Scores de similaridade entre 0 e 1 (4 casas decimais). Score 0.5 indica candidato encontrado por busca textual (não semântica).`

export function buildCrossingItemPrompt(
  requisito: { descricao: string; quantitativoExigido?: number | null; unidade?: string | null },
  catCandidates: Array<{
    catId: string
    catItemId?: string | null
    nivelMatch: 'cat' | 'item'
    descricao: string
    quantitativo?: number | null
    unidade?: string | null
    scoreSimilaridade: number
    isKeywordMatch?: boolean
  }>,
  totalCombinedQuantity?: number | null,
  combinedUnit?: string | null,
): string {
  const requisitoPart = `
<requisito>
  <descricao>${requisito.descricao}</descricao>
  ${requisito.quantitativoExigido ? `<quantitativo_exigido>${requisito.quantitativoExigido} ${requisito.unidade ?? ''}</quantitativo_exigido>` : ''}
</requisito>`

  const candidatesPart = catCandidates
    .map(
      (c, i) => `
  <candidato rank="${i + 1}">
    <cat_id>${c.catId}</cat_id>
    ${c.catItemId ? `<cat_item_id>${c.catItemId}</cat_item_id>` : ''}
    <nivel_match>${c.nivelMatch}</nivel_match>
    <descricao>${c.descricao}</descricao>
    ${c.quantitativo ? `<quantitativo>${c.quantitativo} ${c.unidade ?? ''}</quantitativo>` : ''}
    <score_similaridade_semantica>${c.scoreSimilaridade.toFixed(4)}</score_similaridade_semantica>
    ${c.isKeywordMatch ? '<metodo_busca>palavras-chave</metodo_busca>' : '<metodo_busca>semantica</metodo_busca>'}
  </candidato>`,
    )
    .join('\n')

  const aggregationNote = totalCombinedQuantity != null && totalCombinedQuantity > 0
    ? `\n<quantitativo_combinado_total>
  <valor>${totalCombinedQuantity.toFixed(2)} ${combinedUnit ?? ''}</valor>
  <nota>Soma dos quantitativos de todos os candidatos acima — itens de CATs diferentes podem ser combinados para atender o requisito.</nota>
</quantitativo_combinado_total>`
    : ''

  return `Avalie se as CATs candidatas atendem ao requisito do edital:

${requisitoPart}
${aggregationNote}

<candidatos>
${candidatesPart}
</candidatos>

Para cada candidato, responda no formato:
<avaliacoes>
  <avaliacao>
    <cat_id>id da cat</cat_id>
    <cat_item_id>id do item ou null</cat_item_id>
    <avaliacao_llm>atende|atende_parcialmente|nao_atende</avaliacao_llm>
    <justificativa>justificativa técnica concisa (máx 200 chars)</justificativa>
  </avaliacao>
</avaliacoes>

Ao final, avalie o requisito de forma geral (considere que quantitativos de múltiplas CATs podem ser somados):
<resultado_geral>
  <resultado>atendido|atendido_parcialmente|gap</resultado>
  <justificativa>justificativa geral (máx 300 chars)</justificativa>
</resultado_geral>`
}

export function buildCrossingRecommendationPrompt(
  editalObjeto: string,
  stats: {
    totalRequisitos: number
    atendidos: number
    atendidosParcialmente: number
    gaps: number
    scoreAderencia: number
  },
  gapDescriptions: string[],
): string {
  return `Com base na análise de cruzamento entre o edital e o acervo de CATs da empresa, gere uma recomendação de participação:

<edital>
  <objeto>${editalObjeto}</objeto>
</edital>

<resultado_cruzamento>
  <total_requisitos>${stats.totalRequisitos}</total_requisitos>
  <atendidos>${stats.atendidos}</atendidos>
  <atendidos_parcialmente>${stats.atendidosParcialmente}</atendidos_parcialmente>
  <gaps>${stats.gaps}</gaps>
  <score_aderencia>${stats.scoreAderencia}/100</score_aderencia>
</resultado_cruzamento>

<gaps_criticos>
${gapDescriptions.map((d) => `  <gap>${d}</gap>`).join('\n')}
</gaps_criticos>

Responda no formato:
<recomendacao>
  <decisao>participar|participar_com_ressalvas|nao_participar</decisao>
  <justificativa>justificativa técnica clara e objetiva para a empresa (máx 500 chars)</justificativa>
</recomendacao>`
}
