'use client'

import type { CrossingItem, CatMatch } from '../_lib/types'

interface CatGroup {
  catId: string
  catNumeroCat: string | null
  catEmpresaContratante: string | null
  catTipoObra: string | null
  catDescricaoTecnica: string | null
  items: CatMatch[]
}

function groupByCat(matches: CatMatch[]): CatGroup[] {
  const map = new Map<string, CatGroup>()

  for (const match of matches) {
    const key = match.catId
    let group = map.get(key)
    if (!group) {
      group = {
        catId: match.catId,
        catNumeroCat: match.catNumeroCat,
        catEmpresaContratante: match.catEmpresaContratante,
        catTipoObra: match.catTipoObra,
        catDescricaoTecnica: match.catDescricaoTecnica,
        items: [],
      }
      map.set(key, group)
    }
    group.items.push(match)
  }

  return Array.from(map.values())
}

export function CatMatchesDetail({ item }: { item: CrossingItem }) {
  const matching = item.catMatches.filter(m => m.avaliacaoLlm !== 'nao_atende')

  if (matching.length === 0) {
    return (
      <p className="py-2 text-xs text-slate-400">Nenhuma CAT atende este requisito.</p>
    )
  }

  const groups = groupByCat(matching)
  const totalItens = matching.length

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#003746]">
        {groups.length === 1
          ? `1 CAT vinculada — ${totalItens} ${totalItens === 1 ? 'item encontrado' : 'itens encontrados'}`
          : `${groups.length} CATs vinculadas — ${totalItens} ${totalItens === 1 ? 'item' : 'itens'} no total`}
      </p>

      {groups.map((group) => (
        <div
          key={group.catId}
          className="overflow-hidden rounded-lg"
          style={{ border: '1px solid var(--border-soft)' }}
        >
          {/* CAT Header */}
          <div className="flex items-start gap-3 bg-[#f8fbfd] px-4 py-3" style={{ borderBottom: '1px solid var(--border-soft)' }}>
            <span className="material-symbols-outlined mt-0.5 text-[18px] text-[#003746]">badge</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-xs font-bold text-[#003746]">
                  {group.catEmpresaContratante ?? group.catTipoObra ?? '—'}
                </p>
                {group.catNumeroCat && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                    CAT {group.catNumeroCat}
                  </span>
                )}
              </div>
              {group.catDescricaoTecnica && (
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {group.catDescricaoTecnica}
                </p>
              )}
            </div>
          </div>

          {/* Itens da CAT */}
          <table className="w-full table-fixed text-xs">
            <colgroup>
              <col className="w-10" />
              <col />
              <col className="w-[110px]" />
              <col className="w-[280px]" />
              <col className="w-[90px]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-50/50 text-left">
                <th className="px-3 py-1.5 font-semibold text-slate-400">#</th>
                <th className="px-3 py-1.5 font-semibold text-slate-400">Descrição do item</th>
                <th className="px-3 py-1.5 font-semibold text-slate-400">Quantitativo</th>
                <th className="px-3 py-1.5 font-semibold text-slate-400">Justificativa IA</th>
                <th className="px-3 py-1.5 text-right font-semibold text-slate-400">Aderência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {group.items.map((match, idx) => {
                const similarityTooltip = `Similaridade semântica: ${(parseFloat(match.scoreSimilaridade) * 100).toFixed(0)}%`
                const aderencia = match.avaliacaoLlm === 'atende' ? { label: '100%', color: 'text-emerald-600' }
                  : match.avaliacaoLlm === 'atende_parcialmente' ? { label: '50%', color: 'text-amber-500' }
                  : { label: '0%', color: 'text-red-500' }
                const qty = match.catItemQuantidade
                  ? parseFloat(match.catItemQuantidade).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
                  : null

                return (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2.5 font-medium text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2.5">
                      {match.catItemDescricao ? (
                        <p className="truncate font-medium leading-snug text-slate-800" title={match.catItemDescricao}>{match.catItemDescricao}</p>
                      ) : (
                        <p className="italic text-slate-400">Sem descrição de item</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                      {qty ? (
                        <span className="font-semibold tabular-nums">
                          {qty} <span className="font-normal text-slate-400">{match.catItemUnidade ?? ''}</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {match.justificativaLlm ? (
                        <p className="text-xs italic leading-relaxed text-slate-500 line-clamp-2">{match.justificativaLlm}</p>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right" title={similarityTooltip}>
                      <span className={`font-semibold ${aderencia.color}`}>{aderencia.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

    </div>
  )
}
