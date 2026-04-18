import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useToken } from '@/hooks/use-token'
import type { Crossing, CrossingItem, OverrideModal, ActiveTab, RecConfig, Counts } from './types'
import { REC_CONFIG } from './config'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function useCrossingData(crossingId: string) {
  const getToken = useToken()

  const [crossing, setCrossing] = useState<Crossing | null>(null)
  const [items, setItems] = useState<CrossingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('todos')
  const [overrideModal, setOverrideModal] = useState<OverrideModal | null>(null)

  const statusRef = useRef<string | undefined>(undefined)
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null)

  const getHeaders = useCallback(async () => {
    const token = await getToken()
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }, [getToken])

  const fetchData = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const [cRes, iRes] = await Promise.all([
        fetch(`${API_URL}/api/crossings/${crossingId}`, { headers }),
        fetch(`${API_URL}/api/crossings/${crossingId}/items`, { headers }),
      ])
      if (cRes.ok) {
        const data = await cRes.json() as Crossing
        setCrossing(data)
        statusRef.current = data.status
      }
      if (iRes.ok) setItems(await iRes.json() as CrossingItem[])
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [getHeaders, crossingId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (statusRef.current !== 'processing') return

    let es: EventSource | null = null
    let fallbackInterval: ReturnType<typeof setInterval> | null = null

    const startPollingFallback = () => {
      if (fallbackInterval) return
      fallbackInterval = setInterval(fetchData, 5000)
    }

    try {
      es = new EventSource(`${API_URL}/api/crossings/${crossingId}/stream`, { withCredentials: true })

      es.addEventListener('update', (e: MessageEvent<string>) => {
        try {
          const payload = JSON.parse(e.data) as {
            type: string
            itemId?: string
            resultado?: string
            scoreSimilaridadeMax?: number
            catMatchesCount?: number
            processed?: number
            total?: number
            scoreAderencia?: number
            recomendacao?: string
          }

          if (payload.type === 'item_updated' && payload.itemId) {
            setItems(prev => prev.map(i =>
              i.id === payload.itemId
                ? {
                    ...i,
                    resultado: payload.resultado ?? i.resultado,
                    scoreSimilaridadeMax: payload.scoreSimilaridadeMax != null
                      ? String(payload.scoreSimilaridadeMax)
                      : i.scoreSimilaridadeMax,
                    justUpdated: true,
                  }
                : i,
            ))
            // Clear flash after animation
            setTimeout(() => {
              setItems(prev => prev.map(i =>
                i.id === payload.itemId ? { ...i, justUpdated: false } : i,
              ))
            }, 2000)
          } else if (payload.type === 'progress') {
            setProgress({ processed: payload.processed ?? 0, total: payload.total ?? 0 })
          } else if (payload.type === 'completed' || payload.type === 'error') {
            es?.close()
            void fetchData()
          }
        } catch { /* ignore */ }
      })

      es.onerror = () => {
        es?.close()
        startPollingFallback()
      }
    } catch {
      startPollingFallback()
    }

    return () => {
      es?.close()
      if (fallbackInterval) clearInterval(fallbackInterval)
    }
  }, [fetchData, crossingId, crossing?.status])

  const startNewCrossing = useCallback(async () => {
    if (!crossing) return
    setRetrying(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${API_URL}/api/crossings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ editalId: crossing.editalId }),
      })
      if (res.ok) {
        const { crossingId: newId } = await res.json() as { crossingId: string }
        window.location.href = `/cruzamentos/${newId}`
      }
    } catch { /* silent */ } finally {
      setRetrying(false)
    }
  }, [crossing, getHeaders])

  const exportCSV = useCallback(async () => {
    setExporting(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/crossings/${crossingId}/export/csv`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (res.ok) {
        const blob = await res.blob()
        downloadBlob(blob, `cruzamento-${crossingId.slice(0, 8)}.csv`)
      }
    } catch { /* silent */ } finally {
      setExporting(false)
    }
  }, [getToken, crossingId])

  const overrideItem = useCallback(async (itemId: string, resultado: string, note?: string) => {
    setSubmitting(itemId)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${API_URL}/api/crossings/${crossingId}/items/${itemId}/override`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ resultado, note }),
      })
      if (!res.ok) return
      setItems(prev => prev.map(i =>
        i.id === itemId ? { ...i, resultado, humanOverride: true, humanOverrideNote: note ?? null } : i
      ))
      const cRes = await fetch(`${API_URL}/api/crossings/${crossingId}`, { headers })
      if (cRes.ok) setCrossing(await cRes.json() as Crossing)
      setOverrideModal(null)
    } catch { /* silent */ } finally {
      setSubmitting(null)
    }
  }, [getHeaders, crossingId])

  // Derived state
  const counts: Counts = useMemo(() => {
    const atendidos = items.length > 0 ? items.filter(i => i.resultado === 'atendido').length : (crossing?.requisitosAtendidos ?? 0)
    const parciais = items.length > 0 ? items.filter(i => i.resultado === 'atendido_parcialmente').length : (crossing?.requisitosComRessalva ?? 0)
    const gaps = items.length > 0 ? items.filter(i => i.resultado === 'gap').length : (crossing?.requisitosGap ?? 0)
    const total = items.length > 0 ? items.length : (crossing?.totalRequisitos ?? 0)
    const pendentes = items.filter(i => i.resultado === 'atendido_parcialmente' && !i.humanOverride).length
    const totalParciais = crossing?.requisitosComRessalva ?? parciais
    const revisados = items.filter(i => i.humanOverride && (i.resultado === 'atendido' || i.resultado === 'gap')).length
    return { atendidos, parciais, gaps, total, pendentes, revisados, totalParciais }
  }, [items, crossing])

  const filteredItems = useMemo(() => {
    switch (activeTab) {
      case 'pendentes': return items.filter(i => i.resultado === 'atendido_parcialmente' && !i.humanOverride)
      case 'atendidos': return items.filter(i => i.resultado === 'atendido')
      case 'gaps': return items.filter(i => i.resultado === 'gap')
      default: return items
    }
  }, [items, activeTab])

  const recInfo: RecConfig | null = crossing?.recomendacao ? REC_CONFIG[crossing.recomendacao] ?? null : null

  return {
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
    progress,
    startNewCrossing,
    exportCSV,
    overrideItem,
  }
}
