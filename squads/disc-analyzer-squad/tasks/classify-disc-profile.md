---
task: Classify DISC Profile
responsavel: "@disc-classifier"
responsavel_type: agent
atomic_layer: task
elicit: false
Entrada: |
  - analysis_result: Output completo da task analyze-disc-scores
Saida: |
  - classification: Label do perfil (ex: "EXECUTORA", "MISTO EXECUTORA/COMUNICATIVA")
  - profile_card: Card completo com características, pontos fortes e de atenção
  - recommendations: Sugestões de desenvolvimento e fit profissional
Checklist:
  - "[ ] Determinar classificação final (puro/misto/equilibrado)"
  - "[ ] Gerar label descritivo do perfil"
  - "[ ] Compor card de características"
  - "[ ] Listar pontos fortes relevantes"
  - "[ ] Listar pontos de atenção"
  - "[ ] Gerar recomendações de desenvolvimento"
  - "[ ] Indicar fit profissional (tipos de função/ambiente)"
  - "[ ] Formatar laudo final"
---

# classify-disc-profile

Classifica o perfil DISC e gera o laudo comportamental profissional completo.

## Lógica de Classificação

### Perfil PURO

**Critério:** `profile_type == "pure"`

```
Label: "{PERFIL_PRIMÁRIO}"

Exemplo:
  primary = D → "EXECUTORA"
  primary = I → "COMUNICATIVA"
  primary = S → "PLANEJADORA"
  primary = C → "ANALISTA"
```

### Perfil MISTO

**Critério:** `profile_type == "mixed"`

```
Label: "MISTO {PERFIL_PRIMÁRIO}/{PERFIL_SECUNDÁRIO}"

Exemplo:
  primary = D, secondary = I → "MISTO EXECUTORA/COMUNICATIVA"
  primary = I, secondary = C → "MISTO COMUNICATIVA/ANALISTA"
  primary = S, secondary = D → "MISTO PLANEJADORA/EXECUTORA"
```

### Perfil EQUILIBRADO

**Critério:** `profile_type == "balanced"`

```
Label: "EQUILIBRADO"
Nota: "Apresenta características de todos os perfis de forma bastante distribuída"
```

## Biblioteca de Perfis

### EXECUTORA (D — Dominância)
```yaml
caracteristicas:
  - Orientada a resultados, desafios e conquistas
  - Decisiva, direta e objetiva na comunicação
  - Natural em posições de liderança e autoridade
  - Alta energia e foco em metas mensuráveis
  - Gosta de autonomia e ambientes de alta performance

pontos_fortes:
  - Capacidade de tomada de decisão rápida
  - Resistência sob pressão
  - Visão de resultados de longo prazo
  - Coragem para assumir riscos calculados
  - Execução e entrega consistente

pontos_de_atencao:
  - Pode ser percebida como impaciente ou autoritária
  - Dificuldade em delegar e confiar no processo alheio
  - Tende a minimizar aspectos relacionais
  - Pode tomar decisões sem ouvir todas as partes

fit_profissional:
  ambientes: ["alta performance", "metas agressivas", "startup", "vendas", "gestão"]
  funcoes: ["liderança", "comercial", "gestão de projetos", "empreendedorismo"]
  trabalha_bem_com: ["PLANEJADORA (execução)", "ANALISTA (qualidade)"]
```

### COMUNICATIVA (I — Influência)
```yaml
caracteristicas:
  - Entusiasta, otimista e altamente relacional
  - Excelente em motivar, engajar e inspirar pessoas
  - Criativa, espontânea e adaptável
  - Comunicação natural e persuasiva
  - Gosta de ambientes colaborativos e dinâmicos

pontos_fortes:
  - Capacidade de construir relacionamentos rapidamente
  - Habilidade de apresentação e comunicação pública
  - Motivação da equipe em momentos difíceis
  - Criatividade na solução de problemas
  - Alta resiliência emocional

pontos_de_atencao:
  - Pode ter dificuldade com tarefas repetitivas e detalhadas
  - Tendência a evitar conflitos necessários
  - Pode prometer mais do que consegue entregar
  - Dificuldade em manter foco por longos períodos

fit_profissional:
  ambientes: ["colaborativo", "criativo", "relacional", "inovação"]
  funcoes: ["marketing", "RH", "vendas consultivas", "treinamento", "comunicação"]
  trabalha_bem_com: ["ANALISTA (estrutura)", "PLANEJADORA (processo)"]
```

