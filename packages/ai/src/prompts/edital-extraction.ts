export const EDITAL_EXTRACTION_SYSTEM_PROMPT = `Você é um especialista em licitações públicas brasileiras com profundo conhecimento em engenharia civil, saneamento, construção e infraestrutura. Sua tarefa é extrair com precisão os requisitos de qualificação técnica de editais de licitação.

Foco principal: identifique APENAS requisitos relacionados a:
- Qualificação técnica (experiência anterior, capacidade técnica)
- Certidões de Acervo Técnico (CATs) exigidas
- Atestados técnicos
- Responsabilidade técnica (engenheiros, arquitetos)
- Quantitativos e unidades exigidas

Ignore: prazos de entrega, preços, habilitação jurídica, regularidade fiscal.

Ao extrair cada requisito:
1. Preserve o trecho original exato do edital
2. Normalize a descrição para ser clara e consultável
3. Extraia quantitativos com unidades quando disponíveis
4. Identifique o lote quando houver divisão
5. Atribua um score de confiança (0-100) baseado na clareza do texto

Responda SEMPRE usando o formato XML especificado.`

export function buildEditalExtractionUserPrompt(
  editalText: string,
  pageRange: string,
): string {
  return `Analise o seguinte trecho do edital (${pageRange}) e extraia todos os requisitos de qualificação técnica.

<edital_text>
${editalText}
</edital_text>

Responda no formato:
<requisitos>
  <requisito>
    <lote>nome do lote ou null</lote>
    <categoria>qualificacao_tecnica|qualificacao_economica|regularidade_fiscal|habilitacao_juridica|outro</categoria>
    <descricao>descrição normalizada e clara do requisito</descricao>
    <trecho_original>trecho exato do edital</trecho_original>
    <pagina_referencia>número da página ou null</pagina_referencia>
    <quantitativo_exigido>valor numérico ou null</quantitativo_exigido>
    <unidade>unidade de medida ou null</unidade>
    <ai_confidence_score>0-100</ai_confidence_score>
  </requisito>
</requisitos>`
}

export function buildEditalMetadataPrompt(editalText: string): string {
  return `Extraia os metadados do seguinte edital de licitação:

<edital_text>
${editalText.slice(0, 5000)}
</edital_text>

Responda no formato:
<metadata>
  <orgao_licitante>nome do órgão</orgao_licitante>
  <numero_edital>número/ano do edital</numero_edital>
  <modalidade>pregao_eletronico|pregao_presencial|concorrencia|tomada_de_precos|convite|leilao|concurso|rdc|credenciamento|outro</modalidade>
  <objeto>descrição resumida do objeto da licitação</objeto>
  <valor_estimado>valor numérico sem formatação ou null</valor_estimado>
  <data_abertura>YYYY-MM-DD ou null</data_abertura>
</metadata>`
}
