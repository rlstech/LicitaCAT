'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { useToken } from '@/hooks/use-token'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

interface Crossing {
  id: string
  editalId: string
  status: string
  scoreAderencia: number | null
  totalRequisitos: number | null
  requisitosAtendidos: number | null
  requisitosComRessalva: number | null
  requisitosGap: number | null
  recomendacao: string | null
  processingTimeSeconds: number | null
  createdAt: string
  editalNumero: string | null
  editalFileName: string
  editalOrgao: string | null
  totalCrossings: number
  pendingCount: number
}

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  queued:     { label: 'Na fila',     dot: 'bg-slate-400' },
  processing: { label: 'Processando', dot: 'bg-[#003746]' },
  completed:  { label: 'Concluído',   dot: 'bg-emerald-500' },
  error:      { label: 'Erro',        dot: 'bg-red-500' },
}

const REC_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  participar:               { label: 'Participar',      bg: 'bg-emerald-100', text: 'text-emerald-800' },
  participar_com_ressalvas: { label: 'Ressalvas',       bg: 'bg-amber-100',   text: 'text-amber-800' },
  nao_participar:           { label: 'Não Participar',  bg: 'bg-red-100',     text: 'text-red-800' },
}

function ScoreGauge({ score, size = 112 }: { score: number; size?: number }) {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 8
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const startDeg = 135
  const totalDeg = 270
  const sx = cx + r * Math.cos(toRad(startDeg))
  const sy = cy + r * Math.sin(toRad(startDeg))
  const ex = cx + r * Math.cos(toRad(startDeg + totalDeg))
  const ey = cy + r * Math.sin(toRad(startDeg + totalDeg))
  const progressDeg = startDeg + totalDeg * (score / 100)
  const px = cx + r * Math.cos(toRad(progressDeg))
  const py = cy + r * Math.sin(toRad(progressDeg))
  const largeArc = totalDeg * (score / 100) > 180 ? 1 : 0
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ba1a1a'

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path
          d={`M ${sx} ${sy} A ${r} ${r} 0 1 1 ${ex} ${ey}`}
          fill="none" stroke="#e6f6ff" strokeWidth={8} strokeLinecap="round" opacity={0.3}
        />
        {score > 0 && (
          <path
            d={`M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${px} ${py}`}
            fill="none" stroke={color} strokeWidth={8} strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
        <span className="text-2xl font-extrabold" style={{ color: score < 50 ? '#ba1a1a' : '#003746' }}>{score}%</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Score</span>
      </div>
    </div>
  )
}

function RequisitosBar({ atendidos, parciais, gaps, total }: {
  atendidos: number | null; parciais: number | null; gaps: number | null; total: number | null
}) {
  if (!total) return null
  const a = ((atendidos ?? 0) / total) * 100
  const p = ((parciais ?? 0) / total) * 100
  const g = ((gaps ?? 0) / total) * 100

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-slate-500">
        <span>Aderência Técnica</span>
        <span>{(atendidos ?? 0) + (parciais ?? 0)}/{total} Requisitos</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${a}%` }} />
        <div className="h-full bg-amber-400 transition-all" style={{ width: `${p}%` }} />
        <div className="h-full bg-red-500 transition-all" style={{ width: `${g}%` }} />
      </div>
    </div>
  )
}

export default function CruzamentosPage() {
  const getToken = useToken()
  const [crossings, setCrossings] = useState<Crossing[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCrossings = useCallback(async () => {
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/crossings`, {
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (res.ok) setCrossings(await res.json() as Crossing[])
    } catch { /* silent */ } finally { setLoading(false) }
  }, [getToken])

  useEffect(() => {
    fetchCrossings()
    const interval = setInterval(fetchCrossings, 10000)
    return () => clearInterval(interval)
  }, [fetchCrossings])

  return (
    <div className="mx-auto max-w-7xl space-y-10">

      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-widest text-[#003746]/60">Status do Sistema</span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <h1 className="text-2xl font-bold text-[#003746]">Cruzamentos Ativos</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#003746] shadow-sm transition-all hover:bg-[#e6f6ff]">
            <span className="material-symbols-outlined text-lg">filter_list</span>
            Filtros Avançados
          </button>
          <button
            onClick={() => fetchCrossings()}
            className="flex items-center gap-2 rounded-lg bg-[#003746] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-95"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            Atualizar Todos
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="rounded-2xl bg-white px-6 py-16 text-center shadow-sm" style={{ border: '1px solid rgba(207,230,242,0.2)' }}>
          <span className="material-symbols-outlined animate-spin text-[28px] text-[#003746]">sync</span>
          <p className="mt-3 text-sm text-slate-400">Carregando cruzamentos…</p>
        </div>
      ) : crossings.length === 0 ? (
        <div className="rounded-2xl bg-white px-6 py-16 text-center shadow-sm" style={{ border: '1px solid rgba(207,230,242,0.2)' }}>
          <span className="material-symbols-outlined text-[40px] text-slate-300">layers</span>
          <p className="mt-3 text-sm font-semibold text-slate-700">Nenhum cruzamento realizado</p>
          <p className="mt-1 text-xs text-slate-400">
            Acesse um edital com status <span className="font-semibold text-slate-600">Pronto</span> e inicie a análise de aderência.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {crossings.map((c) => {
            const isProcessing = c.status === 'processing' || c.status === 'queued'
            const s = STATUS_CONFIG[c.status] ?? { label: c.status, dot: 'bg-slate-400' }
            const rec = c.recomendacao ? REC_CONFIG[c.recomendacao] : null

            if (isProcessing) {
              return (
                <div
                  key={c.id}
                  className="overflow-hidden rounded-2xl border border-dashed border-[#003746]/20 bg-[#e6f6ff] p-6"
                >
                  <div className="mb-6 flex items-start justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Edital #{c.editalNumero ?? c.editalFileName}
                      </span>
                      <h4 className="text-lg font-bold leading-tight text-[#003746]/60">
                        {c.editalNumero ?? c.editalFileName}
                      </h4>
                      {c.editalOrgao && <p className="text-sm font-medium text-[#4c626a]/60">{c.editalOrgao}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="rounded-full bg-[#cfe6f2] px-3 py-1 text-[10px] font-bold uppercase tracking-tighter text-slate-500">
                        Aguardando
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px] font-medium italic text-[#003746]/60">
                        <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                        Processando...
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center space-y-4 py-8 opacity-50">
                    <div className="relative h-3 w-full max-w-xs overflow-hidden rounded-full bg-white/50">
                      <div className="absolute inset-0 animate-pulse bg-[#003746]/20" />
                    </div>
                    <p className="px-10 text-center text-xs font-medium leading-relaxed text-slate-500">
                      Cruzando requisitos técnicos com as certidões disponíveis no seu acervo...
                    </p>
                  </div>
                  <div className="flex justify-end border-t border-slate-200/50 pt-4">
                    <span className="text-xs font-semibold text-slate-400">Aguarde a conclusão</span>
                  </div>
                </div>
              )
            }

            const riskLevel = (c.scoreAderencia ?? 0) >= 80 ? 'Baixo' : (c.scoreAderencia ?? 0) >= 50 ? 'Médio' : 'Alto'
            const riskColor = riskLevel === 'Baixo' ? 'text-emerald-600' : riskLevel === 'Médio' ? 'text-amber-600' : 'text-red-600'

            return (
              <div
                key={c.id}
                className="group overflow-hidden rounded-2xl bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-xl"
                style={{ border: '1px solid white' }}
              >
                {/* Card header */}
                <div className="mb-6 flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Edital #{c.editalNumero ?? '—'}
                    </span>
                    <h4 className="text-lg font-bold leading-tight text-[#003746]">
                      {c.editalNumero ?? c.editalFileName}
                    </h4>
                    {c.editalOrgao && <p className="text-sm font-medium text-[#4c626a]">{c.editalOrgao}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {rec && (
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-tighter ${rec.bg} ${rec.text}`}>
                        {rec.label}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      {s.label}
                    </div>
                  </div>
                </div>

                {/* Score + adherence */}
                <div className="mb-8 flex items-center gap-10">
                  <ScoreGauge score={c.scoreAderencia ?? 0} />
                  <div className="flex-1 space-y-4">
                    <RequisitosBar
                      atendidos={c.requisitosAtendidos}
                      parciais={c.requisitosComRessalva}
                      gaps={c.requisitosGap}
                      total={c.totalRequisitos}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-[#e6f6ff] p-2 text-center">
                        <p className="text-[9px] font-bold uppercase text-slate-400">CATs</p>
                        <p className="text-sm font-bold text-[#003746]">
                          {String((c.requisitosAtendidos ?? 0) + (c.requisitosComRessalva ?? 0)).padStart(2, '0')}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#e6f6ff] p-2 text-center">
                        <p className="text-[9px] font-bold uppercase text-slate-400">Validade</p>
                        <p className={`text-sm font-bold ${(c.scoreAderencia ?? 0) >= 50 ? 'text-[#003746]' : 'text-red-600'}`}>
                          {(c.scoreAderencia ?? 0) >= 50 ? 'OK' : 'ALERTA'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#e6f6ff] p-2 text-center">
                        <p className="text-[9px] font-bold uppercase text-slate-400">Risco</p>
                        <p className={`text-sm font-bold ${riskColor}`}>{riskLevel}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card footer */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                  <div className="text-[11px] text-slate-400">
                    {new Date(c.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                    })}
                    {c.processingTimeSeconds ? ` · ${c.processingTimeSeconds}s` : ''}
                  </div>
                  <Link
                    href={`/cruzamentos/${c.id}`}
                    className="flex items-center gap-1 text-xs font-semibold text-[#003746] hover:underline"
                  >
                    {(c.scoreAderencia ?? 0) < 50 ? 'Análise de Gaps' : 'Ver Detalhes do Cruzamento'}
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
