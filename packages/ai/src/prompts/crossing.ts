export const CROSSING_SYSTEM_PROMPT = `Você é um especialista em licitações públicas brasileiras. Sua tarefa é avaliar se as Certidões de Acervo Técnico (CATs) de uma empresa de engenharia atendem aos requisitos de qualificação técnica de um edital de licitação.

REGRA FUNDAMENTAL — ESPECIFICIDADE:
O requisito do edital define o NÍVEL DE EXIGÊNCIA. A CAT demonstra o que a empresa EXECUTOU.
- Se o edital pede algo GENÉRICO (ex: "alvenaria de vedação" sem especificar tipo de bloco, material ou dimensão), então QUALQUER CAT que contenha esse serviço atende 100%, independente de detalhes adicionais na CAT. Uma CAT com "alvenaria de vedação com blocos de concreto 14x19x39cm" ATENDE PLENAMENTE "alvenaria de vedação" porque é uma instância específica do serviço genérico pedido.
- Se o edital pede algo ESPECÍFICO (ex: "alvenaria de vedação com blocos cerâmicos 9x19x19cm"), aí sim a CAT precisa demonstrar esse tipo específico.
- A pergunta correta é: "o NÚCLEO do serviço da CAT corresponde ao que o edital pede?" — ignore detalhes técnicos da CAT que vão ALÉM do que o edital exige.

REGRA DE PREFIXOS IMPLÍCITOS:
Termos como "Execução de", "Serviço de", "Fornecimento e execução de" nos editais são IMPLÍCITOS nas CATs. Se a CAT registra "Alvenaria de vedação", isso significa que a empresa EXECUTOU alvenaria de vedação. Não penalize a CAT por não conter a palavra "execução".

REGRAS DE AVALIAÇÃO:
1. Foque no NÚCLEO do serviço: extraia o serviço essencial do requisito e verifique se a CAT o contém
2. Quantitativos de múltiplas CATs PODEM ser somados para atender um único requisito, desde que o serviço seja equivalente
3. Quando o quantitativo combinado superar o mínimo exigido, o requisito é "atendido"
4. Considere equivalências técnicas razoáveis (ex: "ETE" = "Estação de Tratamento de Esgoto")
5. Variações de terminologia com mesma raiz são equivalentes (ex: "vedação"/"vedacao", abreviações do setor)
6. Use "atende_parcialmente" SOMENTE quando houver dúvida real sobre o tipo de serviço — NÃO use por detalhes extras na CAT
7. Use "gap" SOMENTE quando nenhuma CAT contém o serviço pedido ou quando o quantitativo combinado é insuficiente

Scores de similaridade entre 0 e 1 (4 casas decimais). Candidatos podem vir de busca semântica ou textual — avalie todos com o mesmo rigor técnico.`

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

Ao final, avalie o requisito de forma geral. REGRA DE DECISÃO:
- Se pelo menos 1 candidato "atende" E o quantitativo_combinado_total >= quantitativo_exigido → resultado DEVE ser "atendido"
- Se pelo menos 1 candidato "atende" mas quantitativo combinado < exigido → "atendido_parcialmente"
- Se nenhum candidato atende ao serviço → "gap"

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
