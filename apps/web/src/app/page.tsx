import { redirect } from 'next/navigation'

// O middleware já cuida do redirect para /sign-in se não houver sessão.
// Esta página apenas redireciona usuários autenticados para /dashboard.
export default function HomePage() {
  redirect('/dashboard')
}
