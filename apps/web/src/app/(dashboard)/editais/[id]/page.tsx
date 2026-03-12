'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Edital {
  id: string
  fileName: string
  orgaoLicitante: string | null
  uasg: string | null
  numeroEdital: string | null
  modalidade: string | null
  objeto: string | null
  valorEstimado: string | null
  dataAbertura: string | null
  status: string
  regimeExecucao: string | null
  leiRegente: string | null
  admiteConsorcio: boolean | null
  prazoExecucaoMeses: number | null
  aiExtractionCostUsd: string | null
  createdAt: string
}

interface Habilitacao {
  habilitacaoJuridica: Array<{ id: string; documento: string; aplicaA: string | null; observacao: string | null }>
  regularidadeFiscal: Array<{ id: string; documento: string; sigla: string | null; validadeDias: number | null; observacao: string | null }>
  qualificacaoTecnica: {
    registroConselho: string | null
    exigeVisitaTecnica: boolean
    visitaTipo: string | null
    exigeEscritorioLocal: boolean
    escritorioDescricao: string | null
  } | null
  profissionais: Array<{ id: string; cargo: string; conselho: string | null; quantidade: number | null; cbo: string | null; observacao: string | null }>
  parcelasRelevancia: Array<{ id: string; servico: string; unidade: string | null; quantidadeMinima: string | null; observacao: string | null }>
  atestadosProfissionais: Array<{ id: string; profissional: string; caracteristicasExigidas: string | null; exigeCat: boolean; observacao: string | null }>
  qualificacaoFinanceira: {
    exigeBalanco: boolean
    balancoExercicios: number | null
    patrimonioLiquidoMinimo: string | null
    lcMinimo: string | null
    lgMinimo: string | null
    sgMinimo: string | null
    exigeCertidaoFalencia: boolean
    certidaoFalenciaPrazoDias: number | null
    exigeCapitalSocialMinimo: boolean
    capitalSocialMinimo: string | null
    exigeGarantiaProposta: boolean
    garantiaPropostaPercentual: string | null
    observacao: string | null
  } | null
  declaracoes: Array<{ id: string; descricao: string; baseLegal: string | null; leiEstadual: boolean; penalidadeOmissao: string | null }>
  declaracoesEspeciais: Array<{ id: string; descricao: string; lei: string | null; uf: string | null }>
  alertas: Array<{ id: string; nivel: string; categoria: string | null; descricao: string }>
  anexosReferenciados: Array<{ id: string; identificacao: string; descricao: string | null }>
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  uploaded:      { label: 'Na fila',          bg: 'bg-gray-100',   text: 'text-gray-600',  dot: 'bg-gray-400' },
  ocr_processing:{ label: 'Processando',       bg: 'bg-yellow-50',  text: 'text-yellow-700',dot: 'bg-yellow-500' },
  extracting:    { label: 'Extraindo',         bg: 'bg-blue-50',    text: 'text-blue-700',  dot: 'bg-blue-500' },
  review_pending:{ label: 'Revisão pendente',  bg: 'bg-amber-50',   text: 'text-amber-700', dot: 'bg-amber-500' },
  ready:         { label: 'Pronto',            bg: 'bg-green-50',   text: 'text-green-700', dot: 'bg-green-500' },
  error:         { label: 'Erro',              bg: 'bg-red-50',     text: 'text-red-700',   dot: 'bg-red-500' },
}

const MODALIDADE_LABELS: Record<string, string> = {
  pregao_eletronico: 'Pregão Eletrônico',
  pregao_presencial: 'Pregão Presencial',
  concorrencia:      'Concorrência',
  tomada_de_precos:  'Tomada de Preços',
  convite:           'Convite',
  leilao:            'Leilão',
  concurso:          'Concurso',
  rdc:               'RDC',
  credenciamento:    'Credenciamento',
  outro:             'Outro',
}

