'use client'

import { useState } from 'react'
import type { OverrideModal as OverrideModalType } from '../_lib/types'

interface Props {
  modal: OverrideModalType
  submitting: string | null
  onConfirm: (itemId: string, resultado: string, note?: string) => void
  onCancel: () => void
}

export function OverrideModal({ modal, submitting, onConfirm, onCancel }: Props) {
  const [note, setNote] = useState(modal.note)
  const isSubmitting = submitting === modal.itemId

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white"
        style={{ boxShadow: '0 25px 50px rgba(15,23,42,0.20), 0 0 0 1px rgba(15,23,42,0.10)' }}
      >
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border-soft)' }}>
          <h3 className="text-sm font-semibold text-slate-900">
            {modal.action === 'aprovar' ? 'Aprovar como Atendido' : 'Rejeitar como Gap'}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{modal.itemLabel}</p>
        </div>
        <div className="px-6 py-4">
          <label className="block text-xs font-medium text-slate-600">
            Nota de revisão <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Justifique a decisão..."
            rows={3}
            className="mt-1.5 w-full rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            style={{ border: '1px solid var(--border)', backgroundColor: 'var(--canvas)' }}
          />
        </div>
        <div
          className="flex items-center justify-end gap-2 px-6 py-3"
          style={{ borderTop: '1px solid var(--border-soft)', backgroundColor: 'var(--canvas)' }}
        >
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white disabled:opacity-50"
            style={{ border: '1px solid var(--border)' }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(
              modal.itemId,
              modal.action === 'aprovar' ? 'atendido' : 'gap',
              note || undefined,
            )}
            disabled={isSubmitting}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
              modal.action === 'aprovar' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isSubmitting
              ? 'Salvando...'
              : modal.action === 'aprovar' ? 'Confirmar aprovação' : 'Confirmar rejeição'}
          </button>
        </div>
      </div>
    </div>
  )
}
