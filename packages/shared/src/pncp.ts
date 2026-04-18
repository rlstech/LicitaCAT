// Funções puras de acesso à API do PNCP
// Usadas tanto pela API (apps/api) quanto pelo worker (packages/queue)

const PNCP_CONSULTA_URL = 'https://pncp.gov.br/api/consulta'
const PNCP_API_URL = 'https://pncp.gov.br/api/pncp'

export interface PncpBuscarParams {
  tipo?: 'publicacao' | 'proposta'
  dataInicial?: string
  dataFinal: string
  ufs?: string[]
  codigoModalidadeContratacao?: number
  codigoModoDisputa?: number
  cnpj?: string
  codigoUnidadeAdministrativa?: string
  codigoMunicipioIbge?: string
  pagina?: number
  tamanhoPagina?: number
}

export interface PncpContratacao {
  sequencialCompra: string
  numeroCompra: string
  anoCompra: number
  objetoCompra: string
  valorTotalEstimado: number | null
  dataPublicacaoPncp: string
  dataAberturaProposta?: string | null
  dataEncerramentoProposta?: string | null
  modalidadeId: number
  modalidadeNome: string
  situacaoCompraId?: number | null
  situacaoCompraNome: string
  tipoInstrumentoConvocatorioNome: string
  orgaoEntidade: {
    cnpj: string
    nome: string
    razaoSocial?: string
    ufNome?: string
  }
  unidadeOrgao?: {
    codigoUnidade: string
    nomeUnidade: string
    ufNome?: string
    municipioNome?: string
  }
  linkSistemaOrigem?: string
}

export interface PncpDetalhe {
  anoCompra: number
  sequencialCompra: number
  numeroCompra: string
  processo: string
  numeroControlePNCP: string
  objetoCompra: string
  informacaoComplementar: string | null
  valorTotalEstimado: number | null
  valorTotalHomologado: number | null
  modalidadeId: number
  modalidadeNome: string
  modoDisputaId: number | null
  modoDisputaNome: string | null
  tipoInstrumentoConvocatorioNome: string
  situacaoCompraNome: string
  existeResultado: boolean
  srp: boolean
  dataPublicacaoPncp: string
  dataAberturaProposta: string | null
  dataEncerramentoProposta: string | null
  dataInclusao: string
  dataAtualizacao: string
  orgaoEntidade: {
    cnpj: string
    razaoSocial: string
    poderId: string
    esferaId: string
  }
  unidadeOrgao: {
    codigoUnidade: string
    nomeUnidade: string
    ufSigla: string
    ufNome: string
    municipioNome: string
  }
  amparoLegal: {
    codigo: number
    nome: string
    descricao: string
  } | null
  linkSistemaOrigem: string | null
  linkProcessoEletronico: string | null
}

export interface PncpItem {
  numeroItem: number
  descricao: string
  materialOuServico: string
  materialOuServicoNome: string
  valorUnitarioEstimado: number
  valorTotal: number
  quantidade: number
  unidadeMedida: string
  orcamentoSigiloso: boolean
  itemCategoriaNome: string
  criterioJulgamentoNome: string
  situacaoCompraItemNome: string
  tipoBeneficioNome: string
  ncmNbsCodigo: string | null
  ncmNbsDescricao: string | null
  informacaoComplementar: string | null
}

export interface PncpArquivo {
  uri: string
  url: string
  titulo: string
  tipoDocumentoNome: string
  tipoDocumentoId: number
  statusAtivo: boolean
  dataPublicacaoPncp: string
  sequencialDocumento: number
}

export interface PncpSearchResult {
  data: PncpContratacao[]
  totalRegistros: number
  totalPaginas: number
  numeroPagina: number
  empty: boolean
}

const MODALIDADES_VALIDAS = [1, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

async function fetchPublicacao(sp: URLSearchParams, modalidade: number): Promise<PncpSearchResult> {
  const params = new URLSearchParams(sp)
  params.set('codigoModalidadeContratacao', String(modalidade))
  const url = `${PNCP_CONSULTA_URL}/v1/contratacoes/publicacao?${params.toString()}`
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (response.status === 204) return emptyResult()
    if (!response.ok) return emptyResult()
    return response.json() as Promise<PncpSearchResult>
  } catch {
    return emptyResult()
  }
}

async function fetchPorUf(sp: URLSearchParams, uf: string, tipo: string): Promise<PncpSearchResult> {
  const params = new URLSearchParams(sp)
  params.set('uf', uf)
  const endpoint = tipo === 'proposta' ? 'proposta' : 'publicacao'
  const url = `${PNCP_CONSULTA_URL}/v1/contratacoes/${endpoint}?${params.toString()}`
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 204) return emptyResult()
    if (!response.ok) return emptyResult()
    return response.json() as Promise<PncpSearchResult>
  } catch {
    return emptyResult()
  }
}

function emptyResult(): PncpSearchResult {
  return { data: [], totalRegistros: 0, totalPaginas: 0, numeroPagina: 1, empty: true }
}

