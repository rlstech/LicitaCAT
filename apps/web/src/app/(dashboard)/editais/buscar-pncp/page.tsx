'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { fetchMunicipiosByUfs, type Municipio } from '@/lib/ibge'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

// ─── Domain data ──────────────────────────────────────────────────────────────
const UF_LIST = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'TO', nome: 'Tocantins' },
]

const MODALIDADES = [
  { id: 1,  nome: 'Leilão - Eletrônico' },
  { id: 2,  nome: 'Diálogo Competitivo' },
  { id: 3,  nome: 'Concurso' },
  { id: 4,  nome: 'Concorrência - Eletrônica' },
  { id: 5,  nome: 'Concorrência - Presencial' },
  { id: 6,  nome: 'Pregão - Eletrônico' },
  { id: 7,  nome: 'Pregão - Presencial' },
  { id: 8,  nome: 'Dispensa' },
  { id: 9,  nome: 'Inexigibilidade' },
  { id: 10, nome: 'Manifestação de Interesse' },
  { id: 11, nome: 'Pré-qualificação' },
  { id: 12, nome: 'Credenciamento' },
  { id: 13, nome: 'Leilão - Presencial' },
  { id: 14, nome: 'Inaplicabilidade da Licitação' },
  { id: 15, nome: 'Chamada pública' },
  { id: 16, nome: 'Concorrência – Eletrônica Internacional' },
  { id: 17, nome: 'Concorrência – Presencial Internacional' },
  { id: 18, nome: 'Pregão – Eletrônico Internacional' },
  { id: 19, nome: 'Pregão – Presencial Internacional' },
]

const ESFERAS = [
  { id: 'F', nome: 'Federal' },
  { id: 'E', nome: 'Estadual' },
  { id: 'M', nome: 'Municipal' },
  { id: 'D', nome: 'Distrital' },
]

const PODERES = [
  { id: 'E', nome: 'Executivo' },
  { id: 'L', nome: 'Legislativo' },
  { id: 'J', nome: 'Judiciário' },
  { id: 'N', nome: 'Sem poder' },
]

const FONTES_ORCAMENTARIAS = [
  { id: '1', nome: 'Não se aplica' },
  { id: '2', nome: 'Municipal' },
  { id: '3', nome: 'Estadual' },
  { id: '4', nome: 'Federal' },
  { id: '5', nome: 'Organismo Internacional' },
  { id: '6', nome: 'Distrital' },
]

const TIPOS_INSTRUMENTO = [
  { id: 1, nome: 'Edital' },
  { id: 2, nome: 'Aviso de Contratação Direta' },
  { id: 3, nome: 'Ato que institui o credenciamento' },
]

const ESFERA_MAP: Record<string, string> = { F: 'Federal', E: 'Estadual', M: 'Municipal', D: 'Distrital' }
const PODER_MAP: Record<string, string>  = { E: 'Executivo', L: 'Legislativo', J: 'Judiciário', N: 'Sem poder' }

// ─── Types ────────────────────────────────────────────────────────────────────
type StatusBusca = 'a_receber' | 'em_julgamento' | 'encerradas' | 'todos'
type TipoBusca   = 'publicacao' | 'proposta'
type Tab         = 'dados' | 'orgao' | 'datas' | 'itens' | 'arquivos'

interface PncpContratacao {
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
  situacaoCompraId: number
  situacaoCompraNome: string
  tipoInstrumentoConvocatorioCodigo: number
  tipoInstrumentoConvocatorioNome: string
  modoDisputaId?: number
  modoDisputaNome?: string
  fontesOrcamentarias?: Array<{ id: number; nome: string }>
  orgaoEntidade: { cnpj: string; razaoSocial?: string; nome?: string; esferaId?: string; poderId?: string }
  unidadeOrgao?: { ufSigla?: string; municipioNome?: string; nomeUnidade?: string }
  linkSistemaOrigem?: string
}

interface PncpDetalhe {
  anoCompra: number
  sequencialCompra: number
  numeroCompra: string
  processo: string
  numeroControlePNCP: string
  objetoCompra: string
  informacaoComplementar: string | null
  valorTotalEstimado: number | null
  valorTotalHomologado: number | null
  modalidadeNome: string
  modoDisputaNome: string | null
  tipoInstrumentoConvocatorioNome: string
  situacaoCompraNome: string
  situacaoCompraId: number
  existeResultado: boolean
  srp: boolean
  dataPublicacaoPncp: string
  dataAberturaProposta: string | null
  dataEncerramentoProposta: string | null
  dataInclusao: string
  dataAtualizacao: string
  orgaoEntidade: { cnpj: string; razaoSocial: string; poderId: string; esferaId: string }
  unidadeOrgao: { codigoUnidade: string; nomeUnidade: string; ufSigla: string; ufNome: string; municipioNome: string; codigoIbge?: string }
  amparoLegal: { codigo: number; nome: string; descricao: string } | null
  linkSistemaOrigem: string | null
  linkProcessoEletronico: string | null
  orcamentoSigilosoDescricao?: string
}

interface PncpItem {
  numeroItem: number
  descricao: string
  materialOuServicoNome: string
  valorUnitarioEstimado: number
  valorTotal: number
  quantidade: number
  unidadeMedida: string
  criterioJulgamentoNome: string
  situacaoCompraItemNome: string
  tipoBeneficioNome: string
  ncmNbsCodigo: string | null
  informacaoComplementar: string | null
}

interface PncpArquivo {
  uri: string
  url: string
  titulo: string
  tipoDocumentoNome: string
  tipoDocumentoId: number
  statusAtivo: boolean
  dataPublicacaoPncp: string
  sequencialDocumento: number
}

interface PncpResult {
  data: PncpContratacao[]
  totalRegistros: number
  totalPaginas: number
  numeroPagina: number
  empty: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toYYYYMMDD(date: string): string { return date.replace(/-/g, '') }

function offsetDate(daysFromToday: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromToday)
  return d.toISOString().slice(0, 10)
}

function formatCacheTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora mesmo'
  if (mins < 60) return `há ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `há ${hrs}h`
  return `há ${Math.floor(hrs / 24)} dias`
}

function formatCurrency(val: number | null | undefined): string {
  if (val == null) return '—'
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarValorBR(raw: string): string {
  const cleaned = raw.replace(/[^\d,]/g, '')
  const [intPart = '', decPart] = cleaned.split(',')
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return decPart !== undefined ? `${intFormatted},${decPart.slice(0, 2)}` : intFormatted
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function situacaoBadge(nome: string, id?: number) {
  const isAberta   = id === 1 || nome.toLowerCase().includes('divulg')
  const isEncerrada = nome.toLowerCase().includes('encerr') || nome.toLowerCase().includes('homolog')
  const isCancelada = nome.toLowerCase().includes('cancel') || nome.toLowerCase().includes('revogar') || nome.toLowerCase().includes('anulad')
  if (isAberta)   return { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' }
  if (isEncerrada) return { bg: 'bg-slate-200',  text: 'text-slate-600',   dot: 'bg-slate-400' }
  if (isCancelada) return { bg: 'bg-red-100',    text: 'text-red-700',     dot: 'bg-red-500' }
  return { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' }
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────
function IconClose()    { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> }
function IconEye()      { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> }
function IconDownload() { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12M12 16.5V3" /></svg> }
function IconFilter()   { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12" /></svg> }
function IconExternal() { return <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg> }
function IconDoc()      { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg> }
function IconChevLeft() { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg> }
function IconChevRight(){ return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg> }

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <svg className="h-6 w-6 animate-spin text-brand-600" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  )
}
function ErrorMsg({ msg }: { msg: string }) {
  return <p className="px-4 py-8 text-center text-sm text-red-600">{msg}</p>
}
function EmptyState({ msg }: { msg: string }) {
  return <p className="px-4 py-12 text-center text-sm text-brand-400">{msg}</p>
}

// ─── Field label helper ───────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400/70 mb-0.5">{children}</p>
}
function FieldValue({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <p className={`text-xs font-semibold text-brand-900 ${mono ? 'font-mono' : ''}`}>{children || '—'}</p>
}

// ─── Detail drawer ────────────────────────────────────────────────────────────
function DetalheDrawer({
  item,
  onClose,
  onImportar,
  importing,
}: {
  item: PncpContratacao
  onClose: () => void
  onImportar: (item: PncpContratacao) => void
  importing: boolean
}) {
  const { getToken } = useAuth()
  const [tab, setTab] = useState<Tab>('dados')
  const [detalhe, setDetalhe] = useState<PncpDetalhe | null>(null)
  const [itens, setItens] = useState<PncpItem[] | null>(null)
  const [arquivos, setArquivos] = useState<PncpArquivo[] | null>(null)
  const [loadingDados, setLoadingDados] = useState(true)
  const [loadingItens, setLoadingItens] = useState(false)
  const [loadingArquivos, setLoadingArquivos] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pncpParams = new URLSearchParams({
    cnpj: item.orgaoEntidade.cnpj,
    ano: String(item.anoCompra),
    sequencial: item.sequencialCompra,
  })

  useState(() => {
    const load = async () => {
      try {
        const token = await getToken()
        const res = await fetch(`${API_URL}/api/editais/pncp/detalhe?${pncpParams}`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        })
        if (!res.ok) throw new Error(`Erro ${res.status}`)
        setDetalhe(await res.json() as PncpDetalhe)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar detalhes')
      } finally {
        setLoadingDados(false)
      }
    }
    load()
  })

  async function loadItens() {
    if (itens !== null) return
    setLoadingItens(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/editais/pncp/itens?${pncpParams}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      setItens(await res.json() as PncpItem[])
    } catch { setItens([]) } finally { setLoadingItens(false) }
  }

  async function loadArquivos() {
    if (arquivos !== null) return
    setLoadingArquivos(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/editais/pncp/arquivos?${pncpParams}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      setArquivos(await res.json() as PncpArquivo[])
    } catch { setArquivos([]) } finally { setLoadingArquivos(false) }
  }

  function handleTab(t: Tab) {
    setTab(t)
    if (t === 'itens') loadItens()
    if (t === 'arquivos') loadArquivos()
  }

  const badge = (detalhe ?? item) && situacaoBadge(
    detalhe?.situacaoCompraNome ?? item.situacaoCompraNome,
    detalhe?.situacaoCompraId ?? item.situacaoCompraId,
  )

  const TABS: { key: Tab; label: string }[] = [
    { key: 'dados',    label: 'Dados gerais' },
    { key: 'orgao',   label: 'Órgão/Unidade' },
    { key: 'datas',   label: 'Datas' },
    { key: 'itens',   label: 'Itens' },
    { key: 'arquivos', label: 'Arquivos' },
  ]

  return (
    <div className="fixed right-0 top-0 h-screen w-[480px] bg-white shadow-2xl z-50 flex flex-col border-l border-outline-variant/30">
      {/* Header */}
      <div className="bg-brand-600 text-white px-6 py-5 relative shrink-0">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors rounded-lg p-1 hover:bg-white/10"
        >
          <IconClose />
        </button>
        <div className="flex items-center gap-2 mb-3 flex-wrap pr-8">
          {badge && (
            <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${badge.bg} ${badge.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
              {detalhe?.situacaoCompraNome ?? item.situacaoCompraNome}
            </span>
          )}
          {detalhe?.srp && <span className="rounded bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">Reg. de Preços</span>}
          <span className="text-[10px] text-white/50">PNCP #{item.anoCompra}-{item.sequencialCompra}</span>
        </div>
        <h3 className="text-base font-bold leading-snug line-clamp-3 pr-4">{item.objetoCompra}</h3>
        <div className="grid grid-cols-2 gap-4 mt-5">
          <div>
            <p className="text-[10px] text-white/60 uppercase tracking-wider">Valor Estimado</p>
            <p className="text-xl font-bold tabular-nums tracking-tight">{formatCurrency(item.valorTotalEstimado)}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/60 uppercase tracking-wider">Abertura</p>
            <p className="text-sm font-semibold">{formatDateTime(detalhe?.dataAberturaProposta ?? item.dataAberturaProposta)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-high px-2 border-b border-outline-variant/20 shrink-0 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => handleTab(t.key)}
            className={`px-3 py-3 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors relative ${
              tab === t.key
                ? 'text-brand-600 border-b-2 border-brand-600 -mb-px'
                : 'text-brand-400 hover:text-brand-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        {/* Dados gerais */}
        {tab === 'dados' && (
          loadingDados ? <Spinner /> : error ? <ErrorMsg msg={error} /> : detalhe ? (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <FieldLabel>Controle PNCP</FieldLabel>
                  <FieldValue mono>{detalhe.numeroControlePNCP}</FieldValue>
                </div>
                <div>
                  <FieldLabel>Modo de Disputa</FieldLabel>
                  <FieldValue>{detalhe.modoDisputaNome ?? '—'}</FieldValue>
                </div>
                <div>
                  <FieldLabel>Valor Total Estimado</FieldLabel>
                  <FieldValue>{formatCurrency(detalhe.valorTotalEstimado)}</FieldValue>
                </div>
                <div>
                  <FieldLabel>Valor Total Homologado</FieldLabel>
                  <FieldValue>{formatCurrency(detalhe.valorTotalHomologado)}</FieldValue>
                </div>
                <div>
                  <FieldLabel>Tipo de Instrumento</FieldLabel>
                  <FieldValue>{detalhe.tipoInstrumentoConvocatorioNome}</FieldValue>
                </div>
                <div>
                  <FieldLabel>Modalidade</FieldLabel>
                  <FieldValue>{detalhe.modalidadeNome}</FieldValue>
                </div>
              </div>

              {detalhe.amparoLegal && (
                <div>
                  <FieldLabel>Amparo Legal</FieldLabel>
                  <p className="mt-1 text-xs text-brand-900 bg-surface-low p-2.5 rounded-lg border border-outline-variant/20 leading-relaxed">
                    {detalhe.amparoLegal.nome} — {detalhe.amparoLegal.descricao}
                  </p>
                </div>
              )}

              <div>
                <FieldLabel>Objeto da Contratação</FieldLabel>
                <p className="mt-1 text-xs text-brand-900 leading-relaxed whitespace-pre-wrap">{detalhe.objetoCompra}</p>
              </div>

              {detalhe.informacaoComplementar && (
                <div>
                  <FieldLabel>Informações Complementares</FieldLabel>
                  <p className="mt-1 text-xs text-brand-400 leading-relaxed">{detalhe.informacaoComplementar}</p>
                </div>
              )}

              {(detalhe.linkSistemaOrigem || detalhe.linkProcessoEletronico) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {detalhe.linkSistemaOrigem && (
                    <a href={detalhe.linkSistemaOrigem} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 bg-surface-low px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-surface-high transition-colors">
                      <IconExternal />Sistema de origem
                    </a>
                  )}
                  {detalhe.linkProcessoEletronico && (
                    <a href={detalhe.linkProcessoEletronico} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 bg-surface-low px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-surface-high transition-colors">
                      <IconExternal />Processo eletrônico
                    </a>
                  )}
                  <a href={`https://pncp.gov.br/app/editais/${item.orgaoEntidade.cnpj}/${item.anoCompra}/${item.sequencialCompra}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 bg-surface-low px-3 py-1.5 text-xs font-semibold text-brand-400 hover:bg-surface-high transition-colors">
                    <IconExternal />Ver no PNCP
                  </a>
                </div>
              )}
            </div>
          ) : null
        )}

        {/* Órgão/Unidade */}
        {tab === 'orgao' && (
          loadingDados ? <Spinner /> : error ? <ErrorMsg msg={error} /> : detalhe ? (
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <FieldLabel>Razão Social</FieldLabel>
                  <FieldValue>{detalhe.orgaoEntidade.razaoSocial}</FieldValue>
                </div>
                <div>
                  <FieldLabel>CNPJ</FieldLabel>
                  <FieldValue mono>{detalhe.orgaoEntidade.cnpj}</FieldValue>
                </div>
                <div>
                  <FieldLabel>Esfera</FieldLabel>
                  <FieldValue>{ESFERA_MAP[detalhe.orgaoEntidade.esferaId] ?? detalhe.orgaoEntidade.esferaId}</FieldValue>
                </div>
                <div>
                  <FieldLabel>Poder</FieldLabel>
                  <FieldValue>{PODER_MAP[detalhe.orgaoEntidade.poderId] ?? detalhe.orgaoEntidade.poderId}</FieldValue>
                </div>
              </div>
              <div className="rounded-lg border border-outline-variant/20 bg-surface-low p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Unidade Executora</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <FieldLabel>Nome</FieldLabel>
                    <FieldValue>{detalhe.unidadeOrgao.nomeUnidade}</FieldValue>
                  </div>
                  <div>
                    <FieldLabel>Código</FieldLabel>
                    <FieldValue mono>{detalhe.unidadeOrgao.codigoUnidade}</FieldValue>
                  </div>
                  <div>
                    <FieldLabel>UF</FieldLabel>
                    <FieldValue>{detalhe.unidadeOrgao.ufNome} ({detalhe.unidadeOrgao.ufSigla})</FieldValue>
                  </div>
                  <div>
                    <FieldLabel>Município</FieldLabel>
                    <FieldValue>{detalhe.unidadeOrgao.municipioNome}</FieldValue>
                  </div>
                  {detalhe.unidadeOrgao.codigoIbge && (
                    <div>
                      <FieldLabel>Cód. IBGE</FieldLabel>
                      <FieldValue mono>{detalhe.unidadeOrgao.codigoIbge}</FieldValue>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null
        )}

        {/* Datas */}
        {tab === 'datas' && (
          loadingDados ? <Spinner /> : error ? <ErrorMsg msg={error} /> : detalhe ? (
            <div className="p-6 space-y-4">
              {[
                { label: 'Abertura de Propostas', value: detalhe.dataAberturaProposta, highlight: true },
                { label: 'Encerramento de Propostas', value: detalhe.dataEncerramentoProposta, highlight: true },
                { label: 'Publicação no PNCP', value: detalhe.dataPublicacaoPncp, highlight: false },
                { label: 'Inclusão', value: detalhe.dataInclusao, highlight: false },
                { label: 'Última Atualização', value: detalhe.dataAtualizacao, highlight: false },
              ].map(({ label, value, highlight }) => (
                <div key={label} className={`rounded-lg p-3 ${highlight ? 'bg-brand-50 border border-brand-200/40' : 'bg-surface-low border border-outline-variant/10'}`}>
                  <FieldLabel>{label}</FieldLabel>
                  <p className={`text-sm font-semibold mt-0.5 ${highlight ? 'text-brand-600' : 'text-brand-900'}`}>{formatDateTime(value)}</p>
                </div>
              ))}
            </div>
          ) : null
        )}

        {/* Itens */}
        {tab === 'itens' && (
          loadingItens ? <Spinner /> : !itens || itens.length === 0 ? (
            <EmptyState msg="Nenhum item disponível para esta contratação" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-high sticky top-0">
                  <tr>
                    {['Nº', 'Descrição', 'Qtd.', 'Unid.', 'Vl. Unit.', 'Vl. Total'].map((h, i) => (
                      <th key={h} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-brand-400 ${i >= 2 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {itens.map((it, i) => (
                    <tr key={it.numeroItem} className="hover:bg-surface-low/50 transition-colors">
                      <td className="px-4 py-3 text-brand-400 tabular-nums text-xs">{i + 1}</td>
                      <td className="max-w-[200px] px-4 py-3">
                        <p className="text-xs text-brand-900 leading-snug">{it.descricao}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="rounded bg-surface-highest px-1.5 py-0.5 text-[9px] text-brand-400">{it.materialOuServicoNome}</span>
                          {it.tipoBeneficioNome !== 'Não se aplica' && (
                            <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[9px] text-brand-600">{it.tipoBeneficioNome}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs text-brand-900">{it.quantidade.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-3 text-xs text-brand-400 whitespace-nowrap">{it.unidadeMedida}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs text-brand-900 whitespace-nowrap">{formatCurrency(it.valorUnitarioEstimado)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs font-semibold text-brand-600 whitespace-nowrap">{formatCurrency(it.valorTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-surface-high">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-brand-400 text-right">Total estimado</td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs font-bold text-brand-600 whitespace-nowrap">
                      {formatCurrency(itens.reduce((s, it) => s + (it.valorTotal ?? 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        )}

        {/* Arquivos */}
        {tab === 'arquivos' && (
          loadingArquivos ? <Spinner /> : !arquivos || arquivos.length === 0 ? (
            <EmptyState msg="Nenhum arquivo disponível para esta contratação" />
          ) : (
            <div className="divide-y divide-outline-variant/10">
              {arquivos.map((arq) => (
                <div key={arq.sequencialDocumento} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-low/50 transition-colors">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${arq.tipoDocumentoId === 2 ? 'bg-brand-50 text-brand-600' : 'bg-surface-highest text-brand-400'}`}>
                    <IconDoc />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-brand-900">{arq.titulo}</p>
                    <p className="mt-0.5 text-xs text-brand-400">{arq.tipoDocumentoNome} · {formatDate(arq.dataPublicacaoPncp)}</p>
                  </div>
                  {arq.statusAtivo && (
                    <a href={arq.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-outline-variant/30 bg-white px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-surface-low transition-colors">
                      <IconDownload />Baixar
                    </a>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 p-5 bg-surface-high border-t border-outline-variant/20">
        <button
          onClick={() => onImportar(item)}
          disabled={importing || loadingDados}
          className="w-full bg-gradient-to-r from-brand-600 to-brand-500 text-white py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-opacity shadow-lg shadow-brand-600/20"
        >
          {importing ? (
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <IconDownload />
          )}
          {importing ? 'Baixando PDF...' : 'IMPORTAR EDITAL'}
        </button>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function BuscarPncpPage() {
  const router = useRouter()
  const { getToken } = useAuth()

  // ── Filter state ──
  const [tipoBusca, setTipoBusca]   = useState<TipoBusca>('proposta')
  const [status, setStatus]         = useState<StatusBusca>('a_receber')
  const [dataInicialInput, setDataInicialInput] = useState(offsetDate(0))
  const [dataFinalInput, setDataFinalInput]     = useState(offsetDate(60))
  const [modalidade, setModalidade] = useState('')
  const [selectedUfs, setSelectedUfs] = useState<string[]>([])
  const [esfera, setEsfera]         = useState('')
  const [poder, setPoder]           = useState('')
  const [fonteOrcamentaria, setFonteOrcamentaria] = useState('')
  const [tipoInstrumento, setTipoInstrumento]     = useState('')
  const [palavrasChave, setPalavrasChave] = useState<string[]>([])
  const [palavraInput, setPalavraInput]   = useState('')
  const [valorMode, setValorMode]   = useState<'qualquer' | 'acima' | 'abaixo' | 'entre'>('qualquer')
  const [valorMin, setValorMin]     = useState('')
  const [valorMax, setValorMax]     = useState('')

  // ── Município state ──
  const [selectedMunicipios, setSelectedMunicipios] = useState<string[]>([])
  const [municipiosDisponiveis, setMunicipiosDisponiveis] = useState<Municipio[]>([])
  const [loadingMunicipios, setLoadingMunicipios] = useState(false)
  const [municipiosSearch, setMunicipiosSearch] = useState('')

  // ── Dropdown open state ──
  const [ufsOpen, setUfsOpen]           = useState(false)
  const [municipiosOpen, setMunicipiosOpen] = useState(false)
  const ufsRef       = useRef<HTMLDivElement>(null)
  const municipiosRef = useRef<HTMLDivElement>(null)

  // ── Fechar dropdowns ao clicar fora ──
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ufsRef.current && !ufsRef.current.contains(e.target as Node)) setUfsOpen(false)
      if (municipiosRef.current && !municipiosRef.current.contains(e.target as Node)) setMunicipiosOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Carregar municípios quando UFs mudam ──
  useEffect(() => {
    if (selectedUfs.length === 0) {
      setMunicipiosDisponiveis([])
      setSelectedMunicipios([])
      return
    }
    setLoadingMunicipios(true)
    fetchMunicipiosByUfs(selectedUfs)
      .then(setMunicipiosDisponiveis)
      .finally(() => setLoadingMunicipios(false))
    // Remove municipios selecionados que não pertencem mais às UFs selecionadas
    setSelectedMunicipios([])
  }, [selectedUfs])

  // ── Cache state ──
  const [usarCache, setUsarCache]     = useState(false)
  const [cacheConfig, setCacheConfig] = useState<{ ufs: string[]; lastSyncedAt: string | null; lastSyncStatus: string | null } | null>(null)
  const syncPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchCacheConfig = useCallback(async () => {
    try {
      const token = await getToken()
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_URL}/api/pncp-cache/config`, { headers })
      if (res.ok) {
        const data = await res.json() as { ufs: string[]; lastSyncedAt: string | null; lastSyncStatus: string | null }
        setCacheConfig(data)
        if (data.ufs.length > 0) {
          setUsarCache(true)
          // Cache armazena datas de publicação (passado), não de abertura de propostas (futuro)
          setDataInicialInput(offsetDate(-30))
          setDataFinalInput(offsetDate(0))
        }
      }
    } catch { /* silencioso */ }
  }, [getToken])

  useEffect(() => {
    fetchCacheConfig()
    return () => { if (syncPollRef.current) clearInterval(syncPollRef.current) }
  }, [fetchCacheConfig])

  // ── Search state ──
  const [loading, setLoading]         = useState(false)
  const [rawResult, setRawResult]     = useState<PncpResult | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [filteredPage, setFilteredPage] = useState(1)
  const [hasMorePages, setHasMorePages] = useState(false)
  const [totalApiRegistros, setTotalApiRegistros] = useState(0)
  const [totalApiPaginas, setTotalApiPaginas]   = useState(0)
  const [detalheItem, setDetalheItem] = useState<PncpContratacao | null>(null)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [cacheTotal, setCacheTotal]   = useState(0)
  const [cacheTotalPages, setCacheTotalPages] = useState(1)
  const [cachePage, setCachePage]     = useState(1)
  const ITEMS_PER_PAGE = 20

  // ── Normalização para busca sem acento ──
  function normalizar(s: string) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  }

  // ── Client-side filtered + paginated results ──
  const nomeOrgao = (item: PncpContratacao) =>
    item.orgaoEntidade.razaoSocial ?? item.orgaoEntidade.nome ?? ''

  const filteredData: PncpContratacao[] = rawResult ? rawResult.data.filter((item) => {
    // Multi-palavra-chave: OR entre palavras, sem distinção de acento
    if (palavrasChave.length > 0) {
      const campos = [
        item.objetoCompra ?? '',
        nomeOrgao(item),
        item.numeroCompra ?? '',
        item.unidadeOrgao?.nomeUnidade ?? '',
      ].map(normalizar)
      if (!palavrasChave.some(kw => campos.some(c => c.includes(normalizar(kw))))) return false
    }
    // Filtro de município client-side
    if (selectedMunicipios.length > 0) {
      const mun = normalizar(item.unidadeOrgao?.municipioNome ?? '')
      if (!selectedMunicipios.some(m => mun.includes(normalizar(m)))) return false
    }
    if (status === 'a_receber' && item.situacaoCompraId !== 1) return false
    if (status === 'em_julgamento' && item.situacaoCompraId === 1) return false
    if (status === 'encerradas' && item.situacaoCompraId === 1) return false
    if (tipoInstrumento && String(item.tipoInstrumentoConvocatorioCodigo) !== tipoInstrumento) return false
    if (esfera && item.orgaoEntidade.esferaId !== esfera) return false
    if (poder && item.orgaoEntidade.poderId !== poder) return false
    if (fonteOrcamentaria && item.fontesOrcamentarias) {
      if (!item.fontesOrcamentarias.some((f) => String(f.id) === fonteOrcamentaria)) return false
    }
    const parseVal = (s: string) => s ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : null
    const minVal = valorMode !== 'qualquer' && valorMode !== 'abaixo' ? parseVal(valorMin) : null
    const maxVal = valorMode !== 'qualquer' && valorMode !== 'acima' ? parseVal(valorMax) : null
    if (minVal !== null && (item.valorTotalEstimado ?? 0) < minVal) return false
    if (maxVal !== null && (item.valorTotalEstimado ?? Infinity) > maxVal) return false
    return true
  }) : []

  const filteredTotalPages = usarCache ? cacheTotalPages : Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE))
  const currentPage = usarCache ? cachePage : filteredPage
  const pageData = usarCache
    ? (rawResult?.data ?? [])  // cache retorna a página já paginada da API
    : filteredData.slice((filteredPage - 1) * ITEMS_PER_PAGE, filteredPage * ITEMS_PER_PAGE)

  function aplicarStatusRapido(s: StatusBusca) {
    const tipo: TipoBusca = s === 'a_receber' ? 'proposta' : 'publicacao'
    setStatus(s)
    setTipoBusca(tipo)
    if (s === 'a_receber')      { setDataInicialInput(offsetDate(0));   setDataFinalInput(offsetDate(60)) }
    else if (s === 'em_julgamento') { setDataInicialInput(offsetDate(-7));  setDataFinalInput(offsetDate(0)) }
    else if (s === 'encerradas')    { setDataInicialInput(offsetDate(-90)); setDataFinalInput(offsetDate(0)) }
    else                            { setDataInicialInput(offsetDate(-30)); setDataFinalInput(offsetDate(0)) }
  }

  function limpar() {
    setPalavrasChave([]); setPalavraInput(''); setModalidade('')
    setSelectedUfs([]); setEsfera('')
    setPoder(''); setFonteOrcamentaria(''); setTipoInstrumento('')
    setValorMode('qualquer'); setValorMin(''); setValorMax('')
    setSelectedMunicipios([]); setMunicipiosSearch('')
    setTipoBusca('proposta'); setStatus('a_receber')
    setDataInicialInput(usarCache ? offsetDate(-30) : offsetDate(0))
    setDataFinalInput(usarCache ? offsetDate(0) : offsetDate(60))
    setRawResult(null); setError(null); setFilteredPage(1)
    setHasMorePages(false); setTotalApiRegistros(0); setTotalApiPaginas(0)
    setCacheTotal(0); setCacheTotalPages(1); setCachePage(1)
  }

  async function buscarCache(page = 1) {
    setLoading(true); setError(null); setCachePage(page)
    try {
      const token = await getToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      const sp = new URLSearchParams({ page: String(page), limit: String(ITEMS_PER_PAGE), sortBy: 'dataPublicacaoPncp', sortOrder: 'desc' })
      if (dataInicialInput) sp.set('dataInicial', toYYYYMMDD(dataInicialInput))
      if (dataFinalInput)   sp.set('dataFinal', toYYYYMMDD(dataFinalInput))
      if (modalidade)       sp.set('modalidade', modalidade)
      if (selectedUfs.length > 0) sp.set('ufs', selectedUfs.join(','))
      if (palavrasChave.length > 0) sp.set('objeto', palavrasChave[0] ?? '')
      if (selectedMunicipios.length > 0) {
        // Cache filtra por nome (codigoMunicipioIbge não está disponível no cache)
        sp.set('nomeMunicipio', selectedMunicipios[0] ?? '')
      }
      const parseVal = (s: string) => s ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : null
      const minVal = valorMode !== 'qualquer' && valorMode !== 'abaixo' ? parseVal(valorMin) : null
      const maxVal = valorMode !== 'qualquer' && valorMode !== 'acima' ? parseVal(valorMax) : null
      if (minVal !== null) sp.set('valorMin', String(minVal))
      if (maxVal !== null) sp.set('valorMax', String(maxVal))

      const res = await fetch(`${API_URL}/api/pncp-cache/buscar?${sp.toString()}`, { headers })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const data = await res.json() as { source: string; cacheEmpty?: boolean; data: PncpContratacao[]; total: number; totalPages: number; lastSyncedAt?: string | null }

      if (data.cacheEmpty) {
        setError('Cache não configurado para as UFs selecionadas. Ative o monitoramento em Configurações > Monitoramento PNCP.')
        setUsarCache(false)
        return
      }
      setCacheTotal(data.total)
      setCacheTotalPages(data.totalPages)
      setRawResult({ data: data.data, totalRegistros: data.total, totalPaginas: data.totalPages, numeroPagina: page, empty: data.data.length === 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar no cache')
    } finally {
      setLoading(false)
    }
  }

  async function buscar() {
    if (tipoBusca === 'proposta') {
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
      const dataFinal = dataFinalInput ? new Date(dataFinalInput + 'T00:00:00') : null
      if (!dataFinal || dataFinal < hoje) {
        setError('Para busca por proposta aberta, a Data Final deve ser igual ou posterior à data de hoje. Use o tipo "Publicação" para consultar editais publicados em datas passadas.')
        return
      }
    }
    setLoading(true); setError(null); setFilteredPage(1); setHasMorePages(false)

    try {
      const token = await getToken()
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

      const buildParams = (p: number) => {
        const sp = new URLSearchParams({
          tipo: tipoBusca,
          dataFinal: dataFinalInput ? toYYYYMMDD(dataFinalInput) : toYYYYMMDD(tipoBusca === 'proposta' ? offsetDate(60) : offsetDate(0)),
          pagina: String(p),
          tamanhoPagina: '50',
        })
        if (dataInicialInput) sp.set('dataInicial', toYYYYMMDD(dataInicialInput))
        if (modalidade) sp.set('codigoModalidadeContratacao', modalidade)
        if (selectedUfs.length > 0) sp.set('ufs', selectedUfs.join(','))
        return sp
      }

      const fetchPage = async (p: number): Promise<PncpResult | null> => {
        try {
          const res = await fetch(`${API_URL}/api/editais/pncp/buscar?${buildParams(p)}`, { headers })
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error((data as { error?: { message?: string } })?.error?.message ?? `Erro ${res.status}`)
          }
          return res.json() as Promise<PncpResult>
        } catch {
          return null
        }
      }

      // Busca página 1 para saber o total
      const page1 = await fetchPage(1)
      if (!page1) throw new Error('Erro ao consultar PNCP')

      setTotalApiRegistros(page1.totalRegistros)
      setTotalApiPaginas(page1.totalPaginas)

      let allData = [...page1.data]

      // Busca todas as páginas restantes em paralelo (limite: 10 páginas)
      if (page1.totalPaginas > 1) {
        const MAX_PAGES = 10
        const remaining = Array.from(
          { length: Math.min(page1.totalPaginas - 1, MAX_PAGES - 1) },
          (_, i) => i + 2
        )
        if (page1.totalPaginas > MAX_PAGES) setHasMorePages(true)

        const others = await Promise.all(remaining.map(p => fetchPage(p)))
        for (const r of others) if (r) allData.push(...r.data)

        // Deduplicar por chave composta
        const seen = new Set<string>()
        allData = allData.filter(item => {
          const k = `${item.anoCompra}-${item.sequencialCompra}-${item.orgaoEntidade.cnpj}`
          return seen.has(k) ? false : (seen.add(k), true)
        })
      }

      setRawResult({ data: allData, totalRegistros: page1.totalRegistros, totalPaginas: page1.totalPaginas, numeroPagina: 1, empty: allData.length === 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao consultar PNCP')
    } finally {
      setLoading(false)
    }
  }

  async function importar(item: PncpContratacao) {
    const key = `${item.anoCompra}-${item.sequencialCompra}`
    setImportingId(key)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/editais/pncp/importar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(item),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: { message?: string } })?.error?.message ?? `Erro ${res.status}`)
      }
      const resultData = await res.json() as { editalId: string; jobId?: string }
      if (!resultData.jobId) {
        alert('Edital importado. Nenhum arquivo PDF foi encontrado no PNCP — faça o upload manual do PDF na tela do edital.')
      }
      router.push(`/editais/${resultData.editalId}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao importar edital')
    } finally {
      setImportingId(null)
    }
  }

  // Page numbers helper
  function pageNumbers(current: number, total: number): (number | '…')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    const pages: (number | '…')[] = [1]
    if (current > 3) pages.push('…')
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i)
    if (current < total - 2) pages.push('…')
    pages.push(total)
    return pages
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Right-side drawer */}
      {detalheItem && (
        <DetalheDrawer
          item={detalheItem}
          onClose={() => setDetalheItem(null)}
          onImportar={(item) => { setDetalheItem(null); importar(item) }}
          importing={importingId === `${detalheItem.anoCompra}-${detalheItem.sequencialCompra}`}
        />
      )}

      {/* Page header */}
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-600 tracking-tight">Buscar no PNCP</h2>
          <p className="text-brand-400 text-sm mt-0.5">Integração direta com o Portal Nacional de Contratações Públicas</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex bg-surface-highest p-1 rounded-lg gap-1">
            <button
              onClick={() => { setUsarCache(true); setRawResult(null); setDataInicialInput(offsetDate(-30)); setDataFinalInput(offsetDate(0)) }}
              disabled={!cacheConfig || (cacheConfig.ufs.length === 0)}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                usarCache ? 'bg-brand-600 text-white shadow-md' : 'text-brand-400 hover:text-brand-600'
              }`}
              title={!cacheConfig || cacheConfig.ufs.length === 0 ? 'Configure o monitoramento em Configurações > Monitoramento PNCP' : undefined}
            >
              <span className="material-symbols-outlined text-[0.85rem]">database</span>
              Cache local
            </button>
            <button
              onClick={() => { setUsarCache(false); setRawResult(null); setDataInicialInput(offsetDate(0)); setDataFinalInput(offsetDate(60)) }}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                !usarCache ? 'bg-brand-600 text-white shadow-md' : 'text-brand-400 hover:text-brand-600'
              }`}
            >
              <span className="material-symbols-outlined text-[0.85rem]">wifi</span>
              Busca ao vivo
            </button>
          </div>
          {usarCache && cacheConfig?.lastSyncedAt && (
            <p className="text-[10px] text-brand-400 flex items-center gap-1">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${cacheConfig.lastSyncStatus === 'running' ? 'bg-blue-400 animate-pulse' : 'bg-green-400'}`} />
              {cacheConfig.lastSyncStatus === 'running' ? 'Sincronizando...' : `Cache atualizado ${formatCacheTime(cacheConfig.lastSyncedAt)}`}
            </p>
          )}
          {usarCache && (!cacheConfig || cacheConfig.ufs.length === 0) && (
            <p className="text-[10px] text-amber-500">
              ⚠ Sem cache configurado —{' '}
              <a href="/configuracoes/monitoramento-pncp" className="underline">configurar</a>
            </p>
          )}
        </div>
      </section>

      {/* ── Filter card ── */}
      <section className="rounded-xl bg-surface-low p-6 border border-outline-variant/10">
        {/* Row 1: Tipo tabs + Status rápido */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Tipo tabs */}
          <div className="flex bg-surface-highest p-1 rounded-lg gap-1">
            {([
              { value: 'publicacao' as TipoBusca, label: 'Publicação' },
              { value: 'proposta'   as TipoBusca, label: 'Proposta' },
            ]).map((t) => (
              <button
                key={t.value}
                onClick={() => {
                  setTipoBusca(t.value)
                  if (t.value === 'proposta') setStatus('a_receber')
                }}
                className={`px-6 py-2 text-sm font-semibold rounded-md transition-all ${
                  tipoBusca === t.value
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'text-brand-400 hover:text-brand-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Quick status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400 mr-1">Status Rápido:</span>
            {([
              { value: 'a_receber'     as StatusBusca, label: 'A Receber' },
              { value: 'em_julgamento' as StatusBusca, label: 'Em Julgamento' },
              { value: 'encerradas'    as StatusBusca, label: 'Encerradas' },
              { value: 'todos'         as StatusBusca, label: 'Todos' },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => aplicarStatusRapido(opt.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  status === opt.value
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-highest text-brand-600 hover:bg-brand-600 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Data + Modalidade + botão */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
          {/* Data Inicial */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Data Inicial</label>
            <input
              type="date"
              value={dataInicialInput}
              onChange={(e) => setDataInicialInput(e.target.value)}
              className="bg-white border border-outline-variant/40 rounded-lg px-3 py-2 text-sm text-brand-900 focus:ring-1 focus:ring-brand-600 focus:border-brand-600 outline-none"
            />
          </div>
          {/* Data Final */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
              Data Final
              {tipoBusca === 'proposta' && <span className="ml-1 normal-case text-[9px] text-amber-500 font-normal">(≥ hoje)</span>}
            </label>
            <input
              type="date"
              value={dataFinalInput}
              min={tipoBusca === 'proposta' ? offsetDate(0) : undefined}
              onChange={(e) => setDataFinalInput(e.target.value)}
              className="bg-white border border-outline-variant/40 rounded-lg px-3 py-2 text-sm text-brand-900 focus:ring-1 focus:ring-brand-600 focus:border-brand-600 outline-none"
            />
          </div>
          {/* Modalidade */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Modalidade</label>
            <select
              value={modalidade}
              onChange={(e) => setModalidade(e.target.value)}
              className="bg-white border border-outline-variant/40 rounded-lg px-3 py-2 text-sm text-brand-900 focus:ring-1 focus:ring-brand-600 outline-none"
            >
              <option value="">Todas</option>
              {MODALIDADES.map((m) => <option key={m.id} value={String(m.id)}>{m.nome}</option>)}
            </select>
          </div>
          {/* Esfera */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Esfera</label>
            <select
              value={esfera}
              onChange={(e) => setEsfera(e.target.value)}
              className="bg-white border border-outline-variant/40 rounded-lg px-3 py-2 text-sm text-brand-900 focus:ring-1 focus:ring-brand-600 outline-none"
            >
              <option value="">Todas</option>
              {ESFERAS.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
          {/* Poder */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Poder</label>
            <select
              value={poder}
              onChange={(e) => setPoder(e.target.value)}
              className="bg-white border border-outline-variant/40 rounded-lg px-3 py-2 text-sm text-brand-900 focus:ring-1 focus:ring-brand-600 outline-none"
            >
              <option value="">Todos</option>
              {PODERES.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          {/* Filtrar */}
          <div className="flex items-end">
            <button
              onClick={() => usarCache ? buscarCache(1) : buscar()}
              disabled={loading}
              className="w-full bg-gradient-to-r from-brand-600 to-brand-500 text-white py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {loading ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <IconFilter />
              )}
              {loading ? 'Buscando...' : 'Filtrar Resultados'}
            </button>
          </div>
        </div>

        {/* Row 3: Estados + Municípios + Palavras-chave + Valor */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">

          {/* Multi-estados */}
          <div className="flex flex-col gap-1.5" ref={ufsRef}>
            <label className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
              Estados{selectedUfs.length > 0 && <span className="ml-1 text-brand-600">({selectedUfs.length} selecionados)</span>}
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setUfsOpen(v => !v)}
                className="w-full text-left bg-white border border-outline-variant/40 rounded-lg px-3 py-2 text-sm text-brand-900 focus:ring-1 focus:ring-brand-600 outline-none flex items-center justify-between"
              >
                <span className={selectedUfs.length === 0 ? 'text-brand-400/50' : ''}>
                  {selectedUfs.length === 0 ? 'Todos os estados' : selectedUfs.join(', ')}
                </span>
                <svg className={`h-4 w-4 text-brand-400 transition-transform ${ufsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
              </button>
              {ufsOpen && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-outline-variant/30 rounded-xl shadow-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant/20">
                    <button
                      type="button"
                      onClick={() => setSelectedUfs(UF_LIST.map(u => u.sigla))}
                      className="text-[10px] font-bold text-brand-600 hover:text-brand-800"
                    >Selecionar todos</button>
                    <button
                      type="button"
                      onClick={() => setSelectedUfs([])}
                      className="text-[10px] font-bold text-brand-400 hover:text-brand-600"
                    >Limpar</button>
                  </div>
                  <div className="max-h-52 overflow-y-auto py-1">
                    {UF_LIST.map(uf => (
                      <label key={uf.sigla} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-surface-low cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedUfs.includes(uf.sigla)}
                          onChange={e => {
                            setSelectedUfs(prev =>
                              e.target.checked ? [...prev, uf.sigla] : prev.filter(s => s !== uf.sigla)
                            )
                          }}
                          className="h-3.5 w-3.5 rounded text-brand-600 border-outline-variant/40"
                        />
                        <span className="text-xs text-brand-900">{uf.sigla} — {uf.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Multi-municípios */}
          <div className="flex flex-col gap-1.5" ref={municipiosRef}>
            <label className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
              Municípios
              {loadingMunicipios && <span className="ml-1 text-brand-400/60">(carregando...)</span>}
              {selectedMunicipios.length > 0 && <span className="ml-1 text-brand-600">({selectedMunicipios.length} selecionados)</span>}
            </label>
            <div className="relative">
              <button
                type="button"
                disabled={selectedUfs.length === 0}
                onClick={() => setMunicipiosOpen(v => !v)}
                className="w-full text-left bg-white border border-outline-variant/40 rounded-lg px-3 py-2 text-sm text-brand-900 focus:ring-1 focus:ring-brand-600 outline-none flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className={selectedMunicipios.length === 0 ? 'text-brand-400/50' : ''}>
                  {selectedUfs.length === 0
                    ? 'Selecione estados primeiro'
                    : selectedMunicipios.length === 0
                      ? 'Todos os municípios'
                      : selectedMunicipios.length === 1
                        ? selectedMunicipios[0]
                        : `${selectedMunicipios[0]} +${selectedMunicipios.length - 1}`}
                </span>
                <svg className={`h-4 w-4 text-brand-400 transition-transform ${municipiosOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
              </button>
              {municipiosOpen && municipiosDisponiveis.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-outline-variant/30 rounded-xl shadow-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-outline-variant/20">
                    <input
                      type="text"
                      value={municipiosSearch}
                      onChange={e => setMunicipiosSearch(e.target.value)}
                      placeholder="Buscar município..."
                      className="w-full text-xs bg-surface-low border border-outline-variant/30 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-brand-600"
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-outline-variant/10">
                    <button type="button" onClick={() => setSelectedMunicipios([])} className="text-[10px] font-bold text-brand-400 hover:text-brand-600">Limpar</button>
                    <span className="text-[10px] text-brand-400">{municipiosDisponiveis.length} municípios</span>
                  </div>
                  <div className="max-h-52 overflow-y-auto py-1">
                    {municipiosDisponiveis
                      .filter(m => !municipiosSearch || m.nome.toLowerCase().includes(municipiosSearch.toLowerCase()))
                      .map(m => (
                        <label key={m.id} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-surface-low cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedMunicipios.includes(m.nome)}
                            onChange={e => {
                              setSelectedMunicipios(prev =>
                                e.target.checked ? [...prev, m.nome] : prev.filter(n => n !== m.nome)
                              )
                            }}
                            className="h-3.5 w-3.5 rounded text-brand-600 border-outline-variant/40"
                          />
                          <span className="text-xs text-brand-900">{m.nome}</span>
                          {selectedUfs.length > 1 && <span className="ml-auto text-[9px] text-brand-400">{m.uf}</span>}
                        </label>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Palavras-chave (multi-tag) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Palavras-chave</label>
            <div className="bg-white border border-outline-variant/40 rounded-lg px-2 py-1.5 min-h-[38px] flex flex-wrap gap-1 focus-within:ring-1 focus-within:ring-brand-600">
              {palavrasChave.map(kw => (
                <span key={kw} className="inline-flex items-center gap-1 bg-brand-600/10 text-brand-600 text-[11px] font-semibold rounded-md px-2 py-0.5">
                  {kw}
                  <button
                    type="button"
                    onClick={() => setPalavrasChave(prev => prev.filter(k => k !== kw))}
                    className="text-brand-400 hover:text-brand-700 leading-none ml-0.5"
                  >×</button>
                </span>
              ))}
              <input
                type="text"
                value={palavraInput}
                onChange={e => setPalavraInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ',') && palavraInput.trim()) {
                    e.preventDefault()
                    const nova = palavraInput.trim().replace(/,$/, '')
                    if (nova && !palavrasChave.includes(nova)) setPalavrasChave(prev => [...prev, nova])
                    setPalavraInput('')
                  } else if (e.key === 'Backspace' && !palavraInput && palavrasChave.length > 0) {
                    setPalavrasChave(prev => prev.slice(0, -1))
                  }
                }}
                placeholder={palavrasChave.length === 0 ? 'Ex: construção, reforma...' : ''}
                className="flex-1 min-w-[80px] text-sm text-brand-900 placeholder:text-brand-400/50 outline-none bg-transparent py-0.5"
              />
            </div>
            <p className="text-[9px] text-brand-400/70">Enter ou vírgula para adicionar · Backspace para remover</p>
          </div>

          {/* Filtro de valor */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Valor estimado</label>
            <div className="flex gap-1 mb-1.5">
              {(['qualquer', 'acima', 'abaixo', 'entre'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setValorMode(mode)}
                  className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${
                    valorMode === mode ? 'bg-brand-600 text-white' : 'bg-surface-highest text-brand-400 hover:text-brand-600'
                  }`}
                >
                  {mode === 'qualquer' ? 'Qualquer' : mode === 'acima' ? 'Acima' : mode === 'abaixo' ? 'Abaixo' : 'Entre'}
                </button>
              ))}
            </div>
            {valorMode !== 'qualquer' && (
              <div className="flex gap-1.5">
                {(valorMode === 'acima' || valorMode === 'entre') && (
                  <input
                    type="text"
                    value={valorMin}
                    onChange={e => setValorMin(formatarValorBR(e.target.value))}
                    placeholder="Ex: 500.000"
                    className="flex-1 bg-white border border-outline-variant/40 rounded-lg px-2 py-1.5 text-xs text-brand-900 placeholder:text-brand-400/50 focus:ring-1 focus:ring-brand-600 outline-none"
                  />
                )}
                {(valorMode === 'abaixo' || valorMode === 'entre') && (
                  <input
                    type="text"
                    value={valorMax}
                    onChange={e => setValorMax(formatarValorBR(e.target.value))}
                    placeholder="Ex: 5.000.000"
                    className="flex-1 bg-white border border-outline-variant/40 rounded-lg px-2 py-1.5 text-xs text-brand-900 placeholder:text-brand-400/50 focus:ring-1 focus:ring-brand-600 outline-none"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {tipoBusca === 'publicacao' && !modalidade && (
          <p className="mt-3 text-[11px] text-amber-600">⚠ Para pesquisar por publicação, selecione uma Modalidade da Contratação</p>
        )}

        <div className="mt-4 flex items-center justify-between">
          <button onClick={limpar} className="text-xs font-medium text-brand-400 hover:text-brand-600 transition-colors">
            Limpar filtros
          </button>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4">
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {rawResult && (
        <div className="bg-white rounded-xl border border-outline-variant/10 shadow-sm overflow-hidden">
          {pageData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-sm font-semibold text-brand-900">Nenhum resultado encontrado</p>
              <p className="mt-1 text-xs text-brand-400">Ajuste os filtros e pesquise novamente</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-high">
                  <tr>
                    {[
                      { label: 'Objeto',         cls: '' },
                      { label: 'Órgão',          cls: '' },
                      { label: 'Modalidade',     cls: '' },
                      { label: 'Local',          cls: '' },
                      { label: 'Valor Estimado', cls: 'text-right' },
                      { label: tipoBusca === 'proposta' ? 'Abertura' : 'Publicação', cls: '' },
                      { label: 'Ações',          cls: 'text-center' },
                    ].map(({ label, cls }) => (
                      <th key={label} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-brand-400 ${cls}`}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {pageData.map((item) => {
                    const key = `${item.anoCompra}-${item.sequencialCompra}`
                    const isActive = detalheItem && `${detalheItem.anoCompra}-${detalheItem.sequencialCompra}` === key
                    const badge = situacaoBadge(item.situacaoCompraNome, item.situacaoCompraId)
                    return (
                      <tr
                        key={key}
                        className={`transition-colors cursor-pointer ${isActive ? 'bg-brand-600/5' : 'hover:bg-surface-low/60'}`}
                        onClick={() => setDetalheItem(item)}
                      >
                        <td className="px-4 py-4 max-w-xs">
                          <p className="text-sm font-medium text-brand-900 line-clamp-2">{item.objetoCompra}</p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-[10px] text-brand-400/70">{item.anoCompra}/{item.sequencialCompra}</span>
                            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${badge.bg} ${badge.text}`}>
                              <span className={`h-1 w-1 rounded-full ${badge.dot}`} />
                              {item.situacaoCompraNome.length > 18 ? item.situacaoCompraNome.slice(0, 16) + '…' : item.situacaoCompraNome}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-xs font-medium text-brand-900 truncate max-w-[180px]">{nomeOrgao(item) || '—'}</p>
                        </td>
                        <td className="px-4 py-4 text-xs text-brand-900 whitespace-nowrap">{item.modalidadeNome}</td>
                        <td className="px-4 py-4 text-xs text-brand-400 whitespace-nowrap">
                          {item.unidadeOrgao?.municipioNome
                            ? `${item.unidadeOrgao.municipioNome}${item.unidadeOrgao.ufSigla ? ` - ${item.unidadeOrgao.ufSigla}` : ''}`
                            : item.unidadeOrgao?.ufSigla ?? '—'}
                        </td>
                        <td className="px-4 py-4 text-right text-xs font-semibold text-brand-600 tabular-nums whitespace-nowrap">
                          {formatCurrency(item.valorTotalEstimado)}
                        </td>
                        <td className="px-4 py-4 text-[11px] text-brand-400 whitespace-nowrap">
                          {tipoBusca === 'proposta'
                            ? formatDate(item.dataAberturaProposta ?? item.dataPublicacaoPncp)
                            : formatDate(item.dataPublicacaoPncp)}
                        </td>
                        <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setDetalheItem(item)}
                            title="Ver detalhes"
                            className={`p-1.5 rounded transition-colors ${isActive ? 'bg-brand-600 text-white' : 'hover:bg-surface-highest text-brand-600'}`}
                          >
                            <IconEye />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination — client-side sobre resultados filtrados */}
          <footer className="px-6 py-3 border-t border-outline-variant/10 bg-surface-low flex flex-col gap-1.5">
            {hasMorePages && (
              <p className="text-[11px] text-amber-600">
                ⚠ Exibindo as primeiras 10 páginas da API ({rawResult?.data.length} registros carregados de {totalApiRegistros.toLocaleString('pt-BR')} no total). Adicione filtros de Estado ou Modalidade para refinar.
              </p>
            )}
            <div className="flex items-center justify-between">
              <p className="text-xs text-brand-400">
                <span className="font-bold text-brand-900">
                  {usarCache ? cacheTotal.toLocaleString('pt-BR') : filteredData.length.toLocaleString('pt-BR')}
                </span> resultado{(usarCache ? cacheTotal : filteredData.length) !== 1 ? 's' : ''}
                {usarCache
                  ? <> · <span className="text-green-600 font-medium">cache local</span></>
                  : <><span className="ml-2 text-brand-300">({totalApiRegistros.toLocaleString('pt-BR')} na API)</span></>
                }
                {filteredTotalPages > 1 && <> · Página <span className="font-bold text-brand-900">{currentPage} de {filteredTotalPages}</span></>}
              </p>
              {filteredTotalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => usarCache ? buscarCache(Math.max(1, cachePage - 1)) : setFilteredPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="w-8 h-8 flex items-center justify-center rounded border border-outline-variant/30 text-brand-400 hover:bg-brand-600 hover:text-white hover:border-brand-600 disabled:opacity-40 transition-all"
                  >
                    <IconChevLeft />
                  </button>
                  {pageNumbers(currentPage, filteredTotalPages).map((p, i) =>
                    p === '…' ? (
                      <span key={`dots-${i}`} className="w-8 h-8 flex items-center justify-center text-brand-400 text-xs">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => usarCache ? buscarCache(p as number) : setFilteredPage(p as number)}
                        className={`w-8 h-8 flex items-center justify-center rounded text-xs font-semibold transition-all ${
                          p === currentPage
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'border border-outline-variant/30 text-brand-400 hover:bg-surface-highest'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => usarCache ? buscarCache(Math.min(cacheTotalPages, cachePage + 1)) : setFilteredPage(p => Math.min(filteredTotalPages, p + 1))}
                    disabled={currentPage >= filteredTotalPages}
                    className="w-8 h-8 flex items-center justify-center rounded border border-outline-variant/30 text-brand-400 hover:bg-brand-600 hover:text-white hover:border-brand-600 disabled:opacity-40 transition-all"
                  >
                    <IconChevRight />
                  </button>
                </div>
              )}
            </div>
          </footer>
        </div>
      )}
    </div>
  )
}
