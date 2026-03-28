'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

const UF_LIST = [
  { sigla: 'AC', nome: 'Acre' }, { sigla: 'AL', nome: 'Alagoas' }, { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' }, { sigla: 'BA', nome: 'Bahia' }, { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' }, { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' }, { sigla: 'MA', nome: 'Maranhão' }, { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' }, { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' }, { sigla: 'PB', nome: 'Paraíba' }, { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' }, { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' }, { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' }, { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' }, { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' }, { sigla: 'SE', nome: 'Sergipe' }, { sigla: 'TO', nome: 'Tocantins' },
]

interface SyncStatus {
  status: string
  lastSyncedAt: string | null
  recordsSynced: number | null
  lastSyncError: string | null
  progress: number
  ufs: string[]
  retentionDays: number
  isActive: boolean
}

interface SyncConfig {
  id?: string
  ufs: string[]
  modalidades: number[]
  retentionDays: number
  isActive: boolean
  lastSyncedAt: string | null
  lastSyncStatus: string | null
  recordsSynced: number | null
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'nunca'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora mesmo'
  if (mins < 60) return `${mins} min atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h atrás`
  const days = Math.floor(hrs / 24)
  return `${days} dia${days > 1 ? 's' : ''} atrás`
}

export default function MonitoramentoPncpPage() {
  const { getToken } = useAuth()
  const [config, setConfig] = useState<SyncConfig>({
    ufs: [], modalidades: [], retentionDays: 90, isActive: false,
    lastSyncedAt: null, lastSyncStatus: null, recordsSynced: null,
  })
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const authHeaders = useCallback(async (extra?: Record<string, string>) => {
    const token = await getToken()
    return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }
  }, [getToken])

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/pncp-cache/config`, { headers: await authHeaders() })
      if (res.ok) setConfig(await res.json() as SyncConfig)
    } catch { /* silencioso */ }
  }, [authHeaders])

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/pncp-cache/sync/status`, { headers: await authHeaders() })
      if (res.ok) {
        const data = await res.json() as SyncStatus
        setSyncStatus(data)
        if (data.status !== 'running') {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
          setSyncing(false)
          if (data.status === 'completed') fetchConfig()
        }
      }
    } catch { /* silencioso */ }
  }, [authHeaders, fetchConfig])

  useEffect(() => {
    fetchConfig()
    fetchStatus()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchConfig, fetchStatus])

  function toggleUf(uf: string) {
    setConfig(prev => ({
      ...prev,
      ufs: prev.ufs.includes(uf) ? prev.ufs.filter(u => u !== uf) : [...prev.ufs, uf],
    }))
  }

  async function salvarConfig() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch(`${API_URL}/api/pncp-cache/config`, {
        method: 'PUT',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ufs: config.ufs,
          modalidades: config.modalidades,
          retentionDays: config.retentionDays,
          isActive: config.isActive,
        }),
      })
      if (res.ok) {
        setSaveMsg('Configuração salva com sucesso.')
        await fetchConfig()
      } else {
        const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
        setSaveMsg(body?.error?.message ?? 'Erro ao salvar configuração.')
      }
    } catch {
      setSaveMsg('Erro de conexão.')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 4000)
    }
  }

  async function sincronizarAgora() {
    setSyncing(true)
    try {
      const res = await fetch(`${API_URL}/api/pncp-cache/sync`, {
        method: 'POST',
        headers: await authHeaders(),
      })
      if (res.status === 202) {
        pollRef.current = setInterval(fetchStatus, 5000)
      } else if (res.status === 409) {
        setSyncing(false)
        alert('Sincronização já está em andamento.')
      } else {
        setSyncing(false)
        const body = await res.json() as { error?: { message?: string } }
        alert(body?.error?.message ?? 'Erro ao iniciar sincronização.')
      }
    } catch {
      setSyncing(false)
    }
  }

  const isRunning = syncing || syncStatus?.status === 'running'
  const progress = syncStatus?.progress ?? 0

  return (
    <div className="space-y-6">
      {/* Estado do cache */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[1rem] text-slate-500">database</span>
          Estado do Cache
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Última sincronização</p>
            <p className="text-sm font-medium text-slate-800 mt-0.5">
              {formatRelativeTime(config.lastSyncedAt)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Registros em cache</p>
            <p className="text-sm font-medium text-slate-800 mt-0.5">
              {config.recordsSynced != null ? config.recordsSynced.toLocaleString('pt-BR') : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">UFs monitoradas</p>
            <p className="text-sm font-medium text-slate-800 mt-0.5">
              {config.ufs.length > 0 ? config.ufs.join(', ') : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Status</p>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium mt-0.5 ${
              config.lastSyncStatus === 'completed' ? 'bg-green-50 text-green-700' :
              config.lastSyncStatus === 'failed'    ? 'bg-red-50 text-red-700' :
              config.lastSyncStatus === 'running'   ? 'bg-blue-50 text-blue-700' :
              'bg-slate-100 text-slate-500'
            }`}>
              {config.lastSyncStatus === 'completed' ? '✓ Atualizado' :
               config.lastSyncStatus === 'failed'    ? '✗ Erro' :
               config.lastSyncStatus === 'running'   ? '⟳ Sincronizando' :
               'Não sincronizado'}
            </span>
          </div>
        </div>

        {/* Barra de progresso */}
        {isRunning && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Sincronizando dados do PNCP...</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200">
              <div
                className="h-1.5 rounded-full bg-[#003746] transition-all duration-500"
                style={{ width: `${Math.max(5, progress)}%` }}
              />
            </div>
          </div>
        )}

        {/* Erro */}
        {config.lastSyncStatus === 'failed' && syncStatus?.lastSyncError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-700">
              <strong>Erro na última sincronização:</strong> {syncStatus.lastSyncError}
            </p>
          </div>
        )}
      </div>

      {/* UFs monitoradas */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
          <span className="material-symbols-outlined text-[1rem] text-slate-500">map</span>
          UFs Monitoradas
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Selecione os estados cujos editais serão sincronizados automaticamente.
          {config.ufs.length > 5 && (
            <span className="ml-1 font-medium text-amber-600">
              ⚠ Monitorar {config.ufs.length} UFs pode gerar um volume elevado de dados.
            </span>
          )}
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {UF_LIST.map(uf => (
            <label
              key={uf.sigla}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                config.ufs.includes(uf.sigla)
                  ? 'border-[#003746] bg-[#003746]/5 text-[#003746] font-medium'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                className="accent-[#003746]"
                checked={config.ufs.includes(uf.sigla)}
                onChange={() => toggleUf(uf.sigla)}
              />
              <span className="font-mono font-semibold">{uf.sigla}</span>
              <span className="truncate text-slate-500">{uf.nome}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Configurações */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[1rem] text-slate-500">settings</span>
          Configurações
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Retenção de histórico (dias)
            </label>
            <input
              type="number"
              min={7}
              max={365}
              value={config.retentionDays}
              onChange={e => setConfig(prev => ({ ...prev, retentionDays: Math.max(7, Math.min(365, Number(e.target.value))) }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#003746]"
            />
            <p className="mt-1 text-xs text-slate-400">
              Editais mais antigos que este período serão removidos do cache. Padrão: 90 dias.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Sincronização automática
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={config.isActive}
                  onChange={e => setConfig(prev => ({ ...prev, isActive: e.target.checked }))}
                />
                <div className={`h-5 w-9 rounded-full transition-colors ${config.isActive ? 'bg-[#003746]' : 'bg-slate-300'}`} />
                <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${config.isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-slate-700">
                {config.isActive ? 'Ativa (a cada 4 horas)' : 'Inativa'}
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <button
            onClick={salvarConfig}
            disabled={saving || config.ufs.length === 0}
            className="flex items-center gap-2 rounded-lg bg-[#003746] px-4 py-2 text-sm font-medium text-white hover:bg-[#004d5f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <span className="material-symbols-outlined text-[1rem] animate-spin">refresh</span>
            ) : (
              <span className="material-symbols-outlined text-[1rem]">save</span>
            )}
            Salvar configuração
          </button>
          <button
            onClick={sincronizarAgora}
            disabled={isRunning || config.ufs.length === 0 || !config.id}
            className="flex items-center gap-2 rounded-lg border border-[#003746] px-4 py-2 text-sm font-medium text-[#003746] hover:bg-[#003746]/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span className={`material-symbols-outlined text-[1rem] ${isRunning ? 'animate-spin' : ''}`}>sync</span>
            {isRunning ? 'Sincronizando...' : 'Sincronizar agora'}
          </button>
        </div>
        {saveMsg && (
          <p className={`text-sm ${saveMsg.includes('sucesso') ? 'text-green-600' : 'text-red-600'}`}>
            {saveMsg}
          </p>
        )}
      </div>

      {config.ufs.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            <strong>Selecione pelo menos uma UF</strong> para habilitar o monitoramento do PNCP.
          </p>
        </div>
      )}
    </div>
  )
}
