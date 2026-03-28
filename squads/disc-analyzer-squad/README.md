# disc-analyzer-squad

Squad AIOX para análise e classificação de perfis comportamentais baseados na metodologia DISC, com finalidade profissional.

## O que faz

Descobre o perfil comportamental de pessoas e as classifica como:

| Perfil | Dimensão DISC | Características |
|--------|--------------|-----------------|
| **EXECUTORA** | D — Dominância | Orientada a resultados, decisiva, líder natural |
| **COMUNICATIVA** | I — Influência | Relacional, persuasiva, entusiasta |
| **PLANEJADORA** | S — Estabilidade | Paciente, constante, processo-orientada |
| **ANALISTA** | C — Conformidade | Metódica, precisa, orientada à qualidade |
| **MISTO** | Combinação | Quando duas dimensões são próximas em predominância |

## Agentes

| Agente | Persona | Responsabilidade |
|--------|---------|-----------------|
| `@disc-collector` | Coletor | Aplicar questionário DISC (28 blocos), coletar e normalizar respostas |
| `@disc-classifier` | Classificador | Analisar pontuações, classificar perfil e gerar laudo |

## Fluxo de uso

```
1. @disc-collector *collect {nome-da-pessoa}
   └── Aplica os 28 blocos do questionário
   └── Normaliza as respostas

2. @disc-classifier *analyze {scores}
   └── Calcula percentuais D, I, S, C
   └── Determina tipo de perfil (puro/misto/equilibrado)

3. @disc-classifier *report {nome-da-pessoa}
   └── Gera laudo comportamental completo
   └── Inclui recomendações de desenvolvimento
```

## Classificação

- **Puro:** Dimensão predominante >= 40% e gap >= 15pts para a segunda
- **Misto:** Diferença entre 1ª e 2ª dimensão < 15pts → `MISTO PERFIL1/PERFIL2`
- **Equilibrado:** Todas as dimensões com diferença <= 5pts entre si

## Comandos rápidos

```bash
# Iniciar coleta interativa
@disc-collector *collect "João Silva"

# Analisar pontuações
@disc-classifier *analyze '{"D":12,"I":8,"S":-4,"C":-16}'

# Gerar laudo completo
@disc-classifier *report "João Silva"

# Comparar dois perfis
@disc-classifier *compare "João Silva" "Maria Santos"

# Mapear equipe
@disc-classifier *team-map
```
