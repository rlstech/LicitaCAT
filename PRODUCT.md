# Product

## Register

product

## Users

Analistas e engenheiros de empresas brasileiras de engenharia que participam de licitações públicas (editais). Usuários técnicos com formação especializada que tomam decisões de alto impacto financeiro: se a empresa vai ou não disputar uma licitação, com quais CATs, com que risco.

**Contexto de uso:** Desktop, horário comercial, ambiente de trabalho profissional. A tarefa é séria e consequente: uma decisão errada pode custar contratos ou prejudicar a reputação técnica da empresa.

## Product Purpose

LicitaCAT automatiza o processo mais lento e crítico do ciclo de licitações: cruzar os requisitos técnicos exigidos por um edital com o acervo de CATs (Certidões de Acervo Técnico) da empresa. O produto usa IA para extrair requisitos de editais (PDFs de 100+ páginas), estruturar o acervo de CATs, e gerar um score de aderência com recomendação de participação.

Sucesso = o analista passa de horas de leitura manual para minutos de revisão, com confiança suficiente para decidir.

## Brand Personality

Preciso, confiável, eficiente.

Voz: direta e técnica, sem didatismo. Não explica o que o usuário já sabe. Prefere números e fatos a adjetivos. Não celebra tarefas triviais.

Tom emocional: segurança e controle. O produto deve transmitir que a decisão está fundamentada em dados sólidos, não em aproximações.

## Anti-references

- **Apps coloridos de consumo** (Notion, Slack colorido): paletas vibrantes, tom casual, microinterações expressivas. O LicitaCAT não é uma ferramenta de colaboração pessoal.
- **Dashboards genéricos de BI** (Power BI padrão, Tableau público): gráficos excessivos, visual corporativo sem personalidade, grids de charts sem hierarquia clara.
- **LegalTech americano** (Clio, LexisNexis): pesado, sobregregado de texto jurídico, visual formal demais para o contexto de engenharia brasileira.
- **Portais gov antigos** (ComprasNet, e-licitações): tabelas cruas, paleta desbotada, arquitetura de informação dos anos 2000. O produto resolve a dor causada por esses portais; não pode se parecer com eles.

## Design Principles

1. **Densidade com respiração.** Ferramentas profissionais exibem muita informação. A solução não é esvaziar, é hierarquizar. Cada tela deve suportar leitura densa sem parecer congestionada.
2. **Confiança pelos dados, não pelo estilo.** Scores, porcentagens, datas e referências a páginas do edital são os protagonistas. O design serve os dados, não compete com eles.
3. **Decisão visível.** Toda tela central deve responder uma pergunta. Cruzamento: "devo participar?". Edital: "quais requisitos ainda precisam de revisão?". CAT: "esta certidão está completa e válida?".
4. **Ação sem ruído.** CTAs claros, um por contexto. Sem opções redundantes, sem confirmações desnecessárias para ações reversíveis.
5. **Ferramenta, não produto.** O usuário não deve sentir que está "usando o LicitaCAT". Deve sentir que está analisando um edital, mais rápido.

## Accessibility & Inclusion

WCAG 2.1 AA. Foco visível em todos os elementos interativos (já implementado: `outline: 2px solid #003746`). Contraste mínimo 4.5:1 para texto. Navegação por teclado em tabelas e formulários. Nenhuma informação transmitida exclusivamente por cor (badges sempre têm texto, scores têm rótulo textual).
