'use client'

interface Props {
  status: string
  retrying: boolean
  onRetry: () => void
}

export function StatusBanners({ status, retrying, onRetry }: Props) {
  if (status === 'processing') {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#003746]/20 bg-[#003746]/5 px-5 py-3.5">
        <span className="material-symbols-outlined animate-spin text-[20px] text-[#003746]">sync</span>
        <p className="text-sm font-medium text-[#003746]">
          Cruzamento em andamento — atualizando a cada 5 segundos...
        </p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-red-500">error</span>
          <p className="text-sm font-medium text-red-800">
            O cruzamento falhou. Verifique os logs ou tente novamente.
          </p>
        </div>
        <button
          onClick={onRetry}
          disabled={retrying}
          className="shrink-0 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {retrying ? 'Iniciando...' : 'Tentar novamente'}
        </button>
      </div>
    )
  }

  return null
}
