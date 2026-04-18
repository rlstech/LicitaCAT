'use client'

import { useState, useCallback, useEffect } from 'react'
import { useToken } from '@/hooks/use-token'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

interface Profissional {
  id: string
  nome: string
  numeroCreaCau: string
  conselho: 'CREA' | 'CAU'
  ufRegistro: string
  ativo: boolean
}

const UF_LIST = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export default function ProfissionaisPage() {
  const getToken = useToken()
  const [profissionais, setProfissionais] = useState<Profissional[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ nome: '', numeroCreaCau: '', conselho: 'CREA' as 'CREA' | 'CAU', ufRegistro: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchProfissionais = useCallback(async () => {
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/cats/profissionais`, {
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (res.ok) setProfissionais(await res.json() as Profissional[])
    } catch { /* silent */ } finally { setLoading(false) }
  }, [getToken])

  useEffect(() => { fetchProfissionais() }, [fetchProfissionais])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/cats/profissionais`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(formData),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: { message?: string } }).error?.message ?? 'Erro ao salvar')
      }
      setFormData({ nome: '', numeroCreaCau: '', conselho: 'CREA', ufRegistro: '' })
      setShowForm(false)
      fetchProfissionais()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally { setSaving(false) }
  }

  return (
    <div className="max-w-4xl pb-12">

      {/* ── Header ── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Profissionais Técnicos</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {profissionais.length > 0
              ? `${profissionais.filter(p => p.ativo).length} de ${profissionais.length} ativos`
              : 'Responsáveis técnicos da empresa'}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
            showForm
              ? 'text-slate-600 hover:bg-white'
              : 'bg-brand-600 text-white hover:bg-brand-700'
          }`}
          style={showForm ? { border: '1px solid var(--border)' } : undefined}
        >
          {showForm ? (
            'Cancelar'
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Novo Profissional
            </>
          )}
        </button>
      </div>

      {/* ── Form ── */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-5 overflow-hidden rounded-xl bg-white"
          style={{ border: '1px solid var(--border)' }}
        >
          <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border-soft)' }}>
            <h2 className="text-sm font-semibold text-slate-900">Novo profissional</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Nome completo</label>
              <input
                type="text"
                required
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Eng. João da Silva"
                className="mt-1.5 block w-full rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
                style={{ border: '1px solid var(--border)', backgroundColor: 'var(--canvas)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Nº CREA / CAU</label>
              <input
                type="text"
                required
                value={formData.numeroCreaCau}
                onChange={(e) => setFormData({ ...formData, numeroCreaCau: e.target.value })}
                placeholder="123456/D-SP"
                className="mt-1.5 block w-full rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
                style={{ border: '1px solid var(--border)', backgroundColor: 'var(--canvas)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Conselho</label>
              <div className="mt-1.5 flex gap-2">
                {(['CREA', 'CAU'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormData({ ...formData, conselho: c })}
                    className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                      formData.conselho === c
                        ? 'bg-brand-600 text-white'
                        : 'text-slate-600 hover:bg-white'
                    }`}
                    style={formData.conselho !== c ? { border: '1px solid var(--border)' } : undefined}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">UF Registro</label>
              <select
                required
                value={formData.ufRegistro}
                onChange={(e) => setFormData({ ...formData, ufRegistro: e.target.value })}
                className="mt-1.5 block w-full rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none transition-colors"
                style={{ border: '1px solid var(--border)', backgroundColor: 'var(--canvas)' }}
              >
                <option value="">Selecione…</option>
                {UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <p className="px-6 pb-2 text-sm text-red-600">{error}</p>
          )}

          <div
            className="flex justify-end px-6 py-3"
            style={{ borderTop: '1px solid var(--border-soft)', backgroundColor: 'var(--canvas)' }}
          >
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar profissional'}
            </button>
          </div>
        </form>
      )}

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-xl bg-white" style={{ border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="h-5 w-5 animate-spin text-brand-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : profissionais.length === 0 ? (
          /* Empty state */
          <div className="px-6 py-14 text-center">
            <div
              className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(124,58,237,0.08)' }}
            >
              <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">Nenhum profissional cadastrado</p>
            <p className="mt-1 text-xs text-slate-400">Cadastre os responsáveis técnicos para vincular às CATs.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Cadastrar primeiro profissional
            </button>
          </div>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr style={{ backgroundColor: 'var(--canvas)', borderBottom: '1px solid var(--border-soft)' }}>
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Nome</th>
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Registro</th>
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Conselho</th>
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">UF</th>
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {profissionais.map((p) => (
                <tr
                  key={p.id}
                  className="transition-colors hover:bg-slate-50"
                  style={{ borderTop: '1px solid var(--border-soft)' }}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-brand-700"
                        style={{ backgroundColor: 'rgba(124,58,237,0.08)' }}
                      >
                        {p.nome.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-slate-900">{p.nome}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{p.numeroCreaCau}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">
                      {p.conselho}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-600">{p.ufRegistro}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      p.ativo ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {p.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
