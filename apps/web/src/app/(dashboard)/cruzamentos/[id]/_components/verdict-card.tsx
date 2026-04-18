'use client'

import type { Crossing, RecConfig, Counts } from '../_lib/types'

interface Props {
  crossing: Crossing
  recInfo: RecConfig
  counts: Counts
}

const SCORE_COLOR = (score: number) =>
  score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-500' : 'text-rose-600'

const BAR_GRADIENT = (score: number) =>
  score >= 70
    ? 'from-emerald-400 to-emerald-600'
    : score >= 40
      ? 'from-amber-400 to-amber-500'
      : 'from-rose-400 to-rose-600'

export function VerdictCard({ crossing, recInfo, counts }: Props) {
  const score = crossing.scoreAderencia ?? 0
  const barTotal = counts.atendidos + counts.parciais + counts.gaps
  const pAtend = barTotal > 0 ? (counts.atendidos / barTotal) * 100 : 0
  const pParc = barTotal > 0 ? (counts.parciais / barTotal) * 100 : 0
  const pGap = barTotal > 0 ? (counts.gaps / barTotal) * 100 : 0

  return (
    <div
      className="col-span-12 overflow-hidden rounded-2xl bg-white shadow-sm lg:col-span-8"
      style={{ borderTop: `4px solid ${recInfo.accentColor}` }}
    >
      <div className="p-6">
        {/* Health Score + Recomendação */}
        <div className="space-y-4">
          {/* Score header row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-baseline gap-2">
              <span className={`text-5xl font-extrabold tabular-nums leading-none ${SCORE_COLOR(score)}`}>
                {score}
              </span>
              <span className="text-sm font-medium text-slate-400">/100</span>
              <span className="ml-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Score de Saúde
              </span>
            </div>
            {/* Badge de recomendação */}
            <div className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider ${recInfo.badgeBg} ${recInfo.badgeText}`}>
              <span
                className="material-symbols-outlined text-[16px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {recInfo.icon}
              </span>
              Recomendação: {recInfo.label}
            </div>
          </div>

          {/* Health Bar */}
          <div className="space-y-1">
            <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out ${BAR_GRADIENT(score)}`}
                style={{ width: `${score}%` }}
              />
            </div>
            {/* Threshold markers */}
            <div className="relative h-4">
              <div className="absolute left-0 text-[10px] text-slate-400">Crítico</div>
              <div
                className="absolute -translate-x-1/2 text-[10px] text-slate-400"
                style={{ left: '40%' }}
              >
                Ressalvas
              </div>
              <div
                className="absolute -translate-x-1/2 text-[10px] text-slate-400"
                style={{ left: '70%' }}
              >
                Seguro
              </div>
              {/* Tick lines at thresholds */}
              <div className="absolute h-full" style={{ left: '40%' }}>
                <div className="h-2 w-px bg-slate-300" />
              </div>
              <div className="absolute h-full" style={{ left: '70%' }}>
                <div className="h-2 w-px bg-slate-300" />
              </div>
            </div>
          </div>

          {/* Justificativa */}
          {crossing.recomendacaoJustificativa && (
            <p className="text-sm leading-relaxed text-slate-600">
              {crossing.recomendacaoJustificativa}
            </p>
          )}

          {/* Stacked bar de coerência */}
          {barTotal > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Coerência de Requisitos</span>
                <span>{counts.total} requisitos</span>
              </div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
                {pAtend > 0 && <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pAtend}%` }} />}
                {pParc > 0 && <div className="h-full bg-amber-400 transition-all" style={{ width: `${pParc}%` }} />}
                {pGap > 0 && <div className="h-full bg-red-500 transition-all" style={{ width: `${pGap}%` }} />}
              </div>
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="mt-5 grid grid-cols-3 gap-3" style={{ borderTop: '1px solid var(--border-soft)', paddingTop: '20px' }}>
          <KpiCard
            icon="check_circle"
            iconColor="text-emerald-500"
            label="Atendidos"
            value={counts.atendidos}
            bg="bg-emerald-50/60"
          />
          <KpiCard
            icon="pending"
            iconColor="text-amber-500"
            label="Parciais"
            value={counts.parciais}
            bg="bg-amber-50/60"
          />
          <KpiCard
            icon="cancel"
            iconColor="text-red-500"
            label="Gaps"
            value={counts.gaps}
            bg="bg-red-50/60"
          />
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  icon,
  iconColor,
  label,
  value,
  bg,
}: {
  icon: string
  iconColor: string
  label: string
  value: number
  bg: string
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${bg}`}>
      <span
        className={`material-symbols-outlined text-[22px] ${iconColor}`}
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {icon}
      </span>
      <div>
        <p className="text-xl font-extrabold text-slate-800">{value}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      </div>
    </div>
  )
}
