'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Command {
  id: string
  label: string
  description?: string
  group: string
  href?: string
  action?: () => void
  icon: React.ReactNode
  keywords?: string[]
}

const ICONS = {
  dashboard: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  edital: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  cat: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
  crossing: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  ),
  upload: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  ),
  person: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  ),
}

function buildCommands(): Command[] {
  return [
    // Navegação
    { id: 'nav-dashboard', label: 'Dashboard', group: 'Navegação', href: '/dashboard', icon: ICONS.dashboard, keywords: ['home', 'início', 'visão geral'] },
    { id: 'nav-editais', label: 'Editais', description: 'Lista de editais de licitação', group: 'Navegação', href: '/editais', icon: ICONS.edital, keywords: ['licitação', 'edital'] },
    { id: 'nav-cats', label: 'Acervo CATs', description: 'Certidões de Acervo Técnico', group: 'Navegação', href: '/cats', icon: ICONS.cat, keywords: ['certidão', 'acervo', 'cat'] },
    { id: 'nav-cruzamentos', label: 'Cruzamentos', description: 'Análise de aderência', group: 'Navegação', href: '/cruzamentos', icon: ICONS.crossing, keywords: ['análise', 'score', 'aderência'] },
    // Ações
    { id: 'action-upload-edital', label: 'Novo Edital', description: 'Upload de PDF de licitação', group: 'Ações', href: '/editais/upload', icon: ICONS.upload, keywords: ['upload', 'novo', 'edital', 'pdf'] },
    { id: 'action-upload-cat', label: 'Nova CAT', description: 'Cadastrar certidão de acervo técnico', group: 'Ações', href: '/cats/upload', icon: ICONS.upload, keywords: ['upload', 'nova', 'cat', 'certidão'] },
    { id: 'action-profissionais', label: 'Profissionais', description: 'Gerenciar profissionais técnicos', group: 'Ações', href: '/cats/profissionais', icon: ICONS.person, keywords: ['profissional', 'engenheiro', 'crea', 'cau'] },
    { id: 'action-lote-edital', label: 'Upload em Lote — Editais', description: 'Enviar múltiplos PDFs de uma vez', group: 'Ações', href: '/editais/upload/lote', icon: ICONS.upload, keywords: ['lote', 'batch', 'múltiplos', 'vários', 'editais'] },
    { id: 'action-lote-cat', label: 'Upload em Lote — CATs', description: 'Enviar múltiplas CATs de uma vez', group: 'Ações', href: '/cats/upload/lote', icon: ICONS.upload, keywords: ['lote', 'batch', 'múltiplas', 'várias', 'cats'] },
  ]
}

function matchScore(command: Command, query: string): number {
  const q = query.toLowerCase()
  const label = command.label.toLowerCase()
  const desc = (command.description ?? '').toLowerCase()
  const kw = (command.keywords ?? []).join(' ').toLowerCase()

  if (label.startsWith(q)) return 100
  if (label.includes(q)) return 80
  if (desc.includes(q)) return 60
  if (kw.includes(q)) return 40
  return 0
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const commands = buildCommands()

  const filtered = query.trim()
    ? commands
        .map((c) => ({ command: c, score: matchScore(c, query.trim()) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ command }) => command)
    : commands

  // Grupos
  const groups = Array.from(new Set(filtered.map((c) => c.group)))

  const openPalette = useCallback(() => {
    setOpen(true)
    setQuery('')
    setSelectedIdx(0)
    setTimeout(() => inputRef.current?.focus(), 10)
  }, [])

  const closePalette = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  const execute = useCallback((command: Command) => {
    closePalette()
    if (command.href) {
      router.push(command.href)
    } else if (command.action) {
      command.action()
    }
  }, [closePalette, router])

  // Keyboard shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        open ? closePalette() : openPalette()
      }
      if (!open) return
      if (e.key === 'Escape') { closePalette(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)) }
      if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = filtered[selectedIdx]
        if (cmd) execute(cmd)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, filtered, selectedIdx, openPalette, closePalette, execute])

  // Reset index when query changes
  useEffect(() => { setSelectedIdx(0) }, [query])

  if (!open) return null

  // Flat index helper
  let flatIdx = -1

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)' }}
      onClick={closePalette}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white"
        style={{ boxShadow: '0 25px 50px rgba(15,23,42,0.20), 0 0 0 1px rgba(15,23,42,0.10)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border-soft)' }}>
          <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="O que você procura?"
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          <kbd className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-400" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--canvas)' }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2 scrollbar-thin">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              Nenhum resultado para &ldquo;{query}&rdquo;
            </div>
          ) : (
            groups.map((group) => {
              const groupItems = filtered.filter((c) => c.group === group)
              return (
                <div key={group}>
                  <div className="px-4 pb-1 pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{group}</p>
                  </div>
                  {groupItems.map((command) => {
                    flatIdx++
                    const idx = flatIdx
                    const isSelected = selectedIdx === idx

                    return (
                      <button
                        key={command.id}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isSelected ? 'bg-brand-50' : 'hover:bg-slate-50'
                        }`}
                        onClick={() => execute(command)}
                        onMouseEnter={() => setSelectedIdx(idx)}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          isSelected ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {command.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium ${isSelected ? 'text-brand-900' : 'text-slate-800'}`}>
                            {command.label}
                          </p>
                          {command.description && (
                            <p className="truncate text-xs text-slate-400">{command.description}</p>
                          )}
                        </div>
                        {isSelected && (
                          <kbd className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-brand-600" style={{ border: '1px solid', borderColor: '#85c0d7', backgroundColor: '#f0f9ff' }}>
                            ↵
                          </kbd>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderTop: '1px solid var(--border-soft)', backgroundColor: 'var(--canvas)' }}
        >
          <div className="flex items-center gap-4 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <kbd className="rounded px-1 text-[9px]" style={{ border: '1px solid var(--border)' }}>↑</kbd>
              <kbd className="rounded px-1 text-[9px]" style={{ border: '1px solid var(--border)' }}>↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded px-1 text-[9px]" style={{ border: '1px solid var(--border)' }}>↵</kbd>
              abrir
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            <kbd className="rounded px-1 font-mono text-[9px]" style={{ border: '1px solid var(--border)' }}>⌘K</kbd>
            {' '}para fechar
          </span>
        </div>
      </div>
    </div>
  )
}
