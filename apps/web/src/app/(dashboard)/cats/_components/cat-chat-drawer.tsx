'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

const QUICK_SUGGESTIONS = [
  'Temos acervo de pavimentação asfáltica acima de 5km?',
  "Quais CATs possuímos do cliente 'Ministério da Saúde'?",
  'Qual a nossa experiência com obras metálicas?',
]

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ContextCat {
  id: string
  numeroCat: string | null
  empresaContratante: string | null
}

interface CatChatDrawerProps {
  open: boolean
  onClose: () => void
  getToken: () => Promise<string | null>
}

function renderMarkdown(text: string, catMap: Map<string, string>): React.ReactNode {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''

    // List item
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const content = line.slice(2)
      nodes.push(
        <li key={i} className="ml-4 list-disc text-sm text-slate-700">
          {renderInline(content, catMap)}
        </li>,
      )
      continue
    }

    // Empty line = paragraph break
    if (line.trim() === '') {
      nodes.push(<div key={i} className="h-2" />)
      continue
    }

    // Regular paragraph
    nodes.push(
      <p key={i} className="text-sm leading-relaxed text-slate-700">
        {renderInline(line, catMap)}
      </p>,
    )
  }

  return <>{nodes}</>
}

function renderInline(text: string, catMap: Map<string, string>): React.ReactNode {
  // Match **text** for bold and CAT links
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2)
      // Detect CAT pattern like "CAT 059278/2009" or "CAT 059278"
      const catMatch = inner.match(/^CAT\s+([\w/\-.]+)/)
      if (catMatch) {
        const num = catMatch[1] ?? ''
        const catId = catMap.get(num)
        if (catId) {
          return (
            <Link
              key={idx}
              href={`/cats/${catId}`}
              className="font-bold text-[#003746] underline underline-offset-2 hover:text-[#00526a]"
            >
              CAT {num}
            </Link>
          )
        }
      }
      return <strong key={idx} className="font-semibold text-slate-900">{inner}</strong>
    }
    return <span key={idx}>{part}</span>
  })
}

export function CatChatDrawer({ open, onClose, getToken }: CatChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [cacheName, setCacheName] = useState<string | null>(null)
  const [contextCats, setContextCats] = useState<ContextCat[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Build numeroCat → id map for link rendering
  const catMap = new Map<string, string>(
    contextCats
      .filter((c) => c.numeroCat)
      .map((c) => [c.numeroCat!, c.id]),
  )

  // Reset on close
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort()
      setMessages([])
      setInput('')
      setCacheName(null)
      setContextCats([])
      setStreaming(false)
    } else {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [open])

  // Scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming) return

      const userMsg: ChatMessage = { role: 'user', content: text.trim() }
      const assistantMsg: ChatMessage = { role: 'assistant', content: '' }
      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setInput('')
      setStreaming(true)

      const history = messages.map((m) => ({ role: m.role, content: m.content }))

      try {
        const token = await getToken()
        abortRef.current = new AbortController()

        const response = await fetch(`${API_URL}/api/cats/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message: text.trim(), history, cacheName }),
          signal: abortRef.current.signal,
        })

        if (!response.ok || !response.body) {
          throw new Error(`Erro na requisição: ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let assistantContent = ''
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (!data) continue

            let payload: Record<string, unknown>
            try {
              payload = JSON.parse(data) as Record<string, unknown>
            } catch {
              continue
            }

            if (payload['type'] === 'meta') {
              setContextCats((payload['contextCats'] as ContextCat[]) ?? [])
            } else if (payload['type'] === 'cacheName') {
              setCacheName(payload['cacheName'] as string)
            } else if (payload['type'] === 'chunk') {
              assistantContent += payload['text'] as string
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: assistantContent }
                }
                return updated
              })
            } else if (payload['type'] === 'done' || payload['type'] === 'error') {
              if (payload['type'] === 'error') {
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last?.role === 'assistant' && !last.content) {
                    updated[updated.length - 1] = {
                      ...last,
                      content: 'Desculpe, ocorreu um erro ao processar sua pergunta. Tente novamente.',
                    }
                  }
                  return updated
                })
              }
              break
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant' && !last.content) {
            updated[updated.length - 1] = {
              ...last,
              content: 'Desculpe, ocorreu um erro de conexão. Tente novamente.',
            }
          }
          return updated
        })
      } finally {
        setStreaming(false)
      }
    },
    [messages, streaming, cacheName, getToken],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage(input)
    }
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-[440px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-[#003746] to-[#00526a] px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
            <span
              className="material-symbols-outlined text-[18px] text-white"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              smart_toy
            </span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Assistente de Acervo</p>
            <p className="text-[11px] text-white/70">Consulte o acervo técnico em linguagem natural</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/20 hover:text-white"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Empty state with suggestions */}
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-6 py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
                <span
                  className="material-symbols-outlined text-[32px] text-[#003746]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  chat
                </span>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">Olá! Sou seu assistente de acervo.</p>
                <p className="mt-1 text-xs text-slate-400">Pergunte sobre as CATs da empresa.</p>
              </div>

              {/* Quick suggestions */}
              <div className="flex w-full flex-col gap-2">
                {QUICK_SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => void sendMessage(s)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs text-slate-600 transition-colors hover:border-[#003746]/30 hover:bg-[#003746]/5 hover:text-[#003746]"
                  >
                    <span className="mr-2 text-slate-400">↗</span>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          <div className="flex flex-col gap-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="mr-2 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#003746]">
                    <span
                      className="material-symbols-outlined text-[12px] text-white"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      smart_toy
                    </span>
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'rounded-tr-sm bg-[#003746] text-white'
                      : 'rounded-tl-sm border border-slate-100 bg-slate-50'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="text-sm text-white">{msg.content}</p>
                  ) : msg.content ? (
                    <div className="prose-sm">{renderMarkdown(msg.content, catMap)}</div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-slate-100 bg-white p-4">
          {/* Context CATs indicator */}
          {contextCats.length > 0 && messages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {contextCats.slice(0, 3).map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 rounded-full bg-[#003746]/8 px-2 py-0.5 text-[10px] text-[#003746]"
                >
                  <span className="material-symbols-outlined text-[10px]">description</span>
                  {c.numeroCat ?? c.empresaContratante ?? 'CAT'}
                </span>
              ))}
              {contextCats.length > 3 && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                  +{contextCats.length - 3}
                </span>
              )}
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua pergunta... (Enter para enviar)"
              rows={1}
              disabled={streaming}
              className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-[#003746]/40 focus:bg-white disabled:opacity-50"
              style={{ maxHeight: '120px', overflowY: 'auto' }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`
              }}
            />
            <button
              onClick={() => void sendMessage(input)}
              disabled={streaming || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#003746] text-white transition-all hover:bg-[#00526a] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {streaming ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  send
                </span>
              )}
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-400">
            Respostas baseadas nas CATs indexadas no sistema
          </p>
        </div>
      </div>
    </>
  )
}
