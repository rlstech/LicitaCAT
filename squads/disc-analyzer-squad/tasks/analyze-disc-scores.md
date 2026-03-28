---
task: Analyze DISC Scores
responsavel: "@disc-classifier"
responsavel_type: agent
atomic_layer: task
elicit: false
Entrada: |
  - normalized_scores: Objeto com pontuações D, I, S, C (range -28 a +28)
  - metadata: Nome, data e contexto da avaliação
Saida: |
  - percentages: Percentual de cada dimensão no total positivo
  - ranked_dimensions: Dimensões ordenadas por predominância (maior → menor)
  - gap_analysis: Diferença entre 1ª e 2ª dimensão
  - profile_type: "pure" | "mixed" | "balanced"
Checklist:
  - "[ ] Normalizar pontuações para escala positiva (0-56)"
  - "[ ] Calcular percentual de cada dimensão"
  - "[ ] Ordenar dimensões por predominância"
  - "[ ] Calcular gap entre 1ª e 2ª dimensão"
  - "[ ] Determinar tipo de perfil (puro/misto/equilibrado)"
  - "[ ] Identificar dimensão primária e secundária"
---

# analyze-disc-scores

Processa as pontuações brutas DISC e prepara os dados para classificação de perfil.

## Algoritmo de Análise

### Passo 1 — Normalização (escala 0-56)

```
score_normalizado = score_bruto + 28

Exemplo:
  D_bruto = 12  → D_norm = 40
  I_bruto = 8   → I_norm = 36
  S_bruto = -4  → S_norm = 24
  C_bruto = -16 → C_norm = 12
```

### Passo 2 — Percentual por dimensão

```
total = D_norm + I_norm + S_norm + C_norm

percentual_D = (D_norm / total) * 100
percentual_I = (I_norm / total) * 100
percentual_S = (S_norm / total) * 100
percentual_C = (C_norm / total) * 100

Exemplo (total = 112):
  D = 35.7%
  I = 32.1%
  S = 21.4%
  C = 10.7%
```

### Passo 3 — Ranking de dimensões

Ordene as dimensões pelo percentual (decrescente):

```
ranked = [
  { dim: "D", label: "Dominância",   pct: 35.7, profile: "EXECUTORA"    },
  { dim: "I", label: "Influência",   pct: 32.1, profile: "COMUNICATIVA" },
  { dim: "S", label: "Estabilidade", pct: 21.4, profile: "PLANEJADORA"  },
  { dim: "C", label: "Conformidade", pct: 10.7, profile: "ANALISTA"     }
]
```

### Passo 4 — Gap analysis

```
gap_1_2 = ranked[0].pct - ranked[1].pct     # diferença 1ª e 2ª
gap_2_3 = ranked[1].pct - ranked[2].pct     # diferença 2ª e 3ª
max_gap = max(gap entre todas as dimensões)
```

### Passo 5 — Tipo de perfil

```
SE gap_1_2 >= 15 E ranked[0].pct >= 40:
  profile_type = "pure"

SE gap_1_2 < 15:
  profile_type = "mixed"

SE max_gap <= 5:
  profile_type = "balanced"
```

## Output

```json
{
  "metadata": { ... },
  "raw_scores": { "D": 12, "I": 8, "S": -4, "C": -16 },
  "normalized_scores": { "D": 40, "I": 36, "S": 24, "C": 12 },
  "percentages": { "D": 35.7, "I": 32.1, "S": 21.4, "C": 10.7 },
  "ranked_dimensions": [
    { "dim": "D", "label": "Dominância",   "pct": 35.7, "profile": "EXECUTORA"    },
    { "dim": "I", "label": "Influência",   "pct": 32.1, "profile": "COMUNICATIVA" },
    { "dim": "S", "label": "Estabilidade", "pct": 21.4, "profile": "PLANEJADORA"  },
    { "dim": "C", "label": "Conformidade", "pct": 10.7, "profile": "ANALISTA"     }
  ],
  "gap_analysis": {
    "gap_1_2": 3.6,
    "gap_2_3": 10.7,
    "max_gap": 24.9
  },
  "profile_type": "mixed",
  "primary_dimension": "D",
  "secondary_dimension": "I"
}
```
