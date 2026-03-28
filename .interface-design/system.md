# LicitaCAT — Interface Design System

## Product & User
**Product:** SaaS de análise de licitações públicas para empresas de engenharia brasileiras.
**User:** Analistas e engenheiros que tomam decisões técnicas sobre participação em licitações.
**Context:** Desktop, horário de trabalho, ambiente de decisão profissional.

---

## Direction & Feel
Denso mas legível. Confiável como um sistema jurídico-técnico. Sem frivolidade. Preciso como um blueprint de engenharia.

**Não é:** app de consumo, landing page, produto friendly.
**É:** ferramenta de trabalho profissional, similar a Vercel Dashboard ou Linear.

---

## Depth Strategy
**Borders-only.** Sem drop-shadows decorativas. Hierarquia por cor de superfície + borda.

- Superfícies mais claras = mais elevadas (canvas → white cards)
- `shadow-sm` apenas em hover de cards clicáveis (sutil, funcional)
- Nenhuma sombra decorativa estática

---

## Color Tokens (CSS Variables)

```css
--canvas:         #f1f5f9;  /* slate-100 — fundo geral */
--surface:        #ffffff;  /* cards, painéis elevados */

/* Borders */
--border-soft:    rgba(15, 23, 42, 0.06);  /* separações internas */
--border:         rgba(15, 23, 42, 0.10);  /* bordas de componentes */
--border-strong:  rgba(15, 23, 42, 0.18);  /* ênfase, focus rings */
```

---

## Brand Color
Violet/Purple — `brand-600: #7c3aed` — identidade do produto. Não alterar.

Usar com intenção:
- CTAs primários: `bg-brand-600 hover:bg-brand-700`
- Active state nav: `text-brand-700`, ícone `text-brand-600`
- Accent em MetricCards: `borderTop: 3px solid {accentColor}`

---

## Surfaces & Layout

### Sidebar
- **Mesma cor do canvas** (`var(--canvas)`) — não branco separado
- Border-right: `var(--border)` — separação clara mas não harsh
- Sem sombra lateral
- Width: `232px`

### Right Rail
- Mesma cor do canvas, border-left
- Width: `252px`, hidden abaixo de `xl:`

### Main Content
- Canvas como fundo, cards em `bg-white`
- Padding: `p-6 lg:p-8`

---

## Typography

**Fonte:** Inter (system-ui fallback) | `-webkit-font-smoothing: antialiased`

| Role | Classe |
|------|--------|
| Page title | `text-xl font-semibold tracking-tight text-slate-900` |
| Section label (rail) | `text-[10px] font-semibold uppercase tracking-widest text-slate-400` |
| Table header | `text-[11px] font-semibold uppercase tracking-wider text-slate-400` |
| Body | `text-sm text-slate-600` |
| Secondary | `text-xs text-slate-500` |
| Muted | `text-xs text-slate-400` |
| Metric value | `text-[28px] font-bold tracking-tight text-slate-900` |

---

## Spacing
Base unit: 4px (Tailwind default). Escala: 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8

---

## Border Radius
- Badges pequenos: `rounded-full`
- Inputs, botões compactos: `rounded-md` (6px)
- Botões padrão: `rounded-lg` (8px)
- Cards, painéis: `rounded-xl` (12px)
- Modais: `rounded-2xl` (16px)

---

## Navigation — Signature: Active State "Card Elevado"
Item ativo flutua sobre o canvas — cartão branco elevado sobre fundo slate.

```tsx
// Active link
className="bg-white font-semibold text-slate-900"
style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.07)' }}

// Dot indicator no active
<span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />

// Ícone active
<span className="text-brand-600">{icon}</span>

// Hover (não active)
className="hover:bg-white/70 hover:text-slate-800"
```

**Itens de navegação:** apenas 4 (Dashboard, Editais, Acervo CATs, Cruzamentos).
**Removido:** "Ações rápidas" do sidebar — redundante com right rail.

---

## MetricCard Pattern
```tsx
<Link
  className="group flex flex-col rounded-xl bg-white p-4 transition-all hover:shadow-sm"
  style={{ border: '1px solid var(--border)', borderTop: `3px solid ${accentColor}` }}
>
  {/* Header: title (xs) + icon */}
  {/* Value: text-[28px] font-bold */}
  {/* Sub: text-xs text-slate-400 */}
  {/* Badge opcional: pipeline status */}
</Link>
```

**Accent colors por domínio:**
- Editais: `#7c3aed` | CATs: `#0e7490` | Cruzamentos: `#059669` | Custo: `#64748b`

---

## Status Badges
`rounded-full px-2.5 py-1 text-[11px] font-semibold {bg} {text}`

| Estado | bg | text |
|--------|-------|------|
| ready/completed | `bg-green-50` | `text-green-700` |
| processing/extracting | `bg-brand-50` | `text-brand-700` |
| review_pending | `bg-amber-50` | `text-amber-700` |
| error | `bg-red-50` | `text-red-600` |
| uploaded/queued | `bg-slate-100` | `text-slate-600` |

---

## Tables
- Header bg: `var(--canvas)`, border-bottom: `var(--border)`
- Row separator: `border-top: var(--border-soft)` (ultra-sutil)
- Row hover: `bg-slate-50/60`
- Actions: sempre visíveis (não esconder no group-hover)
- Pagination: canvas bg + border-top soft

---

## Empty States
1. Ícone em container `rounded-xl bg-{domain}-50` com cor do domínio
2. Título `text-sm font-semibold text-slate-700`
3. Sub `text-xs text-slate-400`
4. CTAs: primário brand + secundário border-only
5. Onboarding: Steps numerados, círculos `bg-brand-100 text-brand-700`

---

## Score Arc (Cruzamentos)
- SVG inline, `size=64`
- Track colorido (tonalidade do score, não cinza neutro)
- Stroke: `4.5px`, strokeLinecap: round
- Cores: verde ≥80, âmbar 50-79, vermelho <50
- Acompanhado por stacked bar de requisitos (verde/âmbar/vermelho)

---

## Right Rail — Estrutura Final
1. **Ação principal:** "Novo Edital" (brand-600 full-width) + "Nova CAT" (border)
2. **Pendências:** amber border-left-3px, badge contagem
3. **Próximos Prazos:** dot colorido + badge de dias críticos (≤7d)
4. **Atividade Recente:** dot status + label + relative time compacto

Seção "Ver Cruzamentos" removida — redundante com nav.
