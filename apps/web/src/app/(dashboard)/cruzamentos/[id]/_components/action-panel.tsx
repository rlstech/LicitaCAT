'use client'

import type { Crossing, Counts, ActiveTab } from '../_lib/types'

interface Props {
  crossing: Crossing
  counts: Counts
  activeTab: ActiveTab
  onSetActiveTab: (tab: ActiveTab) => void
}

const WORKFLOW_STEPS = [
  { key: 'verdict', label: 'Veredito IA', icon: 'smart_toy' },
  { key: 'pendentes', label: 'Revisar Pendentes', icon: 'fact_check' },
  { key: 'gaps', label: 'Analisar Gaps', icon: 'warning' },
  { key: 'export', label: 'Exportar', icon: 'download' },
] as const

export function ActionPanel({ crossing, counts, activeTab, onSetActiveTab }: Props) {
  const verdictDone = crossing.status === 'completed'
  const pendentesDone = counts.pendentes === 0
  const gapsDone = counts.gaps === 0

  const stepStatus = [
    verdictDone,
    pendentesDone,
    gapsDone,
    false, // export is always manual
  ]

  const currentStep = !verdictDone ? 0 : !pendentesDone ? 1 : !gapsDone ? 2 : 3

  return (
    <div className="col-span-12 flex flex-col gap-4 lg:col-span-4">
      {/* Workflow Stepper */}
      <div className="rounded-2xl bg-[#003746] p-5 shadow-sm">
        <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-[#94cfe7]">
          Workflow de Análise
        </p>
        <div className="space-y-1">
          {WORKFLOW_STEPS.map((step, idx) => {
            const done = stepStatus[idx]
            const isCurrent = idx === currentStep
            return (
              <div
                key={step.key}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  isCurrent ? 'bg-white/10' : ''
                }`}
              >
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                  done
                    ? 'bg-emerald-400 text-white'
                    : isCurrent
                    ? 'bg-white text-[#003746]'
                    : 'bg-white/20 text-white/50'
                }`}>
                  {done ? (
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                  ) : (
                    idx + 1
                  )}
                </div>
                <span className={`text-xs font-medium ${
                  done ? 'text-emerald-300' : isCurrent ? 'text-white' : 'text-white/40'
                }`}>
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Review Progress */}
        {counts.totalParciais > 0 && (
          <div className="mt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
            <div className="mb-2 flex justify-between text-[10px] font-semibold text-white/60">
              <span>Progresso de revisão</span>
              <span className="text-white">{counts.revisados}/{counts.totalParciais}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all"
                style={{ width: `${counts.totalParciais > 0 ? (counts.revisados / counts.totalParciais) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* CTA */}
        {counts.pendentes > 0 && (
          <button
            onClick={() => onSetActiveTab('pendentes')}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-bold text-[#003746] shadow-sm transition-opacity hover:opacity-90"
          >
            Revisar Pendentes
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        )}
        {counts.pendentes === 0 && counts.gaps > 0 && (
          <button
            onClick={() => onSetActiveTab('gaps')}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Analisar Gaps
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        )}
      </div>

      {/* Meta Card */}
      {crossing.status === 'completed' && (crossing.processingTimeSeconds ?? crossing.aiCostUsd) && (
        <div className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: '1px solid var(--border-soft)' }}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Dados do Processamento
          </p>
          <div className="flex items-center gap-4">
            {crossing.processingTimeSeconds != null && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="material-symbols-outlined text-[16px]">timer</span>
                <span className="font-semibold text-slate-700">{crossing.processingTimeSeconds}s</span>
              </div>
            )}
            {crossing.aiCostUsd && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="material-symbols-outlined text-[16px]">token</span>
                <span className="font-mono font-semibold text-slate-700">${crossing.aiCostUsd}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
