---
name: LicitaCAT
description: Plataforma de análise de licitações para engenharia brasileira
colors:
  primary:           "#003746"
  primary-mid:       "#004f63"
  primary-deep:      "#002a36"
  canvas:            "#f3faff"
  surface-low:       "#e6f6ff"
  surface-container: "#dbf1fe"
  surface-high:      "#cfe6f2"
  outline:           "#70787c"
  outline-variant:   "#c0c8cc"
  success:           "#10b981"
  warning:           "#f59e0b"
  error:             "#ba1a1a"
  accent-editais:    "#7c3aed"
  accent-cats:       "#0e7490"
  accent-crossings:  "#059669"
  accent-cost:       "#64748b"
  ink:               "#0f172a"
  ink-secondary:     "#475569"
  ink-muted:         "#94a3b8"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.06em"
  metric:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs:  "4px"
  sm:  "8px"
  md:  "12px"
  lg:  "16px"
  xl:  "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    typography: "{typography.title}"
  button-primary-hover:
    backgroundColor: "{colors.primary-mid}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  metric-card:
    backgroundColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  badge-default:
    backgroundColor: "#f1f5f9"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.xs}"
    padding: "2px 8px"
  badge-success:
    backgroundColor: "#f0fdf4"
    textColor: "#15803d"
    rounded: "{rounded.xs}"
    padding: "2px 8px"
  badge-warning:
    backgroundColor: "#fffbeb"
    textColor: "#92400e"
    rounded: "{rounded.xs}"
    padding: "2px 8px"
  badge-error:
    backgroundColor: "#fff1f2"
    textColor: "#9f1239"
    rounded: "{rounded.xs}"
    padding: "2px 8px"
---

# Design System: LicitaCAT

## 1. Overview

**Creative North Star: "O Blueprint Técnico"**

O sistema visual opera como um documento de engenharia: hierarquia clara, informação densa mas legível, zero decoração sem função. Cada componente existe para transportar dados — scores de aderência, requisitos técnicos, cronogramas de licitação — não para impressionar. Onde um sistema de consumo colocaria uma ilustração, este coloca um dado. Onde outro colocaria animação de entrada, este exibe a informação imediatamente.

A paleta é construída em torno de um Petrol Profundo (`#003746`) sobre um canvas azulado quase-branco (`#f3faff`). A sensação é a de um ambiente de trabalho com iluminação neutra: sem dramatismo, sem calor artificial. O contraste entre fundo e superfície é tonal, não cromático — elevação expressa por claridade, não por sombra.

A interface rejeita explicitamente: apps coloridos de consumo (Notion, Slack), dashboards genéricos de BI (Power BI padrão com seus grids de charts), LegalTech americano formal demais, e portais governamentais desatualizados. O LicitaCAT existe precisamente para substituir aqueles portais — não pode ser confundido com eles.

**Key Characteristics:**
- Fundo ligeiramente azulado (`#f3faff`) que afasta o branco de escritório sem chamar atenção
- Elevação por claridade: canvas (`#f3faff`) → sidebar (`#e6f6ff`) → cards (`#ffffff`)
- Hierarquia de tinta em três níveis: primário (`#0f172a`), secundário (`#475569`), mudo (`#94a3b8`)
- Cor primária restrita a ações e estados ativos — nunca decorativa
- Acentos de domínio para criar territórios visuais dentro da ferramenta (editais, CATs, cruzamentos)
- Tipografia uppercase com tracking como linguagem de metadados técnicos

## 2. Colors: The Petrol Blueprint Palette

Paleta técnica construída em torno de um petrol escuro sobre azul gelado — autoridade sem frieza, profissionalismo sem esterilidade.

### Primary
- **Petrol Profundo** (`#003746`): O peso visual do sistema. CTAs primários, estado active de navegação, focus ring (`outline: 2px solid #003746`), texto de score em gauge alto. Aparece em ≤15% de qualquer tela; sua raridade é sua autoridade.
- **Petrol Médio** (`#004f63`): Hover de elementos ativos, variante de pressão. Nunca como cor de base independente.
- **Petrol Noturno** (`#002a36`): Estado pressed, texto sobre fundos brand-100.

