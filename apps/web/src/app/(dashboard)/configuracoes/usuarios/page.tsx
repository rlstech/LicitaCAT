'use client'

import { useEffect, useState, useCallback } from 'react'
import { useToken } from '@/hooks/use-token'
import { useSession } from '@/lib/auth-client'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserEntry {
  id: string
  email: string
  name: string
  role: 'admin' | 'analyst' | 'viewer'
  active: boolean
  createdAt: string
}

interface CurrentUser {
  id: string
  role: 'admin' | 'analyst' | 'viewer'
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  admin:   { label: 'Administrador', bg: 'bg-[#003746]',      text: 'text-white' },
  analyst: { label: 'Analista',      bg: 'bg-blue-100',       text: 'text-blue-700' },
  viewer:  { label: 'Visualizador',  bg: 'bg-slate-100',      text: 'text-slate-600' },
} as const

const ROLE_DESCRIPTIONS = {
  admin:   'Acesso total + gestão de usuários',
  analyst: 'Criar e editar editais, CATs e cruzamentos',
  viewer:  'Somente visualizar (sem criar ou editar)',
} as const

// ─── Small components ─────────────────────────────────────────────────────────

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function RoleBadge({ role }: { role: 'admin' | 'analyst' | 'viewer' }) {
  const cfg = ROLE_CONFIG[role]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#003746] text-xs font-bold text-white">
      {initials}
    </div>
  )
}

// ─── Invite form ──────────────────────────────────────────────────────────────

function InviteForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (user: UserEntry) => void
  onCancel: () => void
}) {
  const getToken = useToken()
  const [email, setEmail]   = useState('')
  const [name, setName]     = useState('')
  const [role, setRole]     = useState<'admin' | 'analyst' | 'viewer'>('analyst')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const token = await getToken()
      const r = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email, name, role }),
      })
      if (r.ok) {
        const user = await r.json() as UserEntry
        onSuccess(user)
      } else {
        const body = await r.json() as { error?: { message?: string } }
        setError(body?.error?.message ?? 'Erro ao convidar usuário.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-[#003746]/20 bg-[#f3faff] p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-800">Convidar novo usuário</h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Nome completo</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: João da Silva"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:border-[#003746] focus:outline-none focus:ring-1 focus:ring-[#003746]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Ex.: joao@empresa.com.br"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:border-[#003746] focus:outline-none focus:ring-1 focus:ring-[#003746]"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-2 block text-xs font-medium text-slate-600">Nível de acesso</label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(['admin', 'analyst', 'viewer'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                role === r
                  ? 'border-[#003746] bg-white shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full border-2 transition-colors ${
                  role === r ? 'border-[#003746] bg-[#003746]' : 'border-slate-300'
                }`} />
                <span className="text-xs font-semibold text-slate-800">{ROLE_CONFIG[r].label}</span>
              </div>
              <p className="mt-1 pl-5 text-[10px] text-slate-400">{ROLE_DESCRIPTIONS[r]}</p>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          <span className="material-symbols-outlined text-[0.9rem]">error</span>
          {error}
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-[#003746] px-4 py-2 text-sm font-semibold text-white hover:bg-[#002a36] disabled:opacity-50">
          {saving && <Spinner className="h-3.5 w-3.5" />}
          {saving ? 'Convidando…' : 'Convidar usuário'}
        </button>
      </div>

      <p className="mt-3 text-[10px] text-slate-400">
        O usuário deve se cadastrar em <strong>/sign-up</strong> com este e-mail. O acesso será liberado automaticamente após o primeiro login.
      </p>
    </form>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const getToken = useToken()
  const { isPending } = useSession()

  const [users, setUsers]             = useState<UserEntry[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading]         = useState(true)
  const [showInvite, setShowInvite]   = useState(false)

  // per-row state
  const [editingRole, setEditingRole]   = useState<string | null>(null)
  const [confirmDeact, setConfirmDeact] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [saving, setSaving]             = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const token = await getToken()
      const h = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      const [meRes, listRes] = await Promise.all([
        fetch(`${API_URL}/api/users/me`, { headers: h }),
        fetch(`${API_URL}/api/users`, { headers: h }),
      ])
      if (meRes.ok) setCurrentUser(await meRes.json() as CurrentUser)
      if (listRes.ok) setUsers(await listRes.json() as UserEntry[])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [getToken])

  useEffect(() => {
    if (!!isPending) return
    fetchAll()
  }, [fetchAll, !isPending])

  async function changeRole(userId: string, newRole: 'admin' | 'analyst' | 'viewer') {
    setSaving(userId)
    try {
      const token = await getToken()
      const r = await fetch(`${API_URL}/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ role: newRole }),
      })
      if (r.ok) {
        const updated = await r.json() as UserEntry
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: updated.role } : u))
        setEditingRole(null)
      }
    } catch { /* ignore */ } finally { setSaving(null) }
  }

  async function deactivate(userId: string) {
    setSaving(userId)
    try {
      const token = await getToken()
      const r = await fetch(`${API_URL}/api/users/${userId}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (r.status === 204) {
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, active: false } : u))
        setConfirmDeact(null)
      }
    } catch { /* ignore */ } finally { setSaving(null) }
  }

  async function hardDelete(userId: string) {
    setSaving(userId)
    try {
      const token = await getToken()
      const r = await fetch(`${API_URL}/api/users/${userId}/permanent`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (r.status === 204) {
        setUsers((prev) => prev.filter((u) => u.id !== userId))
        setConfirmDelete(null)
      }
    } catch { /* ignore */ } finally { setSaving(null) }
  }

  async function reactivate(userId: string) {
    setSaving(userId)
    try {
      const token = await getToken()
      const r = await fetch(`${API_URL}/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ active: true }),
      })
      if (r.ok) {
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, active: true } : u))
      }
    } catch { /* ignore */ } finally { setSaving(null) }
  }

  const isAdmin = currentUser?.role === 'admin'
  const activeUsers   = users.filter((u) => u.active)
  const inactiveUsers = users.filter((u) => !u.active)

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Spinner className="h-6 w-6 text-[#003746]" />
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {activeUsers.length} usuário{activeUsers.length !== 1 ? 's' : ''} ativo{activeUsers.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isAdmin && !showInvite && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 rounded-xl bg-[#003746] px-4 py-2 text-sm font-semibold text-white hover:bg-[#002a36] transition-colors"
          >
            <span className="material-symbols-outlined text-[1.1rem]">person_add</span>
            Convidar usuário
          </button>
        )}
      </div>

      {/* Invite form */}
      {showInvite && (
        <InviteForm
          onSuccess={(newUser) => {
            setUsers((prev) => [...prev, newUser])
            setShowInvite(false)
          }}
          onCancel={() => setShowInvite(false)}
        />
      )}

      {/* Users table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <span className="material-symbols-outlined text-4xl text-slate-200">group</span>
            <p className="text-sm text-slate-400">Nenhum usuário cadastrado.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Usuário</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Acesso</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                {isAdmin && (
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Ações</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[...activeUsers, ...inactiveUsers].map((user) => {
                const isMe = user.id === currentUser?.id
                const isEditing = editingRole === user.id
                const isConfirming = confirmDeact === user.id
                const isConfirmingDelete = confirmDelete === user.id
                const isSaving = saving === user.id

                return (
                  <tr key={user.id} className={`transition-colors ${!user.active ? 'opacity-50' : 'hover:bg-slate-50/50'}`}>

                    {/* User info */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} />
                        <div>
                          <p className="font-medium text-slate-800">
                            {user.name}
                            {isMe && (
                              <span className="ml-2 rounded-full bg-[#e6f6ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#003746]">você</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-6 py-4">
                      {isAdmin && isEditing && !isMe ? (
                        <div className="flex items-center gap-2">
                          <select
                            defaultValue={user.role}
                            onChange={(e) => changeRole(user.id, e.target.value as 'admin' | 'analyst' | 'viewer')}
                            disabled={isSaving}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-[#003746] focus:outline-none"
                          >
                            <option value="admin">Administrador</option>
                            <option value="analyst">Analista</option>
                            <option value="viewer">Visualizador</option>
                          </select>
                          {isSaving && <Spinner className="h-3.5 w-3.5 text-[#003746]" />}
                          <button onClick={() => setEditingRole(null)} className="text-xs text-slate-400 hover:text-slate-600">
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <RoleBadge role={user.role} />
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {user.active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                          Inativo
                        </span>
                      )}
                    </td>

                    {/* Actions (admin only) */}
                    {isAdmin && (
                      <td className="px-6 py-4">
                        {isMe ? (
                          <span className="text-xs text-slate-300">—</span>
                        ) : isConfirmingDelete ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-red-600 font-medium">Excluir permanentemente?</span>
                            <button
                              onClick={() => hardDelete(user.id)}
                              disabled={isSaving}
                              className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              {isSaving ? <Spinner className="h-3 w-3" /> : 'Confirmar'}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : isConfirming ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-slate-500">Confirmar?</span>
                            <button
                              onClick={() => deactivate(user.id)}
                              disabled={isSaving}
                              className="rounded-lg bg-orange-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                            >
                              {isSaving ? <Spinner className="h-3 w-3" /> : 'Desativar'}
                            </button>
                            <button
                              onClick={() => setConfirmDeact(null)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            {user.active ? (
                              <>
                                <button
                                  onClick={() => { setEditingRole(user.id); setConfirmDeact(null); setConfirmDelete(null) }}
                                  title="Alterar nível de acesso"
                                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                >
                                  <span className="material-symbols-outlined text-[1rem]">manage_accounts</span>
                                </button>
                                <button
                                  onClick={() => { setConfirmDeact(user.id); setEditingRole(null); setConfirmDelete(null) }}
                                  title="Desativar usuário"
                                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-orange-50 hover:text-orange-500"
                                >
                                  <span className="material-symbols-outlined text-[1rem]">person_off</span>
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => reactivate(user.id)}
                                disabled={isSaving}
                                title="Reativar usuário"
                                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                              >
                                {isSaving ? <Spinner className="h-3 w-3" /> : <span className="material-symbols-outlined text-[0.9rem]">person</span>}
                                Reativar
                              </button>
                            )}
                            <button
                              onClick={() => { setConfirmDelete(user.id); setConfirmDeact(null); setEditingRole(null) }}
                              title="Excluir usuário permanentemente"
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                            >
                              <span className="material-symbols-outlined text-[1rem]">delete</span>
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Info card */}
      <div className="flex items-start gap-3 rounded-xl border border-[#003746]/10 bg-[#f3faff] px-4 py-3">
        <span className="material-symbols-outlined mt-0.5 shrink-0 text-[1rem] text-[#003746]">info</span>
        <div className="space-y-0.5 text-xs text-slate-500">
          <p><strong className="text-slate-700">Como convidar:</strong> cadastre o e-mail aqui, depois o usuário se registra em <code className="rounded bg-white px-1 py-0.5 text-[#003746]">/sign-up</code> com esse mesmo e-mail. O acesso é liberado automaticamente no primeiro login.</p>
          <p><strong className="text-slate-700">Analista</strong> pode criar e editar editais, CATs e cruzamentos. <strong className="text-slate-700">Visualizador</strong> só consulta.</p>
        </div>
      </div>
    </div>
  )
}
