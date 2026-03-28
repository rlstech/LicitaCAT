import { SignUp } from '@clerk/nextjs'
import { clerkAppearance } from '../../clerk-appearance'

export default function SignUpPage() {
  return <SignUp appearance={clerkAppearance} afterSignUpUrl="/dashboard" />
}
