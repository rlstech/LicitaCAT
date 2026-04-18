import type { RecConfig } from './types'

export const REC_CONFIG: Record<string, RecConfig> = {
  participar: {
    label: 'Participar',
    description: 'Os requisitos técnicos estão cobertos pelo acervo.',
    accentColor: '#10b981',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    icon: 'check_circle',
  },
  participar_com_ressalvas: {
    label: 'Participar com Ressalvas',
    description: 'Há lacunas que devem ser avaliadas antes de participar.',
    accentColor: '#f59e0b',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    icon: 'warning',
  },
  nao_participar: {
    label: 'Não Participar',
    description: 'O acervo não atende os requisitos técnicos exigidos.',
    accentColor: '#dc2626',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-700',
    icon: 'cancel',
  },
}

export const RESULTADO_CONFIG: Record<string, {
  label: string
  icon: string
  color: string
  badgeBg: string
  badgeText: string
}> = {
  atendido: {
    label: 'Atendido',
    icon: 'check_circle',
    color: '#10b981',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
  },
  atendido_parcialmente: {
    label: 'Pendente',
    icon: 'pending',
    color: '#f59e0b',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
  },
  gap: {
    label: 'Gap',
    icon: 'cancel',
    color: '#dc2626',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-600',
  },
}
