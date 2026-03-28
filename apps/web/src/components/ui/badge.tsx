import { cn } from '@/lib/utils'

const variantClasses = {
  default: 'bg-slate-100 text-slate-600',
  primary: 'bg-brand-100 text-brand-700',
  success: 'bg-green-50 text-green-700',
  warning: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-700',
  processing: 'bg-brand-50 text-brand-700',
} as const

type BadgeVariant = keyof typeof variantClasses

interface BadgeProps {
  variant?: BadgeVariant
  className?: string
  children: React.ReactNode
}

export function Badge({ variant = 'default', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