const ALERTA_CONFIG: Record<string, { icon: string; text: string; bg: string; border: string }> = {
  critico:    { icon: '🚨', text: 'text-red-700',   bg: 'bg-red-50',   border: 'border-red-200' },
  atencao:    { icon: '⚠️', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  informacao: { icon: 'ℹ️', text: 'text-blue-700',  bg: 'bg-blue-50',  border: 'border-blue-200' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(val: string | null) {
  if (!val) return null
  return parseFloat(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(val: string | null) {
  if (!val) return null
  return new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Small components ─────────────────────────────────────────────────────────

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function Pill({ children, color = 'gray' }: { children: React.ReactNode; color?: 'gray' | 'blue' | 'green' | 'red' | 'purple' | 'amber' }) {
  const c = { gray: 'bg-gray-100 text-gray-600', blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', amber: 'bg-amber-100 text-amber-700' }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${c[color]}`}>{children}</span>
}

function Field({ label, value, className }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value ?? <span className="text-gray-300">—</span>}</dd>
    </div>
  )
}

// ─── Tab content components ───────────────────────────────────────────────────

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <svg className="h-10 w-10 text-gray-200" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  )
}

function DataTable({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {head.map((h) => (
              <th key={h} className="pb-3 pr-6 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 first:pl-0">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">{children}</tbody>
      </table>
    </div>
  )
}

function Tr({ children }: { children: React.ReactNode }) {
  return <tr className="group hover:bg-gray-50 transition-colors">{children}</tr>
}

function Td({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return <td className={`py-3 pr-6 first:pl-0 ${bold ? 'font-medium text-gray-800' : 'text-gray-600'}`}>{children ?? <span className="text-gray-300">—</span>}</td>
}

// ─── Tab: Habilitação Jurídica + Regularidade Fiscal ─────────────────────────

function TabJuridica({ hab }: { hab: Habilitacao }) {
  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Habilitação Jurídica</h3>
        {hab.habilitacaoJuridica.length === 0
          ? <EmptyTab message="Nenhum documento de habilitação jurídica extraído." />
          : (
            <DataTable head={['Documento', 'Aplica a', 'Observação']}>
              {hab.habilitacaoJuridica.map((item) => (
                <Tr key={item.id}>
                  <Td bold>{item.documento}</Td>
                  <Td>{item.aplicaA}</Td>
                  <Td>{item.observacao}</Td>
                </Tr>
              ))}
            </DataTable>
          )}
      </section>

      <div className="border-t border-gray-100 pt-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Regularidade Fiscal, Social e Trabalhista</h3>
        {hab.regularidadeFiscal.length === 0
          ? <EmptyTab message="Nenhum documento de regularidade fiscal extraído." />
          : (
            <DataTable head={['Documento', 'Sigla', 'Validade', 'Observação']}>
              {hab.regularidadeFiscal.map((item) => (
                <Tr key={item.id}>
                  <Td bold>{item.documento}</Td>
                  <Td>{item.sigla ? <Pill color="blue">{item.sigla}</Pill> : null}</Td>
                  <Td>{item.validadeDias ? `${item.validadeDias} dias` : item.observacao}</Td>
                  <Td>{item.observacao && item.validadeDias ? item.observacao : null}</Td>
                </Tr>
              ))}
            </DataTable>
          )}
      </div>
    </div>
  )
}

// ─── Tab: Qualificação Técnica ────────────────────────────────────────────────

function TabTecnica({ hab }: { hab: Habilitacao }) {
  return (
    <div className="space-y-8">

      {/* Parcelas de Relevância */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700">Parcelas de Maior Relevância</h3>
          <Pill color="blue">{hab.parcelasRelevancia.length}</Pill>
          <Pill color="purple">base para cruzamento</Pill>
        </div>
        {hab.parcelasRelevancia.length === 0
          ? <EmptyTab message="Nenhuma parcela de relevância extraída." />
          : (
            <DataTable head={['Serviço / Obra', 'Quantidade mínima', 'Unidade', 'Observação']}>
              {hab.parcelasRelevancia.map((item) => {
                const qty = item.quantidadeMinima ? parseFloat(item.quantidadeMinima) : null
                const qtyFmt = qty !== null
                  ? qty.toLocaleString('pt-BR', { maximumFractionDigits: qty >= 100 ? 0 : 3 })
                  : null
                return (
                  <Tr key={item.id}>
                    <Td bold>{item.servico}</Td>
                    <Td>{qtyFmt ? <span className="font-semibold tabular-nums text-brand-700">{qtyFmt}</span> : null}</Td>
                    <Td>{item.unidade}</Td>
                    <Td>{item.observacao}</Td>
                  </Tr>
                )
              })}
            </DataTable>
          )}
      </section>

      {/* Dados gerais de qualificação */}
      {hab.qualificacaoTecnica && (
        <div className="border-t border-gray-100 pt-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Dados Gerais</h3>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
            <Field label="Registro Conselho" value={hab.qualificacaoTecnica.registroConselho} />
            <Field
              label="Visita Técnica"
              value={hab.qualificacaoTecnica.exigeVisitaTecnica
                ? (hab.qualificacaoTecnica.visitaTipo === 'obrigatoria' ? 'Obrigatória' : 'Facultativa')
                : 'Não exigida'}
            />
            <Field
              label="Escritório Local"
              value={hab.qualificacaoTecnica.exigeEscritorioLocal
                ? (hab.qualificacaoTecnica.escritorioDescricao ?? 'Exigido')
                : 'Não exigido'}
            />
          </dl>
        </div>
      )}

      {/* Profissionais */}
      {hab.profissionais.length > 0 && (
        <div className="border-t border-gray-100 pt-6">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700">Profissionais Exigidos</h3>
            <Pill color="gray">{hab.profissionais.length}</Pill>
          </div>
          <DataTable head={['Cargo / Função', 'Conselho', 'Qtd', 'CBO', 'Observação']}>
            {hab.profissionais.map((item) => (
              <Tr key={item.id}>
                <Td bold>{item.cargo}</Td>
                <Td>{item.conselho ? <Pill color="blue">{item.conselho}</Pill> : null}</Td>
                <Td>{item.quantidade != null ? <span className="font-semibold">{item.quantidade}</span> : null}</Td>
                <Td>{item.cbo}</Td>
                <Td>{item.observacao}</Td>
              </Tr>
            ))}
          </DataTable>
        </div>
      )}

      {/* Atestados */}
      {hab.atestadosProfissionais.length > 0 && (
        <div className="border-t border-gray-100 pt-6">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700">Atestados de Profissionais</h3>
            <Pill color="gray">{hab.atestadosProfissionais.length}</Pill>
          </div>
          <DataTable head={['Profissional', 'Características Exigidas', 'CAT', 'Observação']}>
            {hab.atestadosProfissionais.map((item) => (
              <Tr key={item.id}>
                <Td bold>{item.profissional}</Td>
                <Td>{item.caracteristicasExigidas}</Td>
                <Td><Pill color={item.exigeCat ? 'purple' : 'gray'}>{item.exigeCat ? 'Exige CAT' : 'Não exige'}</Pill></Td>
                <Td>{item.observacao}</Td>
              </Tr>
            ))}
          </DataTable>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Qualificação Financeira ─────────────────────────────────────────────

function TabFinanceira({ hab }: { hab: Habilitacao }) {
  const qf = hab.qualificacaoFinanceira
  if (!qf) return <EmptyTab message="Nenhum requisito de qualificação financeira extraído." />
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
        <Field
          label="Balanço Patrimonial"
          value={qf.exigeBalanco ? `Sim — ${qf.balancoExercicios ?? '?'} exercício(s)` : 'Não exigido'}
        />
        <Field label="Patrimônio Líquido Mín." value={fmtBRL(qf.patrimonioLiquidoMinimo)} />
        <Field label="LC Mínimo" value={qf.lcMinimo} />
        <Field label="LG Mínimo" value={qf.lgMinimo} />
        <Field label="SG Mínimo" value={qf.sgMinimo} />
        <Field
          label="Certidão de Falência"
          value={qf.exigeCertidaoFalencia
            ? `Sim${qf.certidaoFalenciaPrazoDias ? ` — ${qf.certidaoFalenciaPrazoDias} dias` : ''}`
            : 'Não exigida'}
        />
        <Field
          label="Capital Social Mín."
          value={qf.capitalSocialMinimo ? fmtBRL(qf.capitalSocialMinimo) : null}
        />
        <Field
          label="Garantia de Proposta"
          value={qf.exigeGarantiaProposta ? `${qf.garantiaPropostaPercentual ?? '?'}%` : 'Não exigida'}
        />
      </dl>
      {qf.observacao && (
        <p className="border-t border-gray-100 pt-4 text-sm italic text-gray-400">{qf.observacao}</p>
      )}
    </div>
  )
}

// ─── Tab: Declarações & Anexos ────────────────────────────────────────────────

function TabDeclaracoes({ hab }: { hab: Habilitacao }) {
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700">Declarações</h3>
          <Pill color="gray">{hab.declaracoes.length}</Pill>
        </div>
        {hab.declaracoes.length === 0
          ? <EmptyTab message="Nenhuma declaração extraída." />
          : (
            <ul className="space-y-2">
              {hab.declaracoes.map((item) => (
                <li key={item.id} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm text-gray-800">{item.descricao}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {item.baseLegal && <Pill color="gray">{item.baseLegal}</Pill>}
                      {item.leiEstadual && <Pill color="purple">Lei Estadual</Pill>}
                      {item.penalidadeOmissao && <span className="text-xs text-red-500">Penalidade: {item.penalidadeOmissao}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </section>

      {hab.declaracoesEspeciais.length > 0 && (
        <div className="border-t border-gray-100 pt-6">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700">Declarações por Lei Estadual</h3>
            <Pill color="purple">{hab.declaracoesEspeciais.length}</Pill>
          </div>
          <ul className="space-y-2">
            {hab.declaracoesEspeciais.map((item) => (
              <li key={item.id} className="flex items-start gap-3 rounded-lg border border-purple-100 bg-purple-50 px-4 py-3">
                <Pill color="purple">{item.uf ?? '?'}</Pill>
                <div>
                  <p className="text-sm text-gray-800">{item.descricao}</p>
                  {item.lei && <p className="mt-0.5 text-xs text-gray-400">{item.lei}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hab.anexosReferenciados.length > 0 && (
        <div className="border-t border-gray-100 pt-6">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700">Anexos Referenciados</h3>
            <Pill color="gray">{hab.anexosReferenciados.length}</Pill>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {hab.anexosReferenciados.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                <svg className="h-4 w-4 shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
                <div>
                  <span className="text-xs font-semibold text-gray-700">{item.identificacao}</span>
                  {item.descricao && <p className="text-xs text-gray-400">{item.descricao}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'juridica',   label: 'Habilitação Jurídica & Fiscal' },
  { key: 'tecnica',    label: 'Qualificação Técnica' },
  { key: 'financeira', label: 'Qualificação Financeira' },
  { key: 'declaracoes',label: 'Declarações & Anexos' },
] as const

type TabKey = typeof TABS[number]['key']

export default function EditalDetailPage() {
  const { getToken, isLoaded } = useAuth()
  const params = useParams()
  const router = useRouter()
  const editalId = params.id as string

  const [edital, setEdital] = useState<Edital | null>(null)
  const [habilitacao, setHabilitacao] = useState<Habilitacao | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('tecnica')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // action states
  const [approving, setApproving]           = useState(false)
  const [triggeringCrossing, setTriggeringCrossing] = useState(false)
  const [reprocessing, setReprocessing]     = useState(false)
  const [deleting, setDeleting]             = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const token = await getToken()
      const h = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      const res = await fetch(`${API_URL}/api/editais/${editalId}`, { headers: h })
      if (!res.ok) return
      const e = await res.json() as Edital
      setEdital(e)
      if (e.status === 'review_pending' || e.status === 'ready') {
        const hr = await fetch(`${API_URL}/api/editais/${editalId}/habilitacao`, { headers: h })
        if (hr.ok) setHabilitacao(await hr.json() as Habilitacao)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [getToken, editalId])

  useEffect(() => {
    if (!isLoaded) return
    fetchData()
    const iv = setInterval(() => {
      if (!edital || ['uploaded', 'extracting'].includes(edital.status)) fetchData()
    }, 5000)
    return () => clearInterval(iv)
  }, [fetchData, isLoaded, edital?.status])

  async function approve() {
    setApproving(true)
    try {
      const token = await getToken()
      const r = await fetch(`${API_URL}/api/editais/${editalId}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (r.ok) setEdital((p) => p ? { ...p, status: 'ready' } : p)
    } catch { /* ignore */ } finally { setApproving(false) }
  }

  async function startCrossing() {
    setTriggeringCrossing(true)
    try {
      const token = await getToken()
      const r = await fetch(`${API_URL}/api/crossings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ editalId }),
      })
      if (r.ok) {
        const d = await r.json() as { crossingId: string }
        router.push(`/cruzamentos/${d.crossingId}`)
      }
    } catch { /* ignore */ } finally { setTriggeringCrossing(false) }
  }

  async function reprocess() {
    setReprocessing(true)
    try {
      const token = await getToken()
      const r = await fetch(`${API_URL}/api/editais/${editalId}/reprocess`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (r.ok) setEdital((p) => p ? { ...p, status: 'extracting' } : p)
    } catch { /* ignore */ } finally { setReprocessing(false) }
  }

  async function doDelete() {
    setDeleting(true)
    try {
      const token = await getToken()
      const r = await fetch(`${API_URL}/api/editais/${editalId}`, {
        method: 'DELETE', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (r.ok) router.push('/editais')
    } catch { /* ignore */ } finally { setDeleting(false); setConfirmDelete(false) }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex flex-col items-center justify-center gap-3 py-32">
      <Spinner className="h-8 w-8 text-brand-600" />
      <p className="text-sm text-gray-400">Carregando edital…</p>
    </div>
  )

  if (!edital) return (
    <div className="flex flex-col items-center justify-center gap-3 py-32">
      <p className="font-medium text-gray-600">Edital não encontrado.</p>
      <Link href="/editais" className="text-sm text-brand-600 hover:underline">← Voltar para editais</Link>
    </div>
  )

  const status = STATUS_CONFIG[edital.status] ?? STATUS_CONFIG['uploaded']!
  const isProcessing = ['uploaded', 'extracting', 'ocr_processing'].includes(edital.status)

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-12">

      {/* ── Breadcrumb ── */}
      <Link href="/editais" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Editais
      </Link>

      {/* ══════════════════════════════════════════
          SUMMARY CARD
      ══════════════════════════════════════════ */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">

        {/* Header row */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">
                {edital.numeroEdital ?? edital.fileName}
              </h1>
              {/* Status badge */}
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.bg} ${status.text}`}>
                <span className="relative flex h-1.5 w-1.5">
                  {isProcessing && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${status.dot}`} />}
                  <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${status.dot}`} />
                </span>
                {status.label}
              </span>
            </div>
            {edital.orgaoLicitante && (
              <p className="mt-1 text-sm text-gray-500">
                {edital.orgaoLicitante}
                {edital.uasg && <span className="ml-2 font-mono text-xs text-gray-400">UASG {edital.uasg}</span>}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex shrink-0 items-center gap-2">
            {confirmDelete ? (
              <>
                <span className="text-sm text-gray-500">Confirmar?</span>
                <button onClick={doDelete} disabled={deleting}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                  {deleting ? 'Excluindo…' : 'Excluir'}
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                  Cancelar
                </button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)}
                className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:border-red-200 hover:text-red-500 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            )}
            {edital.status === 'error' && (
              <button onClick={reprocess} disabled={reprocessing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50">
                {reprocessing ? <Spinner /> : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>}
                {reprocessing ? 'Reprocessando…' : 'Reprocessar'}
              </button>
            )}
            {edital.status === 'review_pending' && (
              <button onClick={approve} disabled={approving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50">
                {approving ? <Spinner /> : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                {approving ? 'Aprovando…' : 'Aprovar extração'}
              </button>
            )}
            {edital.status === 'ready' && (
              <button onClick={startCrossing} disabled={triggeringCrossing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 shadow-sm">
                {triggeringCrossing ? <Spinner /> : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                {triggeringCrossing ? 'Iniciando…' : 'Iniciar cruzamento'}
              </button>
            )}
          </div>
        </div>

        {/* Key fields grid */}
        <div className="border-t border-gray-100 px-6 py-4">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
            <Field label="Modalidade"     value={edital.modalidade ? (MODALIDADE_LABELS[edital.modalidade] ?? edital.modalidade) : null} />
            <Field label="Valor Estimado" value={fmtBRL(edital.valorEstimado)} />
            <Field label="Data de Abertura" value={fmtDate(edital.dataAbertura)} />
            <Field label="Prazo de Execução" value={edital.prazoExecucaoMeses ? `${edital.prazoExecucaoMeses} meses` : null} />
            <Field label="Lei Regente"    value={edital.leiRegente} />
            <Field label="Regime"         value={edital.regimeExecucao} />
            <Field label="Admite Consórcio" value={edital.admiteConsorcio == null ? null : edital.admiteConsorcio ? 'Sim' : 'Não'} />
            <Field label="Arquivo"        value={edital.fileName} />
          </dl>
        </div>

        {/* Objeto */}
        {edital.objeto && (
          <div className="border-t border-gray-100 px-6 py-4">
            <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">Objeto</dt>
            <dd className="text-sm leading-relaxed text-gray-800">{edital.objeto}</dd>
          </div>
        )}

        {/* Processing banner */}
        {isProcessing && (
          <div className="border-t border-blue-100 bg-blue-50 px-6 py-3">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Spinner className="h-4 w-4 shrink-0 text-blue-600" />
              {edital.status === 'uploaded'
                ? 'Na fila de processamento. Esta página atualiza automaticamente.'
                : 'Extraindo dados de habilitação com IA. Esta página atualiza automaticamente…'}
            </div>
          </div>
        )}

        {/* Error banner */}
        {edital.status === 'error' && (
          <div className="border-t border-red-100 bg-red-50 px-6 py-3">
            <p className="text-sm text-red-700">Ocorreu um erro durante a extração. Use o botão Reprocessar para tentar novamente.</p>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          ALERTAS (fora do summary, antes das abas)
      ══════════════════════════════════════════ */}
      {habilitacao && habilitacao.alertas.length > 0 && (
        <div className="space-y-2">
          {habilitacao.alertas.map((alerta) => {
            const cfg = ALERTA_CONFIG[alerta.nivel] ?? ALERTA_CONFIG['informacao']!
            return (
              <div key={alerta.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${cfg.bg} ${cfg.border}`}>
                <span className="text-base leading-none">{cfg.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase tracking-wide ${cfg.text}`}>
                      {alerta.nivel === 'critico' ? 'Crítico' : alerta.nivel === 'atencao' ? 'Atenção' : 'Informação'}
                    </span>
                    {alerta.categoria && <span className="text-xs text-gray-400">{alerta.categoria}</span>}
                  </div>
                  <p className={`mt-0.5 text-sm ${cfg.text}`}>{alerta.descricao}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════
          TABS
      ══════════════════════════════════════════ */}
      {habilitacao && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">

          {/* Tab bar */}
          <div className="border-b border-gray-100 px-6">
            <nav className="-mb-px flex gap-0 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`whitespace-nowrap border-b-2 px-4 py-4 text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'border-brand-600 text-brand-700'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab content */}
          <div className="px-6 py-6">
            {activeTab === 'juridica'    && <TabJuridica hab={habilitacao} />}
            {activeTab === 'tecnica'     && <TabTecnica  hab={habilitacao} />}
            {activeTab === 'financeira'  && <TabFinanceira hab={habilitacao} />}
            {activeTab === 'declaracoes' && <TabDeclaracoes hab={habilitacao} />}
          </div>
        </div>
      )}

      {/* Cost footnote */}
      {edital.aiExtractionCostUsd && (
        <p className="text-center text-xs text-gray-300">
          Custo de extração: ${edital.aiExtractionCostUsd} USD
        </p>
      )}
    </div>
  )
}