function mergeResults(results: PncpSearchResult[], pagina: number): PncpSearchResult {
  const seen = new Set<string>()
  const allData: PncpContratacao[] = []
  for (const r of results) {
    for (const item of r.data) {
      const key = `${item.anoCompra}-${item.sequencialCompra}-${item.orgaoEntidade.cnpj}`
      if (!seen.has(key)) {
        seen.add(key)
        allData.push(item)
      }
    }
  }
  allData.sort((a, b) =>
    new Date(b.dataPublicacaoPncp).getTime() - new Date(a.dataPublicacaoPncp).getTime()
  )
  const totalRegistros = results.reduce((acc, r) => acc + r.totalRegistros, 0)
  const totalPaginas = Math.max(...results.map((r) => r.totalPaginas), 1)
  return { data: allData, totalRegistros, totalPaginas, numeroPagina: pagina, empty: allData.length === 0 }
}

export async function searchPncp(params: PncpBuscarParams): Promise<PncpSearchResult> {
  const tipo = params.tipo ?? 'publicacao'
  const tamanhoPagina = Math.max(params.tamanhoPagina ?? 20, 10)
  const pagina = params.pagina ?? 1
  const ufs = params.ufs ?? []

  const sp = new URLSearchParams()
  if (params.codigoModoDisputa) sp.set('codigoModoDisputa', String(params.codigoModoDisputa))
  if (params.cnpj) sp.set('cnpj', params.cnpj)
  if (params.codigoUnidadeAdministrativa) sp.set('codigoUnidadeAdministrativa', params.codigoUnidadeAdministrativa)
  if (params.codigoMunicipioIbge) sp.set('codigoMunicipioIbge', params.codigoMunicipioIbge)
  sp.set('pagina', String(pagina))
  sp.set('tamanhoPagina', String(tamanhoPagina))

  if (tipo === 'publicacao') {
    if (params.dataInicial) sp.set('dataInicial', params.dataInicial)
    sp.set('dataFinal', params.dataFinal)

    if (!params.codigoModalidadeContratacao) {
      if (ufs.length > 1) {
        const results = await Promise.all(
          ufs.map(uf => {
            const ufSp = new URLSearchParams(sp)
            return Promise.all(MODALIDADES_VALIDAS.map(m => {
              const mSp = new URLSearchParams(ufSp)
              mSp.set('uf', uf)
              mSp.set('codigoModalidadeContratacao', String(m))
              const url = `${PNCP_CONSULTA_URL}/v1/contratacoes/publicacao?${mSp.toString()}`
              return fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
                .then(r => r.status === 204 || !r.ok ? emptyResult() : r.json() as Promise<PncpSearchResult>)
                .catch(() => emptyResult())
            }))
          })
        )
        return mergeResults(results.flat(), pagina)
      }

      if (ufs.length === 1) sp.set('uf', ufs[0]!)

      const results = await Promise.all(MODALIDADES_VALIDAS.map((m) => fetchPublicacao(sp, m)))
      return mergeResults(results, pagina)
    }

    sp.set('codigoModalidadeContratacao', String(params.codigoModalidadeContratacao))
  } else {
    if (params.dataInicial) sp.set('dataInicial', params.dataInicial)
    sp.set('dataFinal', params.dataFinal)
    if (params.codigoModalidadeContratacao) {
      sp.set('codigoModalidadeContratacao', String(params.codigoModalidadeContratacao))
    }
  }

  if (ufs.length > 1) {
    const results = await Promise.all(ufs.map(uf => fetchPorUf(sp, uf, tipo)))
    return mergeResults(results, pagina)
  }

  if (ufs.length === 1) sp.set('uf', ufs[0]!)

  const endpoint = tipo === 'proposta' ? 'proposta' : 'publicacao'
  const url = `${PNCP_CONSULTA_URL}/v1/contratacoes/${endpoint}?${sp.toString()}`

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(60000),
  })

  if (response.status === 204) return emptyResult()

  if (!response.ok) {
    throw new Error(`PNCP API error: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<PncpSearchResult>
}

export async function getPncpDetalhe(cnpj: string, ano: number, sequencial: string): Promise<PncpDetalhe> {
  const url = `${PNCP_CONSULTA_URL}/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}`
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) {
    throw new Error(`PNCP API error: ${response.status} ${response.statusText}`)
  }
  return response.json() as Promise<PncpDetalhe>
}

export async function getPncpItens(cnpj: string, ano: number, sequencial: string): Promise<PncpItem[]> {
  const url = `${PNCP_API_URL}/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens?pagina=1&tamanhoPagina=500`
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  })
  if (response.status === 404) return []
  if (!response.ok) {
    throw new Error(`PNCP API error: ${response.status} ${response.statusText}`)
  }
  return response.json() as Promise<PncpItem[]>
}

export async function getPncpArquivos(cnpj: string, ano: number, sequencial: string): Promise<PncpArquivo[]> {
  const url = `${PNCP_API_URL}/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos`
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  })
  if (response.status === 404) return []
  if (!response.ok) {
    throw new Error(`PNCP API error: ${response.status} ${response.statusText}`)
  }
  return response.json() as Promise<PncpArquivo[]>
}

export { MODALIDADES_VALIDAS }
