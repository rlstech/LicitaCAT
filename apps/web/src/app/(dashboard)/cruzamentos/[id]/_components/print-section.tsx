import type { CrossingItem } from '../_lib/types'

const GROUPS = [
  { key: 'atendido', label: 'Atendidos', color: '#10b981' },
  { key: 'atendido_parcialmente', label: 'Parciais', color: '#f59e0b' },
  { key: 'gap', label: 'Gaps', color: '#dc2626' },
] as const

export function PrintSection({ items }: { items: CrossingItem[] }) {
  return (
    <div className="print-only hidden space-y-3">
      {GROUPS.map(({ key, label, color }) => {
        const groupItems = items.filter(i => i.resultado === key)
        if (groupItems.length === 0) return null
        return (
          <div key={key}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
              {label} ({groupItems.length})
            </p>
            {groupItems.map((item, idx) => (
              <div
                key={item.id}
                className="mb-1.5 rounded-lg p-3 text-xs"
                style={{ border: `1px solid ${color}30`, backgroundColor: `${color}08` }}
              >
                <span className="font-semibold text-slate-900">{idx + 1}. {item.parcelaServico}</span>
                {item.parcelaQuantidadeMinima && (
                  <span className="ml-2 text-slate-500">
                    — {item.parcelaQuantidadeMinima} {item.parcelaUnidade ?? ''}
                  </span>
                )}
                {item.aiJustificativa && (
                  <p className="mt-1 italic text-slate-500">{item.aiJustificativa}</p>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
