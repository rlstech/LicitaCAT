---
task: Collect DISC Responses
responsavel: "@disc-collector"
responsavel_type: agent
atomic_layer: task
elicit: true
Entrada: |
  - person_name: Nome da pessoa avaliada (obrigatório)
  - context: Contexto profissional (opcional — ex: "processo seletivo", "desenvolvimento de carreira")
Saida: |
  - raw_responses: Array com 28 blocos de respostas (mais/menos para cada adjetivo)
  - normalized_scores: Pontuações brutas D, I, S, C antes da análise
  - metadata: Nome, data, contexto da avaliação
Checklist:
  - "[ ] Coletar nome e contexto da avaliação"
  - "[ ] Apresentar instruções do questionário"
  - "[ ] Aplicar os 28 blocos de 4 adjetivos"
  - "[ ] Registrar escolha MAIS e MENOS para cada bloco"
  - "[ ] Validar completude das respostas"
  - "[ ] Calcular pontuações brutas D, I, S, C"
  - "[ ] Exportar dados normalizados"
---

# collect-disc-responses

Coleta as respostas do questionário DISC em formato interativo.

## Fluxo

### 1. Abertura

Apresente-se e explique o processo:

```
Olá! Vou aplicar o questionário DISC para identificar seu perfil comportamental profissional.

O questionário é composto por 28 grupos de 4 adjetivos. Para cada grupo:
- Escolha o adjetivo que MAIS descreve você no ambiente profissional
- Escolha o adjetivo que MENOS descreve você no ambiente profissional

Não há respostas certas ou erradas. Responda com base em como você
realmente age no trabalho, não como gostaria de agir.

Pronto para começar?
```

### 2. Questionário — 28 blocos

Para cada bloco, apresente no formato:

```
Bloco X de 28

Qual palavra MAIS descreve você no trabalho?
Qual palavra MENOS descreve você no trabalho?

  A) {adjetivo_D}
  B) {adjetivo_I}
  C) {adjetivo_S}
  D) {adjetivo_C}

MAIS: ___   MENOS: ___
```

## Banco de Adjetivos DISC (28 blocos)

```yaml
blocos:
  - id: 1
    D: Direto
    I: Entusiasmado
    S: Leal
    C: Preciso

  - id: 2
    D: Competitivo
    I: Sociável
    S: Calmo
    C: Sistemático

  - id: 3
    D: Decidido
    I: Expressivo
    S: Paciente
    C: Cuidadoso

  - id: 4
    D: Dominante
    I: Otimista
    S: Constante
    C: Analítico

  - id: 5
    D: Ousado
    I: Persuasivo
    S: Amigável
    C: Detalhista

  - id: 6
    D: Resoluto
    I: Animado
    S: Compreensivo
    C: Lógico

  - id: 7
    D: Assertivo
    I: Comunicativo
    S: Estável
    C: Perfeccionista

  - id: 8
    D: Independente
    I: Inspirador
    S: Cooperativo
    C: Criterioso

  - id: 9
    D: Arrojado
    I: Impulsivo
    S: Moderado
    C: Objetivo

  - id: 10
    D: Exigente
    I: Espontâneo
    S: Atencioso
    C: Formal

  - id: 11
    D: Obstinado
    I: Carismático
    S: Tolerante
    C: Reservado

  - id: 12
    D: Autoritário
    I: Extrovertido
    S: Sereno
    C: Disciplinado

  - id: 13
    D: Pioneiro
    I: Alegre
    S: Pacífico
    C: Conservador

  - id: 14
    D: Comandante
    I: Influente
    S: Prestativo
    C: Rigoroso

  - id: 15
    D: Dinâmico
    I: Falante
    S: Consistente
    C: Metódico

  - id: 16
    D: Incisivo
    I: Popular
    S: Confiável
    C: Cauteloso

  - id: 17
    D: Pragmático
    I: Criativo
    S: Gentil
    C: Exato

  - id: 18
    D: Corajoso
    I: Motivador
    S: Equilibrado
    C: Prudente

  - id: 19
    D: Enérgico
    I: Espontâneo
    S: Diplomático
    C: Organizado

  - id: 20
    D: Direto
    I: Envolvente
    S: Tranquilo
    C: Minucioso

  - id: 21
    D: Ambicioso
    I: Descontraído
    S: Fiel
    C: Cético

  - id: 22
    D: Firme
    I: Aberto
    S: Dedicado
    C: Pontual

  - id: 23
    D: Controlador
    I: Expressivo
    S: Empático
    C: Meticuloso

  - id: 24
    D: Impaciente
    I: Divertido
    S: Harmonioso
    C: Introspectivo

  - id: 25
    D: Executor
    I: Relacionável
    S: Prestativo
    C: Investigador

  - id: 26
    D: Determinado
    I: Emotivo
    S: Apoiador
    C: Técnico

  - id: 27
    D: Veloz
    I: Persuasivo
    S: Reflexivo
    C: Detalhista

  - id: 28
    D: Líder
    I: Empolgante
    S: Comprometido
    C: Analítico
```

## Pontuação Bruta

Após os 28 blocos, calcule:

```
Para cada dimensão (D, I, S, C):
  pontuacao_mais  = nº de vezes escolhida como MAIS
  pontuacao_menos = nº de vezes escolhida como MENOS
  pontuacao_total = pontuacao_mais - pontuacao_menos

Range esperado: -28 a +28 por dimensão
```

## Output

```json
{
  "metadata": {
    "person_name": "Nome da Pessoa",
    "date": "YYYY-MM-DD",
    "context": "processo seletivo"
  },
  "raw_responses": [
    { "block": 1, "mais": "A", "menos": "C" },
    ...
  ],
  "normalized_scores": {
    "D": 12,
    "I": 8,
    "S": -4,
    "C": -16
  }
}
```
