export type TenantPlan = 'starter' | 'professional' | 'enterprise'

export type UserRole = 'admin' | 'analyst' | 'viewer'

export interface Tenant {
  id: string
  name: string
  slug: string
  plan: TenantPlan
  maxEditaisPerMonth: number
  maxCatsStored: number
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export interface User {
  id: string
  tenantId: string
  email: string
  name: string
  role: UserRole
  authProviderId: string | null
  active: boolean
  createdAt: Date
  updatedAt: Date
}