### Secondary
- **Violeta Edital** (`#7c3aed`): Exclusivo ao domínio Editais — acento topo de MetricCard, ícones de seção. Não usar fora do contexto de editais.
- **Ciano CAT** (`#0e7490`): Exclusivo ao domínio CATs, mesma lógica.
- **Esmeralda Cruzamento** (`#059669`): Domínio de cruzamentos e recomendação "Participar".

### Tertiary
- **Âmbar Atenção** (`#f59e0b`): Estados de revisão pendente, requisitos com ressalva. Sempre acompanhado por texto — nunca usado só como indicador de cor.
- **Vermelho Crítico** (`#ba1a1a`): Erro, requisito em gap, recomendação "Não Participar". Tom Material3 — mais sério que o vermelho RGB puro.
- **Esmeralda Status** (`#10b981`): Requisito atendido, status completed, recomendação aprovada.

### Neutral
- **Canvas Glacial** (`#f3faff`): Fundo universal do app. Levemente azulado (não branco) — o ponto de partida de toda elevação.
- **Superfície Baixa** (`#e6f6ff`): Sidebar, containers de destaque, hover sutil em nav.
- **Superfície Container** (`#dbf1fe`): Containers de seção, separações de maior peso.
- **Superfície Alta** (`#cfe6f2`): Hover em itens secundários, subtil highlight.
- **Contorno** (`#70787c`): Bordas de inputs em repouso, dividers.
- **Contorno Suave** (`#c0c8cc`): Separações internas muito sutis; equivalente visual ao `rgba(15,23,42,0.06)`.
- **Tinta** (`#0f172a`): Texto primário — títulos de página, valores de métricas.
- **Tinta Secundária** (`#475569`): Corpo de texto, labels de campo.
- **Tinta Muda** (`#94a3b8`): Metadados, labels de tabela, timestamps.

### Named Rules
**A Regra da Raridade.** O Petrol Profundo (`#003746`) aparece em no máximo 15% de qualquer tela. Seu peso visual depende da escassez. Saturar a interface com ele cancela o efeito.

**A Regra dos Territórios.** Os acentos de domínio (violeta, ciano, esmeralda) são fronteiras, não decoração. Usar violeta fora do contexto de editais contamina o mapa cognitivo do usuário.

## 3. Typography

**Fonte única:** Inter (system-ui, -apple-system, sans-serif) — `antialiased`, `text-rendering: optimizeLegibility`.

**Caráter:** Inter em peso semibold e com tracking uppercase atua como tipografia técnica de instrumento — legível em tamanhos muito pequenos, autoritária em tamanhos de display. O sistema explora o espectro completo de pesos (400→700) e tamanhos (10px→28px) dentro de uma única família, criando hierarquia sem mudança de typeface.

### Hierarchy
- **Display** (semibold, 20px, lh 1.3, tracking -0.015em): Títulos de página. Uma ocorrência por tela.
- **Title** (semibold, 14px, lh 1.5): Títulos de seção, cabeçalhos de card, rótulos de campo.
- **Body** (regular, 14px, lh 1.5): Texto de tabela, descrições, conteúdo principal. Linha máxima: 65ch.
- **Label** (semibold, 11px, lh 1, tracking 0.06em, UPPERCASE): Cabeçalhos de tabela, labels de seção no rail lateral, metadados de status. Nunca em caixa mista — o uppercase é parte do significado.
- **Metric** (bold, 28px, lh 1, tracking -0.02em, tabular-nums): Valores numéricos em MetricCards e gauges. Sempre `font-variant-numeric: tabular-nums`.

### Named Rules
**A Regra do Uppercase Técnico.** Labels uppercase com tracking (`text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest`) sinalizam metainformação — não decoração. Nunca usar uppercase em texto de leitura ou CTAs.

**A Regra Tabular.** Todo número que pode mudar (scores, contagens, valores monetários) usa `font-variant-numeric: tabular-nums`. Colunas de dados não tremem ao atualizar.

## 4. Elevation

**Sistema Plano por Padrão.** O LicitaCAT não usa sombras decorativas. Hierarquia de superfície é criada inteiramente por progressão de claridade: canvas (`#f3faff`) → sidebar/seções (`#e6f6ff`) → cards (`#ffffff`). Quanto mais claro, mais elevado.

