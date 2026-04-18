'use client'

import type { CrossingItem, ActiveTab } from '../_lib/types'
import { ItemsTable } from './items-table'

interface Props {
  items: CrossingItem[]
  filteredItems: CrossingItem[]
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
  submitting: string | null
  onOverride: (itemId: string, action: 'aprovar' | 'rejeitar', label: string) => void
  onExceptionalOverride: (itemId: string, resultado: string) => void
  crossingStatus: string
}

const TABS: { key: ActiveTab; label: string; icon: string }[] = [
  { key: 'todos', label: 'Todos', icon: 'list' },
  { key: 'pendentes', label: 'Pendentes', icon: 'pending_actions' },
  { key: 'atendidos', label: 'Atendidos', icon: 'check_circle' },
  { key: 'gaps', label: 'Gaps', icon: 'error' },
]

export function ItemsSection({
  items,
  filteredItems,
  activeTab,
  onTabChange,
  submitting,
  onOverride,
  onExceptionalOverride,
  crossingStatus,
}: Props) {
  if (items.length === 0 && crossingStatus !== 'processing') return null

  const countMap: Record<ActiveTab, number> = {
    todos: items.length,
    pendentes: items.filter(i => i.resultado === 'atendido_parcialmente' && !i.humanOverride).length,
    atendidos: items.filter(i => i.resultado === 'atendido').length,
    gaps: items.filter(i => i.resultado === 'gap').length,
  }

  return (
    <div data-print-hide>
      {/* Tab Bar */}
      <div
        className="mb-5 flex items-center gap-1 overflow-x-auto"
        style={{ borderBottom: '1px solid var(--border-soft)' }}
      >
        {TABS.map(({ key, label, icon }) => {
          const isActive = activeTab === key
          const count = countMap[key]
          const badgeClass =
            key === 'pendentes' && count > 0 ? 'bg-amber-100 text-amber-700' :
            key === 'atendidos' ? 'bg-emerald-50 text-emerald-700' :
            key === 'gaps' && count > 0 ? 'bg-red-50 text-red-600' :
            isActive ? 'bg-[#e6f6ff] text-[#003746]' : 'bg-slate-100 text-slate-400'

          return (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className={`relative flex items-center gap-1.5 whitespace-nowrap px-4 pb-3 pt-1 text-sm font-semibold transition-colors ${
                isActive ? 'text-[#003746]' : 'text-slate-400 hover:text-slate-600'
              }`}
              style={isActive ? { boxShadow: 'inset 0 -2px 0 #003746' } : undefined}
            >
              <span className="material-symbols-outlined text-[18px]">{icon}</span>
              {label}
              {count > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold leading-none ${badgeClass}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Items */}
      <ItemsTable
        items={filteredItems}
        activeTab={activeTab}
        submitting={submitting}
        onOverride={onOverride}
        onExceptionalOverride={onExceptionalOverride}
      />
    </div>
  )
}
