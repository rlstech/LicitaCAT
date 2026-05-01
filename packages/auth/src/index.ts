import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { Resend } from 'resend'
import { db } from '@licitacat/db'
import * as schema from '@licitacat/db/schema'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.baUser,
      session: schema.baSession,
      account: schema.baAccount,
      verification: schema.baVerification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }: { user: { email: string; name: string }; url: string }) => {
      const resend = new Resend(process.env['RESEND_API_KEY'])
      await resend.emails.send({
        from: process.env['RESEND_FROM_EMAIL'] ?? 'LicitaCAT <noreply@licitacat.railton.eu.org>',
        to: user.email,
        subject: 'Redefinição de senha — LicitaCAT',
        html: buildResetPasswordEmail({ name: user.name, url }),
      })
    },
    resetPasswordTokenExpiresIn: 3600,
  },
  secret: process.env['BETTER_AUTH_SECRET'] ?? 'build-placeholder',
  baseURL: process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000',
  trustedOrigins: [
    'https://licitacat.railton.eu.org',
    'https://api.licitacat.railton.eu.org',
    'http://localhost:3000',
    'http://localhost:3001',
  ],
})

export type Auth = typeof auth

function buildResetPasswordEmail({ name, url }: { name: string; url: string }): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="font-family:Inter,system-ui,sans-serif;background:#f3faff;margin:0;padding:40px 0;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="margin-bottom:32px;"><span style="font-size:20px;font-weight:700;color:#003746;">LicitaCAT</span></div>
    <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 12px;">Redefinição de senha</h1>
    <p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 24px;">
      Olá${name ? `, ${name}` : ''}! Recebemos uma solicitação para redefinir a senha da sua conta no LicitaCAT.
    </p>
    <a href="${url}" style="display:inline-block;background:#003746;color:#fff;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;margin-bottom:24px;">
      Redefinir minha senha
    </a>
    <p style="font-size:13px;color:#94a3b8;">Este link expira em <strong>1 hora</strong>. Se não solicitou, ignore este e-mail.</p>
    <p style="font-size:12px;color:#cbd5e1;word-break:break-all;">${url}</p>
  </div>
</body>
</html>`
}