Sombra existe exclusivamente como resposta a estado interativo:

### Shadow Vocabulary
- **Card hover** (`box-shadow: 0 1px 3px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.06)`): Aparece em hover de MetricCards e links de card clicáveis. Nunca em repouso.
- **Nav item ativo** (`box-shadow: 0 1px 3px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.07)`): O item de nav ativo "flutua" sobre o canvas em `bg-white`, criando a ilusão de cartão elevado dentro do sidebar.

### Named Rules
**A Regra do Plano por Padrão.** Sombra é estado, não estilo. Uma interface com sombras permanentes não tem linguagem de elevação — tem decoração.

**A Regra da Borda Antes da Sombra.** Quando precisar de separação, usar `border: 1px solid var(--border)` (10% slate). Sombra só entra quando a borda não resolve.

## 5. Components

### Buttons
O botão primário transmite autoridade discreta — não chama atenção a si mesmo, mas está inconfundivelmente presente.

- **Shape:** Gently rounded (8px, `rounded-md`) — não agressivo, não arredondado demais.
- **Primary:** `bg-[#003746] text-white px-4 py-2 text-sm font-semibold rounded-md`. Hover: `bg-[#004f63]`. Transição: `transition-colors duration-150`.
- **Focus:** `focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#003746] focus-visible:outline-offset-2`.
- **Secondary (outline):** `border border-[var(--border)] text-[#003746] bg-transparent hover:bg-[#e6f6ff] rounded-md`. Sem fundo sólido — o primário sempre vence a hierarquia.
- **Ghost:** `text-slate-600 hover:text-[#003746] hover:bg-[#e6f6ff] rounded-md`. Para ações de baixo peso dentro de componentes.
- **Destructive:** `bg-[#ba1a1a] text-white`. Reservado exclusivamente para exclusão irreversível.

### Badges
Badges são sinalizadores semânticos, não decorativos. Forma compact, leitura instantânea.

- **Shape:** Levemente arredondado (`rounded`, 4px) — não pill, não quadrado.
- **Padding:** `px-2 py-0.5` — compacto, não sufocado.
- **Typography:** `text-xs font-medium` — não uppercase, não bold pesado.
- **Variantes:** default (slate-100/slate-600), success (green-50/green-700), warning (amber-50/amber-800), error (red-50/red-900), processing (brand-100/brand-700).
- **Regra:** toda badge tem texto além de cor. Nunca usar só a cor como diferenciador de estado.

### Cards / MetricCards
- **Shape:** Gently elevated (12px, `rounded-xl`).
- **Background:** `#ffffff` sobre canvas `#f3faff` — o contraste de claridade comunica a elevação.
- **Border:** `1px solid var(--border)` (rgba 10%). Uniforme em todos os lados — sem `border-left` colorido isolado.
- **Border-top accent (MetricCard):** `border-top: 3px solid {accentColor}` — a única exceção à regra de borda uniforme, usada para criar territórios de domínio (violeta = editais, ciano = CATs, esmeralda = cruzamentos).
- **Padding:** `p-4` (16px) padrão; `p-6` em cards de conteúdo denso.
- **Shadow:** apenas em hover (`shadow-sm`). Nunca em repouso.
- **Hover de card clicável:** `transition-shadow duration-200 hover:shadow-sm`.

### Inputs / Fields
- **Style:** `border border-[var(--border)] bg-white rounded-md px-3 py-2 text-sm`. Sem fundo tintado, sem sombra interna.
- **Focus:** `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003746] focus-visible:ring-offset-1`. Ring de petrol — consistente com o sistema de foco universal.
- **Error:** `border-[#ba1a1a]` + texto de ajuda em `text-[#ba1a1a] text-xs` abaixo do campo.
- **Disabled:** `opacity-50 cursor-not-allowed bg-slate-50`.

