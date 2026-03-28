import type { SignIn } from '@clerk/nextjs'
import type { ComponentProps } from 'react'

type ClerkAppearance = NonNullable<ComponentProps<typeof SignIn>['appearance']>

export const clerkAppearance: ClerkAppearance = {
  variables: {
    colorPrimary: '#003746',
    colorText: '#002a36',
    colorTextSecondary: '#70787c',
    colorBackground: '#ffffff',
    colorInputBackground: '#ffffff',
    colorInputText: '#002a36',
    borderRadius: '0.5rem',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontSize: '0.875rem',
  },
  elements: {
    card: 'shadow-none border border-[rgba(15,23,42,0.10)] rounded-2xl',
    formButtonPrimary:
      'bg-[#003746] hover:bg-[#002a36] text-white rounded-lg text-sm font-semibold shadow-none transition-colors',
    formFieldInput:
      'rounded-lg border-[#c0c8cc] text-sm focus:border-[#003746] focus:ring-1 focus:ring-[#003746]',
    footerActionLink: 'text-[#003746] hover:text-[#002a36] font-medium',
    headerTitle: 'text-[#002a36] font-bold text-lg',
    headerSubtitle: 'text-[#70787c] text-sm',
    socialButtonsBlockButton:
      'border-[#c0c8cc] hover:bg-[#f3faff] rounded-lg text-sm transition-colors',
    dividerLine: 'bg-[rgba(15,23,42,0.10)]',
    dividerText: 'text-[#70787c] text-xs',
    formFieldLabel: 'text-[#002a36] text-sm font-medium',
    identityPreviewEditButton: 'text-[#003746]',
    formResendCodeLink: 'text-[#003746]',
    otpCodeFieldInput: 'border-[#c0c8cc] focus:border-[#003746]',
    footer: 'text-sm',
  },
}
