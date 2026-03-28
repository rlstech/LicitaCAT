'use client'

export function CommandTrigger() {
  function open() {
    const e = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
    window.dispatchEvent(e)
  }

  return (
    <button
      onClick={open}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-white/70"
      style={{ border: '1px solid var(--border-soft)' }}
    >
      <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
      </svg>
      <span className="flex-1 text-xs text-slate-400">Buscar…</span>
      <kbd className="text-[10px] text-slate-300">⌘K</kbd>
    </button>
  )
}