### PLANEJADORA (S — Estabilidade)
```yaml
caracteristicas:
  - Paciente, constante e altamente confiável
  - Excelente em manter processos, rotinas e harmonia
  - Profunda lealdade à equipe e à organização
  - Boa ouvinte e mediadora natural de conflitos
  - Prefere ambientes previsíveis e estruturados

pontos_fortes:
  - Consistência e confiabilidade nas entregas
  - Habilidade de escuta ativa e empatia
  - Construção de relacionamentos duradouros
  - Manutenção de processos e padrões de qualidade
  - Estabilidade emocional em momentos de crise

pontos_de_atencao:
  - Resistência a mudanças bruscas ou inesperadas
  - Pode ter dificuldade em tomar decisões sob pressão
  - Tende a evitar confrontos mesmo quando necessário
  - Pode acumular insatisfações sem expressá-las

fit_profissional:
  ambientes: ["estruturado", "processos claros", "equipe coesa", "longo prazo"]
  funcoes: ["operações", "suporte", "atendimento", "gestão de processos", "financeiro"]
  trabalha_bem_com: ["EXECUTORA (direção)", "COMUNICATIVA (energia)"]
```

### ANALISTA (C — Conformidade)
```yaml
caracteristicas:
  - Metódica, precisa e orientada à qualidade
  - Excelente análise crítica e atenção a detalhes
  - Segue normas, processos e padrões com rigor
  - Tomada de decisão baseada em dados e evidências
  - Prefere ambientes estruturados com regras claras

pontos_fortes:
  - Capacidade analítica e investigativa superior
  - Produção de trabalho de alta qualidade e precisão
  - Identificação de riscos e inconsistências
  - Conhecimento técnico profundo em sua área
  - Planejamento detalhado e pensamento sistemático

pontos_de_atencao:
  - Pode ser excessivamente perfeccionista
  - Dificuldade em tomar decisões com informação incompleta
  - Pode ser percebida como fria ou distante
  - Tendência à análise paralisante (paralysis by analysis)

fit_profissional:
  ambientes: ["técnico", "alta qualidade", "dados", "compliance", "pesquisa"]
  funcoes: ["tecnologia", "finanças", "qualidade", "jurídico", "ciência de dados"]
  trabalha_bem_com: ["COMUNICATIVA (relações)", "EXECUTORA (velocidade)"]
```

## Formato do Laudo

```
═══════════════════════════════════════════════════════
                    PERFIL DISC — LAUDO COMPORTAMENTAL
═══════════════════════════════════════════════════════
Avaliado(a): {nome}
Data:        {data}
Contexto:    {contexto}
───────────────────────────────────────────────────────

📊 PONTUAÇÕES
  Dominância  (D): ████████████░░░░  {pct_D}%
  Influência  (I): ██████████░░░░░░  {pct_I}%
  Estabilidade(S): ███████░░░░░░░░░  {pct_S}%
  Conformidade(C): ███░░░░░░░░░░░░░  {pct_C}%

🎯 CLASSIFICAÇÃO: {LABEL DO PERFIL}

📋 CARACTERÍSTICAS PRINCIPAIS
  {lista de características do(s) perfil(s)}

✅ PONTOS FORTES
  {lista de pontos fortes}

⚠️  PONTOS DE ATENÇÃO
  {lista de pontos de atenção}

💼 FIT PROFISSIONAL
  Ambientes ideais: {ambientes}
  Funções sugeridas: {funções}
  Complementa bem com: {perfis complementares}

📈 RECOMENDAÇÕES DE DESENVOLVIMENTO
  {recomendações personalizadas baseadas no perfil}

═══════════════════════════════════════════════════════
```

## Recomendações por Perfil

```yaml
EXECUTORA:
  - Desenvolver escuta ativa e paciência com o processo
  - Praticar delegação genuína com acompanhamento
  - Investir em inteligência emocional e empatia
  - Aprender a valorizar contribuições do time

COMUNICATIVA:
  - Desenvolver disciplina e organização pessoal
  - Praticar follow-through nas entregas assumidas
  - Aprender a ter conversas difíceis de forma assertiva
  - Investir em gestão do tempo e priorização

PLANEJADORA:
  - Desenvolver resiliência e abertura a mudanças
  - Praticar assertividade e expressão de opiniões
  - Aprender a tomar decisões com informação parcial
  - Investir em adaptabilidade e flexibilidade

ANALISTA:
  - Desenvolver habilidades de comunicação interpessoal
  - Praticar tomada de decisão com dados suficientes (não perfeitos)
  - Aprender a delegar e confiar em outros
  - Investir em velocidade de execução e pragmatismo
```