### Navigation
- **Sidebar:** mesma cor do canvas (`#e6f6ff`), `border-right: 1px solid var(--border-soft)`. Largura 232px. Sem sombra lateral.
- **Item default:** `text-slate-600 hover:bg-[#cfe6f2]/50 hover:text-[#003746] rounded-md px-3 py-2`.
- **Item ativo:** `bg-white text-[#003746] font-semibold translate-x-1 shadow-sm rounded-md` — o item ativo "sobe" sobre o sidebar, cartão branco pairando sobre fundo azulado. Um ponto petrol (`w-1.5 h-1.5 rounded-full bg-brand-500`) no canto direito.
- **Ícone ativo:** `text-[#004f63]` via `material-symbols-outlined`. Fill variant ativado para ícones com variação de preenchimento.
- **Transição:** `transition-all duration-200` — o `translate-x-1` anima suavemente no hover/activate.

### Score Gauge (Componente Distintivo)
O gauge é o componente de maior peso semântico do sistema — comunica o veredito do cruzamento semântico.

- **Forma:** Arco SVG de 270°, strokeLinecap round, strokeWidth 8px.
- **Track:** `#e6f6ff` a 30% de opacidade — fundo tonal, não cinza neutro.
- **Cor do progresso:** esmeralda (`#10b981`) ≥80%, âmbar (`#f59e0b`) 50-79%, vermelho (`#ba1a1a`) <50%.
- **Rótulo central:** score em `text-2xl font-extrabold` + "SCORE" em `text-[9px] uppercase tracking-widest text-slate-400`.
- **Acompanhamento:** sempre seguido de `RequisitosBar` — barra segmentada (esmeralda/âmbar/vermelho) mostrando decomposição de requisitos.

## 6. Do's and Don'ts

### Do:
- **Do** usar `border: 1px solid var(--border)` (rgba 15,23,42,0.10) como separador padrão. Borders comunicam estrutura sem adicionar peso visual.
- **Do** expressar elevação por claridade: canvas `#f3faff` → sidebar `#e6f6ff` → cards `#ffffff`. Nunca inverter.
- **Do** usar `font-variant-numeric: tabular-nums` em toda coluna de número. Scores, valores, contagens.
- **Do** usar uppercase + tracking como linguagem de metadados: cabeçalhos de tabela, labels de seção, timestamps secundários.
- **Do** acompanhar toda sinalização por cor com texto ou ícone. Badges, status dots, gauge — nunca só a cor.
- **Do** usar os acentos de domínio (violeta, ciano, esmeralda) apenas nos territórios corretos (editais, CATs, cruzamentos). Eles criam o mapa cognitivo do produto.
- **Do** animar com `transition-colors` ou `transition-shadow` em `duration-150` a `duration-200`. Nada de bounce, elastic, ou spring.

### Don't:
- **Don't** usar `border-left` colorido com mais de 1px como acento decorativo em cards ou callouts. É o padrão mais saturado do SaaS — reescrever com fundo tintado ou nada.
- **Don't** parecer app de consumo colorido (Notion, Slack colorido). Paletas vibrantes, tons casuais e microinterações expressivas contradizem o registro de ferramenta profissional.
- **Don't** fazer dashboards genéricos de BI: grids de charts iguais, Power BI default com suas tabelas sem hierarquia, painéis com 12 métricas lado a lado sem narrativa.
- **Don't** imitar LegalTech americano (Clio, LexisNexis): texto jurídico denso sem respiração, layouts formais demais, paleta azul-marinho + dourado.
- **Don't** remeter a portais gov antigos (ComprasNet, e-licitações): tabelas HTML cruas, paleta desbotada, zero hierarquia visual. O produto existe para substituir esses portais — parecer um deles é uma falha estratégica.
- **Don't** usar gradientes em texto (`background-clip: text`). Nenhuma informação é bem servida por gradiente textual.
- **Don't** usar glassmorphism decorativo. Blur e transparência não comunicam nada neste sistema.
- **Don't** usar a "hero-metric template": número grande, label pequeno, stat de suporte, acento com gradiente. Clichê de SaaS que esvazia o significado dos dados reais do produto.
- **Don't** adicionar sombras decorativas permanentes. Sombra é estado (hover, elevação ativa), não estilo de repouso.
- **Don't** misturar acentos de domínio: violeta fora do contexto de editais, ciano fora do contexto de CATs. Contamina o sistema de orientação visual.
