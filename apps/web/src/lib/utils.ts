import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date))
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(date))
}

export const STATUS_LABELS: Record<string, string> = {
  uploaded: 'Enviado',
  ocr_processing: 'OCR em andamento',
  extracting: 'Extraindo',
  review_pending: 'Aguardando revisão',
  ready: 'Pronto',
  error: 'Erro',
  pending: 'Pendente',
  processing: 'Processando',
  completed: 'Concluído',
  queued: 'Na fila',
}

export const RECOMENDACAO_LABELS: Record<string, string> = {
  participar: 'Participar',
  participar_com_ressalvas: 'Participar com ressalvas',
  nao_participar: 'Não participar',
}

export const RESULTADO_LABELS: Record<string, string> = {
  atendido: 'Atendido',
  atendido_parcialmente: 'Atendido parcialmente',
  gap: 'Gap',
}
