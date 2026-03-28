import { z } from 'zod'

export const InviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(300),
  role: z.enum(['admin', 'analyst', 'viewer']),
})

export const UpdateUserSchema = z.object({
  role: z.enum(['admin', 'analyst', 'viewer']).optional(),
  active: z.boolean().optional(),
})

export const UserParamsSchema = z.object({
  id: z.string().uuid(),
})
