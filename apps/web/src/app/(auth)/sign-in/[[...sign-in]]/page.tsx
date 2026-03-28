import { SignIn } from '@clerk/nextjs'
import { clerkAppearance } from '../../clerk-appearance'

export default function SignInPage() {
  return <SignIn appearance={clerkAppearance} afterSignInUrl="/dashboard" />
}
