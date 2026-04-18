'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCrossingData } from './_lib/use-crossing-data'
import { CrossingHeader } from './_components/crossing-header'
import { StatusBanners } from './_components/status-banners'
import { CrossingHero } from './_components/crossing-hero'
import { ItemsSection } from './_components/items-section'
import { OverrideModal } from './_components/override-modal'
import { PrintSection } from './_components/print-section'

export default function CruzamentoDetailPage() {
  const params = useParams()
  const crossingId = params.id as string

  const {
    crossing,
    items,
    loading,
    submitting,
    exporting,
    retrying,
    activeTab,
    setActiveTab,
    overrideModal,
    setOverrideModal,
    counts,
    filteredItems,
    recInfo,
    startNewCrossing,
    exportCSV,
    overrideItem,
  } = useCrossingData(crossingId)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-32">
        <span className="material-symbols-outlined animate-spin text-[28px] text-[#003746]">sync</span>
        <p className="text-sm text-slate-400">Carregando análise...</p>
      </div>
    )
  }

  if (!crossing) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-slate-400">Cruzamento não encontrado.</p>
        <Link href="/cruzamentos" className="mt-4 inline-block text-sm font-medium text-[#003746] hover:underline">
          ← Voltar
        </Link>
      </div>
    )
  }

  return (
    <div className="pb-16">
      <CrossingHeader
        crossingStatus={crossing.status}
        retrying={retrying}
        exporting={exporting}
        onRetry={startNewCrossing}
        onExportCSV={exportCSV}
        onPrint={() => window.print()}
      />

      <StatusBanners
        status={crossing.status}
        retrying={retrying}
        onRetry={startNewCrossing}
      />

      {recInfo && (
        <CrossingHero
          crossing={crossing}
          recInfo={recInfo}
          counts={counts}
          activeTab={activeTab}
          onSetActiveTab={setActiveTab}
        />
      )}

      <ItemsSection
        items={items}
        filteredItems={filteredItems}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        submitting={submitting}
        onOverride={(itemId, action, label) =>
          setOverrideModal({ itemId, action, itemLabel: label, note: '' })
        }
        onExceptionalOverride={(itemId, resultado) => overrideItem(itemId, resultado)}
        crossingStatus={crossing.status}
      />

      <PrintSection items={items} />

      {overrideModal && (
        <OverrideModal
          modal={overrideModal}
          submitting={submitting}
          onConfirm={overrideItem}
          onCancel={() => setOverrideModal(null)}
        />
      )}
    </div>
  )
}
