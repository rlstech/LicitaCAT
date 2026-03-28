export const JOB_TYPE_LABELS: Record<string, string> = {
  ocr: 'OCR',
  edital_extraction: 'Extração de Edital',
  cat_extraction: 'Extração de CAT',
  crossing: 'Cruzamento',
  embedding_gen: 'Embeddings',
}

export const JOB_STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  queued:    { label: 'Aguardando',  dot: 'bg-slate-400',   text: 'text-slate-500' },
  running:   { label: 'Executando',  dot: 'bg-brand-500',   text: 'text-brand-700' },
  completed: { label: 'Concluído',   dot: 'bg-green-500',   text: 'text-green-700' },
  failed:    { label: 'Falhou',      dot: 'bg-red-500',     text: 'text-red-600' },
  retrying:  { label: 'Tentando',    dot: 'bg-amber-500',   text: 'text-amber-700' },
}
