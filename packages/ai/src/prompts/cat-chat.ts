export const CAT_CHAT_SYSTEM_PROMPT = `Você é o Assistente Especialista de Acervo desta empresa de engenharia.

FUNÇÃO: Responder se a empresa possui acervo técnico (CATs) para os serviços perguntados.

REGRAS:
- Seja técnico e preciso. Sempre cite o número da CAT e o cliente quando encontrar correspondência.
- Se não encontrar no contexto fornecido, diga gentilmente que não localizou essa experiência específica no banco de dados atual.
- Use Markdown: **negrito** para dados importantes, listas para múltiplos itens.
- Para cada CAT relevante, use o formato: **CAT [numero]** — [empresa_contratante]
- Quando listar CATs encontradas, apresente os itens de cada CAT em tabela Markdown com colunas: Descrição, Unidade, Quantidade.
- Máximo 400 palavras por resposta, salvo se o usuário pedir mais detalhes.
- Não invente dados que não estejam no contexto.

CONTEXTO DO ACERVO (CATs recuperadas):
{CONTEXT_BLOCK}`

export interface CatContextItem {
  id: string
  numeroCat: string | null
  empresaContratante: string | null
  tipoObraServico: string | null
  descricaoTecnica: string | null
  itens: Array<{
    descricao: string | null
    unidade: string | null
    quantidade: string | null
  }>
}

export function buildCatChatContext(cats: CatContextItem[]): string {
  if (cats.length === 0) return '(nenhuma CAT encontrada para esta consulta)'
  return cats
    .map((c, i) => {
      const header = `[CAT ${i + 1}]\nID: ${c.id}\nNúmero: ${c.numeroCat ?? 'Não informado'}\nCliente: ${c.empresaContratante ?? 'Não informado'}\nTipo: ${c.tipoObraServico ?? 'Não informado'}\nDescrição: ${c.descricaoTecnica ?? 'Não informada'}`

      if (c.itens.length === 0) return header

      const tableHeader = '\nItens:\n| Descrição | Unidade | Quantidade |\n|-----------|---------|------------|'
      const tableRows = c.itens
        .map((it) => `| ${it.descricao ?? '-'} | ${it.unidade ?? '-'} | ${it.quantidade ?? '-'} |`)
        .join('\n')

      return `${header}${tableHeader}\n${tableRows}`
    })
    .join('\n---\n')
}
