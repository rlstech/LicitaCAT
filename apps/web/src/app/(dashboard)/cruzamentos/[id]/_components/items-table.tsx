'use client'

import type { CrossingItem, ActiveTab } from '../_lib/types'
import { ItemsTableRow } from './items-table-row'

interface Props {
  items: CrossingItem[]
  activeTab: ActiveTab
  submitting: string | null
  onOverride: (itemId: string, action: 'aprovar' | 'rejeitar', label: string) => void
  onExceptionalOverride: (itemId: string, resultado: string) => void
}

export function ItemsTable({ items, activeTab, submitting, onOverride, onExceptionalOverride }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-white p-10 text-center" style={{ border: '1px solid var(--border)' }}>
        {activeTab === 'pendentes' ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
              <span className="material-symbols-outlined text-[22px] text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-700">Todos os itens foram revisados</p>
            <p className="text-xs text-slate-400">Nenhum requisito aguarda aprovação.</p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Nenhum item nesta categoria.</p>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Gaps critical analysis divider */}
      {activeTab === 'gaps' && (
        <div className="my-2 flex items-center gap-4">
          <hr className="flex-1 border-red-100" />
          <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-red-500">
            <span className="material-symbols-outlined text-[16px]">warning</span>
            Análise Crítica de GAPs
          </span>
          <hr className="flex-1 border-red-100" />
        </div>
      )}

      {/* Desktop: Table */}
      <div className="hidden overflow-hidden rounded-xl bg-white shadow-sm md:block" style={{ border: '1px solid var(--border-soft)' }}>
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-10" />
            <col className="w-[160px]" />
            <col />
            <col className="w-[150px]" />
            <col className="w-[80px]" />
            <col className="w-[60px]" />
            <col className="w-[80px]" />
          </colgroup>
          <thead>
            <tr className="text-left" style={{ borderBottom: '1px solid var(--border-soft)' }}>
              <th className="pl-3 pr-1 py-3" />
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Serviço</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Qtd Mínima</th>
              <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Aderência</th>
              <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">CATs</th>
              <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {items.map(item => (
              <ItemsTableRow
                key={item.id}
                item={item}
                submitting={submitting}
                onOverride={onOverride}
                onExceptionalOverride={onExceptionalOverride}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Cards */}
      <div className="space-y-3 md:hidden">
        {items.map(item => (
          <MobileItemCard
            key={item.id}
            item={item}
            submitting={submitting}
            onOverride={onOverride}
            onExceptionalOverride={onExceptionalOverride}
          />
        ))}
      </div>
    </>
  )
}

function MobileItemCard({
  item,
  submitting,
  onOverride,
  onExceptionalOverride,
}: {
  item: CrossingItem
  submitting: string | null
  onOverride: (itemId: string, action: 'aprovar' | 'rejeitar', label: string) => void
  onExceptionalOverride: (itemId: string, resultado: string) => void
}) {
  const isPendente = item.resultado === 'atendido_parcialmente' && !item.humanOverride
  const isAtendido = item.resultado === 'atendido'
  const accentColor = isPendente ? '#f59e0b' : isAtendido ? '#10b981' : '#dc2626'

  const matchingCats = item.catMatches.filter(m => m.avaliacaoLlm !== 'nao_atende').length
  const aderenciaPercent = item.resultado === 'atendido' ? '100%'
    : item.resultado === 'atendido_parcialmente' ? '50%'
    : matchingCats === 0 ? '0%'
    : item.scoreSimilaridadeMax
      ? `${(parseFloat(item.scoreSimilaridadeMax) * 100).toFixed(0)}%`
      : '0%'

  return (
    <div
      className="overflow-hidden rounded-xl bg-white shadow-sm"
      style={{ border: `1px solid ${accentColor}30`, borderTop: `3px solid ${accentColor}` }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800">{item.parcelaServico}</p>
            {item.parcelaQuantidadeMinima && (
              <p className="mt-0.5 text-xs text-slate-500">
                {item.parcelaQuantidadeMinima} {item.parcelaUnidade ?? ''}
              </p>
            )}
          </div>
          <span className={`text-lg font-bold ${
            isPendente ? 'text-amber-500' : isAtendido ? 'text-emerald-600' : 'text-red-500'
          }`}>
            {aderenciaPercent}
          </span>
        </div>

        {isPendente && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onOverride(item.id, 'aprovar', item.parcelaServico)}
              disabled={submitting === item.id}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[14px]">check</span>
              Aprovar
            </button>
            <button
              onClick={() => onOverride(item.id, 'rejeitar', item.parcelaServico)}
              disabled={submitting === item.id}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 py-2 text-xs font-bold text-red-600 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
              Rejeitar
            </button>
          </div>
        )}
        {!isPendente && (
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => onExceptionalOverride(item.id, isAtendido ? 'gap' : 'atendido')}
              disabled={submitting === item.id}
              className="rounded p-1 text-slate-300 hover:text-slate-500 disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-[14px]">edit</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
