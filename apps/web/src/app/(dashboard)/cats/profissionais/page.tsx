'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

interface Profissional {
    id: string
    nome: string
    numeroCreaCau: string
    conselho: 'CREA' | 'CAU'
    ufRegistro: string
    ativo: boolean
}

export default function ProfissionaisPage() {
    const { getToken } = useAuth()
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
        <div>
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Profissionais Técnicos</h1>
                    <p className="mt-1 text-gray-600">Gerencie os responsáveis técnicos da empresa</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
                >
                    {showForm ? 'Cancelar' : '+ Novo Profissional'}
                </button>
            </div>

            {/* Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nome completo</label>
                            <input
                                type="text" required value={formData.nome}
                                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nº CREA/CAU</label>
                            <input
                                type="text" required value={formData.numeroCreaCau}
                                onChange={(e) => setFormData({ ...formData, numeroCreaCau: e.target.value })}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Conselho</label>
                            <select
                                value={formData.conselho}
                                onChange={(e) => setFormData({ ...formData, conselho: e.target.value as 'CREA' | 'CAU' })}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            >
                                <option value="CREA">CREA</option>
                                <option value="CAU">CAU</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">UF Registro</label>
                            <input
                                type="text" required maxLength={2} value={formData.ufRegistro}
                                onChange={(e) => setFormData({ ...formData, ufRegistro: e.target.value.toUpperCase() })}
                                placeholder="SP"
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            />
                        </div>
                    </div>
                    {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
                    <div className="mt-4 flex justify-end">
                        <button
                            type="submit" disabled={saving}
                            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                        >
                            {saving ? 'Salvando...' : 'Salvar Profissional'}
                        </button>
                    </div>
                </form>
            )}

            {/* Table */}
            <div className="mt-8">
                <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Nome</th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Registro</th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Conselho</th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">UF</th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">Carregando...</td></tr>
                            ) : profissionais.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">Nenhum profissional cadastrado.</td></tr>
                            ) : profissionais.map((p) => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">{p.nome}</td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{p.numeroCreaCau}</td>
                                    <td className="whitespace-nowrap px-6 py-4"><span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">{p.conselho}</span></td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{p.ufRegistro}</td>
                                    <td className="whitespace-nowrap px-6 py-4">
                                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${p.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {p.ativo ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
