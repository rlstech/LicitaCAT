export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Branding panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-brand-600 p-12 text-white">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <span
                className="material-symbols-outlined text-[24px] text-white"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                architecture
              </span>
            </div>
            <span className="text-xl font-bold tracking-tight">LicitaCAT</span>
          </div>

          {/* Hero text */}
          <div className="mt-16 max-w-md">
            <h1 className="text-3xl font-bold leading-tight">
              Qualificação técnica para licitações com inteligência artificial
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/70">
              Extraia requisitos de editais, gerencie seu acervo de CATs e descubra automaticamente quais licitações sua empresa pode vencer.
            </p>
          </div>

          {/* Features */}
          <div className="mt-12 space-y-4">
            {[
              { icon: 'description', text: 'Extração automática de requisitos de editais' },
              { icon: 'verified', text: 'Gestão inteligente de CATs e profissionais' },
              { icon: 'compare_arrows', text: 'Cruzamento semântico com score de aderência' },
            ].map((item) => (
              <div key={item.icon} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <span className="material-symbols-outlined text-[18px] text-white/80">
                    {item.icon}
                  </span>
                </div>
                <span className="text-sm text-white/80">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-white/40">
          © {new Date().getFullYear()} LicitaCAT · Engenharia & Licitações
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[var(--canvas)] px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <span
              className="material-symbols-outlined text-[22px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              architecture
            </span>
          </div>
          <span className="text-lg font-bold tracking-tight text-brand-700">LicitaCAT</span>
        </div>

        {children}
      </div>
    </div>
  )
}
