export const CAT_EXTRACTION_SYSTEM_PROMPT = `Você é um especialista em licitações públicas e Certidões de Acervo Técnico (CATs) do CREA/CAU. Sua tarefa é extrair informações estruturadas de CATs digitalizadas ou digitadas.

As CATs registram a experiência técnica de profissionais (engenheiros, arquitetos) em obras e serviços. Extraia:
- Dados da obra/serviço (tipo, descrição técnica)
- Empresa contratante
- Período de execução
- Quantitativos relevantes
- Itens individuais de serviços quando listados

Seja preciso com os quantitativos — eles são essenciais para o cruzamento com requisitos de editais.
IMPORTANTE: NÃO inclua itens com quantidade zero, nula ou sem quantidade definida.`

export function buildCatExtractionUserPrompt(catText: string): string {
  return `Extraia as informações desta Certidão de Acervo Técnico (CAT):

<cat_text>
${catText}
</cat_text>

Responda no formato:
<cat>
  <numero_cat>número da CAT ou null</numero_cat>
  <empresa_contratante>nome da empresa contratante</empresa_contratante>
  <tipo_obra_servico>tipo principal da obra ou serviço</tipo_obra_servico>
  <descricao_tecnica>descrição técnica completa da obra/serviço</descricao_tecnica>
  <quantitativo_valor>valor numérico principal ou null</quantitativo_valor>
  <quantitativo_unidade>unidade do quantitativo principal ou null</quantitativo_unidade>
  <data_inicio>YYYY-MM-DD ou null</data_inicio>
  <data_conclusao>YYYY-MM-DD ou null</data_conclusao>
  <ai_confidence_score>0-100</ai_confidence_score>
  <itens>
    <item>
      <numero_item>número ou null</numero_item>
      <descricao>descrição do item de serviço</descricao>
      <unidade>unidade ou null</unidade>
      <quantidade>valor numérico maior que zero (NÃO incluir itens com quantidade zero ou nula)</quantidade>
    </item>
  </itens>
</cat>`
}

export function buildCatItemsOnlyUserPrompt(pageRange: string): string {
  return `Extraia APENAS os itens de serviço desta seção da CAT (páginas ${pageRange}).
NÃO inclua itens com quantidade zero, nula ou sem quantidade definida.
NÃO repita itens já extraídos de páginas anteriores.

Responda no formato:
<itens>
  <item>
    <numero_item>número ou null</numero_item>
    <descricao>descrição do item de serviço</descricao>
    <unidade>unidade ou null</unidade>
    <quantidade>valor numérico maior que zero</quantidade>
  </item>
</itens>

Se não houver itens com quantidade válida nesta seção, responda com <itens></itens>.`
}
