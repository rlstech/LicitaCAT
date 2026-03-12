export const CAT_EXTRACTION_SYSTEM_PROMPT = `Você é um especialista em licitações públicas e Certidões de Acervo Técnico (CATs) do CREA/CAU. Sua tarefa é extrair informações estruturadas de CATs digitalizadas ou digitadas.

As CATs registram a experiência técnica de profissionais (engenheiros, arquitetos) em obras e serviços. Extraia:
- Dados da obra/serviço (tipo, descrição técnica)
- Empresa contratante
- Período de execução
- Quantitativos relevantes
- Itens individuais de serviços quando listados

Seja preciso com os quantitativos — eles são essenciais para o cruzamento com requisitos de editais.
IMPORTANTE: extraia APENAS itens que possuem quantidade numérica explícita no documento. Títulos de seção, agrupamentos e categorias (ex: "03.03.000 ESTRUTURAS METÁLICAS", "04.01.100 Paredes") NÃO devem ser extraídos pois não têm quantidade.
SELOS/CARIMBOS: documentos CAT frequentemente possuem selos sobrepostos do CREA/CAU (ex: "Atestado registrado mediante vinculação à respectiva CAT - CREA-DF - A 0063.414"). Ignore completamente o texto do selo. Se o selo cobrir a coluna de unidade de um item, use UN como unidade desse item.
UNIDADE: coloque APENAS a sigla (ex: M2, M3, KG, UN, M, CX, VB, LS, HR). NUNCA inclua números na unidade.`

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
      <quantidade>valor numérico explícito do documento (NÃO incluir o item se não houver quantidade)</quantidade>
    </item>
  </itens>
</cat>`
}

export function buildCatItemsOnlyUserPrompt(pageRange: string): string {
  return `Extraia os itens de serviço desta seção da CAT (páginas ${pageRange}).
REGRA PRINCIPAL: só extraia itens que possuem QUANTIDADE numérica explícita no documento.
Títulos de seção, agrupamentos e categorias sem quantidade (ex: "ESTRUTURAS METÁLICAS", "Paredes", "Esquadrias") NÃO devem ser incluídos.
UNIDADE: coloque APENAS a sigla (ex: M2, M3, KG, UN, M, CX, VB, HR). NUNCA coloque números na unidade.

Responda no formato:
<itens>
  <item>
    <numero_item>número do item ou null</numero_item>
    <descricao>descrição do serviço</descricao>
    <unidade>sigla da unidade</unidade>
    <quantidade>valor numérico explícito do documento</quantidade>
  </item>
</itens>

Se não houver itens com quantidade nesta seção, responda com <itens></itens>.`
}
