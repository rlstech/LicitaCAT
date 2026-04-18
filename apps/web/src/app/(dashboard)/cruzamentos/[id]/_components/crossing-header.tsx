'use client'

import Link from 'next/link'

interface Props {
  crossingStatus: string
  retrying: boolean
  exporting: boolean
  onRetry: () => void
  onExportCSV: () => void
  onPrint: () => void
}

export function CrossingHeader({
  crossingStatus,
  retrying,
  exporting,
  onRetry,
  onExportCSV,
  onPrint,
}: Props) {
  const isProcessing = crossingStatus === 'processing' || crossingStatus === 'queued'

  return (
    <div className="mb-8 flex items-start justify-between" data-print-hide>
      <div className="flex flex-col gap-1">
        <Link
          href="/cruzamentos"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#003746] hover:underline"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Cruzamentos
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-[#003746]">
          Análise de Cruzamento
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onRetry}
          disabled={retrying || isProcessing}
          className="flex items-center gap-2 rounded-lg bg-[#e6f6ff] px-4 py-2 text-sm font-semibold text-[#003746] transition-colors hover:bg-[#d5ecf8] disabled:opacity-40"
        >
          <span className={`material-symbols-outlined text-[18px] ${retrying ? 'animate-spin' : ''}`}>
            refresh
          </span>
          {retrying ? 'Iniciando...' : 'Nova tentativa'}
        </button>

        {crossingStatus === 'completed' && (
          <>
            <button
              onClick={onExportCSV}
              disabled={exporting}
              className="flex items-center gap-2 rounded-lg bg-[#e6f6ff] px-4 py-2 text-sm font-semibold text-[#003746] transition-colors hover:bg-[#d5ecf8] disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              {exporting ? 'Exportando...' : 'CSV'}
            </button>
            <button
              onClick={onPrint}
              className="flex items-center gap-2 rounded-lg bg-[#003746] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              Imprimir
            </button>
          </>
        )}
      </div>
    </div>
  )
}
