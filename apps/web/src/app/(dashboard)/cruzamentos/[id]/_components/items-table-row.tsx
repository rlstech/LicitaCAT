'use client'

import { useState } from 'react'
import type { CrossingItem } from '../_lib/types'
import { RESULTADO_CONFIG } from '../_lib/config'
import { CatMatchesDetail } from './cat-matches-detail'

interface Props {
  item: CrossingItem
  submitting: string | null
  onOverride: (itemId: string, action: 'aprovar' | 'rejeitar', label: string) => void
  onExceptionalOverride: (itemId: string, resultado: string) => void
}

export function ItemsTableRow({ item, submitting, onOverride, onExceptionalOverride }: Props) {
  const [expanded, setExpanded] = useState(false)

  // Animação de "acender" quando item é atualizado via SSE
  const [flash, setFlash] = useState(false)
  if (item.justUpdated && !flash) setFlash(true)

  const isPendente = item.resultado === 'atendido_parcialmente' && !item.humanOverride
  const isAtendido = item.resultado === 'atendido'
  const cfg = (RESULTADO_CONFIG[item.resultado] ?? RESULTADO_CONFIG['gap'])!

  // Aderência baseada no resultado da avaliação IA, não na similaridade do embedding
  const matchingCats = item.catMatches.filter(m => m.avaliacaoLlm !== 'nao_atende').length
  const aderenciaPercent = item.resultado === 'atendido' ? '100%'
    : item.resultado === 'atendido_parcialmente' ? '50%'
    : matchingCats === 0 ? '0%'
    : item.scoreSimilaridadeMax
      ? `${(parseFloat(item.scoreSimilaridadeMax) * 100).toFixed(0)}%`
      : '0%'
  const similaridadeTooltip = item.scoreSimilaridadeMax
    ? `Similaridade semântica: ${(parseFloat(item.scoreSimilaridadeMax) * 100).toFixed(0)}%`
    : ''

  return (
    <>
      {/* Main row */}
      <tr
        className={`group cursor-pointer transition-colors hover:bg-slate-50/80 ${expanded ? 'bg-slate-50/50' : ''} ${flash ? 'animate-pulse bg-emerald-50/50' : ''}`}
        onClick={() => setExpanded(v => !v)}
      >
        {/* Expand toggle */}
        <td className="pl-3 pr-1">
          <span className={`material-symbols-outlined text-[16px] text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}>
            chevron_right
          </span>
        </td>

        {/* Status */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            <span
              className={`material-symbols-outlined text-[18px] shrink-0`}
              style={{ color: cfg.color, fontVariationSettings: isAtendido ? "'FILL' 1" : "'FILL' 0" }}
            >
              {cfg.icon}
            </span>
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${cfg.badgeBg} ${cfg.badgeText}`}>
              {isPendente ? 'Pendente' : cfg.label}
            </span>
            {item.humanOverride && (
              <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-blue-600">
                Revisado
              </span>
            )}
          </div>
        </td>

        {/* Servico */}
        <td className="px-3 py-3">
          <p className="truncate text-sm font-semibold text-slate-800" title={item.parcelaServico}>{item.parcelaServico}</p>
        </td>

        {/* Qtd Min */}
        <td className="px-3 py-3">
          <span className="whitespace-nowrap text-sm tabular-nums text-slate-600">
            {item.parcelaQuantidadeMinima
              ? `${parseFloat(item.parcelaQuantidadeMinima).toLocaleString('pt-BR')} ${item.parcelaUnidade ?? ''}`
              : '—'}
          </span>
          {item.parcelaCoberturaPct !== null && (
            <div
              className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100"
              title={`Acervo: ${item.parcelaQuantidadeAcervo?.toLocaleString('pt-BR') ?? '0'} ${item.parcelaUnidade ?? ''} (${item.parcelaCoberturaPct}% do mínimo)`}
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  item.parcelaCoberturaPct >= 100
                    ? 'bg-emerald-500'
                    : item.parcelaCoberturaPct >= 50
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                }`}
                style={{ width: `${item.parcelaCoberturaPct}%` }}
              />
            </div>
          )}
        </td>

        {/* Aderência % */}
        <td className="px-3 py-3 text-right" title={similaridadeTooltip}>
          <span className={`text-sm font-bold tabular-nums ${
            isPendente ? 'text-amber-500' : isAtendido ? 'text-emerald-600' : 'text-red-500'
          }`}>
            {aderenciaPercent}
          </span>
        </td>

        {/* CATs count */}
        <td className="px-3 py-3 text-center">
          <span className="text-sm font-medium text-slate-500">{matchingCats}</span>
        </td>

        {/* Actions */}
        <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
          {isPendente ? (
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={() => onOverride(item.id, 'aprovar', item.parcelaServico)}
                disabled={submitting === item.id}
                title="Aprovar"
                className="rounded-md bg-emerald-50 p-1.5 text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
              </button>
              <button
                onClick={() => onOverride(item.id, 'rejeitar', item.parcelaServico)}
                disabled={submitting === item.id}
                title="Rejeitar"
                className="rounded-md bg-red-50 p-1.5 text-red-500 transition-colors hover:bg-red-100 disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={() => onExceptionalOverride(item.id, isAtendido ? 'gap' : 'atendido')}
                disabled={submitting === item.id}
                title={isAtendido ? 'Reclassificar como Gap' : 'Reclassificar como Atendido'}
                className="rounded-md p-1.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500 disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-[14px]">edit</span>
              </button>
            </div>
          )}
        </td>
      </tr>

      {/* Expanded detail */}
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-slate-50/30 px-6 pb-5 pt-2" style={{ borderLeft: `3px solid ${cfg.color}` }}>
            <div className="space-y-4">
              {/* AI Justification */}
              {item.aiJustificativa && (
                <div>
                  {isPendente ? (
                    <div className="rounded-lg border border-amber-200/60 bg-amber-50/50 p-3">
                      <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-[18px] text-amber-500">lightbulb</span>
                        <div>
                          <p className="mb-0.5 text-xs font-semibold text-amber-700">Dúvida Técnica da IA</p>
                          <p className="text-xs italic leading-relaxed text-amber-800/80">{item.aiJustificativa}</p>
                        </div>
                      </div>
                    </div>
                  ) : item.resultado === 'gap' ? (
                    <div className="rounded-lg border border-red-100 bg-red-50/40 p-3">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-red-600">Diagnóstico de Ausência</p>
                      <p className="text-xs leading-relaxed text-red-800/70">{item.aiJustificativa}</p>
                    </div>
                  ) : (
                    <p className="text-xs italic leading-relaxed text-slate-500">{item.aiJustificativa}</p>
                  )}
                </div>
              )}

              {/* Gap suggestion */}
              {item.resultado === 'gap' && (
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <span className="material-symbols-outlined text-[18px] text-[#003746]">psychiatry</span>
                  <p className="flex-1 text-xs text-slate-600">
                    <span className="font-semibold text-[#003746]">Sugestão: </span>
                    Considere obter nova CAT via consórcio, ou verifique se há possibilidade de complementação de acervo.
                  </p>
                </div>
              )}

              {/* Override note */}
              {item.humanOverride && item.humanOverrideNote && (
                <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 text-xs text-blue-700">
                  <span className="font-semibold">Nota de revisão: </span>{item.humanOverrideNote}
                </div>
              )}

              {/* CAT Matches */}
              <CatMatchesDetail item={item} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
