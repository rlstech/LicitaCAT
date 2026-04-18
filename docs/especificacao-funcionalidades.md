# LicitaCAT — Especificação de Funcionalidades

> **Versão:** 1.0  
> **Data:** 2026-04-08  
> **Audiência:** Product, Design, QA, Stakeholders

---

## Sumário

1. [Dashboard](#1-dashboard)
2. [Módulo de Editais](#2-módulo-de-editais)
   - 2.1 Listagem de Editais
   - 2.2 Upload de Edital (Individual)
   - 2.3 Upload de Editais em Lote
   - 2.4 Busca e Importação via PNCP
   - 2.5 Revisão de Edital
3. [Módulo de CATs](#3-módulo-de-cats)
   - 3.1 Listagem de CATs e Busca Semântica
   - 3.2 Cadastro de Profissionais Técnicos
   - 3.3 Upload de CAT (Individual)
   - 3.4 Upload de CATs em Lote
   - 3.5 Revisão de CAT
   - 3.6 Chat IA sobre o Acervo
4. [Módulo de Cruzamentos](#4-módulo-de-cruzamentos)
   - 4.1 Listagem de Cruzamentos
   - 4.2 Execução de Cruzamento
   - 4.3 Detalhamento do Cruzamento
   - 4.4 Override Manual de Resultados
   - 4.5 Exportação de Relatório
5. [Configurações](#5-configurações)
   - 5.1 Gestão de Usuários
   - 5.2 Monitoramento PNCP
6. [Funcionalidades Transversais](#6-funcionalidades-transversais)
   - 6.1 Autenticação
   - 6.2 Controle de Acesso por Papel
   - 6.3 Processamento Assíncrono e Status de Jobs
   - 6.4 Gerenciamento de Embeddings

---

## 1. Dashboard

### Propósito
Visão executiva do estado atual do sistema: quantos editais estão sendo processados, quantas CATs estão cadastradas, quais cruzamentos foram feitos e qual a média de aderência do acervo.

---

### F-01 — KPIs do Sistema

**Descrição:** Quatro cards no topo exibem os indicadores mais importantes em tempo real.

| KPI | O que mostra |
|-----|-------------|
| Editais em Análise | Total de editais cadastrados + badge com quantidade em processamento ativo |
| CATs Cadastradas | Total acumulado de CATs no acervo |
| Cruzamentos Realizados | Total do mês corrente |
| Média de Aderência | Score médio (0–100) dos cruzamentos concluídos |

**Comportamento:**
- Dados atualizados automaticamente a cada 10 segundos.
- O badge de "em processamento" pisca quando há jobs ativos.
- Valores monetários exibidos em notação curta (ex: R$ 2,4M).

---

### F-02 — Editais Prontos para Revisão

**Descrição:** Lista dos editais que foram processados pela IA e aguardam revisão humana antes de serem liberados para cruzamento.

**Dados exibidos por item:**
- Número e objeto do edital
- Modalidade (badge)
- Data relativa de processamento
- Score de confiança da extração IA
- Nível de urgência (Alta / Média / Baixa) baseado na data de abertura

**Ações:**
- Clicar em qualquer item navega diretamente para a página de revisão do edital.
- Botão "Ver todos" navega para a listagem completa de editais.

---

### F-03 — Atividade Recente

**Descrição:** Timeline com as 5 últimas atividades do sistema no tenant.

**Dados exibidos:**
- Ícone colorido por tipo de ação (OCR, extração, cruzamento, embeddings)
- Título e descrição resumida da ação
- Tempo relativo (ex: "há 3 minutos")

---

### F-04 — Próximas Aberturas

**Descrição:** Editais com datas de abertura de proposta iminentes.

**Dados exibidos por item:**
- Mês e dia em destaque visual
- Título e horário de abertura
- Valor estimado

**Ação:** Botão "Ver calendário completo" navega para a listagem de editais.

---

### F-05 — Acesso Rápido a Cruzamentos

**Descrição:** Botão de ação principal no dashboard para iniciar análise de match técnico, navegando diretamente para o módulo de cruzamentos.

---

## 2. Módulo de Editais

### 2.1 Listagem de Editais

### F-06 — Tabela de Editais com Filtros

**Descrição:** Listagem paginada de todos os editais do tenant com ações contextuais por status.

**Dados exibidos:**
| Coluna | Descrição |
|--------|-----------|
| Edital | Número do edital + objeto resumido |
| Órgão Licitante | Nome do órgão responsável |
| Status | Badge colorida com indicador animado se em processamento |
| Valor Estimado | Valor em BRL |
| Data Abertura | Data da abertura das propostas |
| Ações | Botões contextuais (ver abaixo) |

**Filtros disponíveis:** Dropdown de status (Todos, Na fila, OCR em andamento, Extraindo, Aguardando Revisão, Pronto, Erro).

**Ações por status:**

| Status | Ações disponíveis |
|--------|------------------|
| Na fila / Extraindo | Deletar |
| Erro | Reprocessar, Deletar |
| Aguardando Revisão | Revisar, Deletar |
| Pronto | Ver detalhes, Ver requisitos, Deletar |
| Processando | Nenhuma (ícone de carregamento) |

**Paginação:** 20 registros por página com controles Anterior / Próximo / Números.

---

### F-07 — Acesso Rápido por Drag-and-Drop

**Descrição:** Zona de arrastar e soltar na parte inferior da listagem permite iniciar um upload sem navegar para a página dedicada.

---

### 2.2 Upload de Edital (Individual)

### F-08 — Upload de PDF por Drag-and-Drop ou Clique

**Descrição:** Página dedicada para envio de um único edital em PDF.

**Fluxo do usuário:**
1. Arrasta o arquivo para a zona ou clica em "Escolher arquivo".
2. Sistema valida: aceita apenas PDF, máximo 50 MB.
3. Exibe nome do arquivo, tamanho e botão para remover.
4. Clica em "Enviar para processamento".
5. Barra de progresso exibe andamento do upload.
6. Ao concluir, exibe checkmark e redireciona automaticamente para a listagem.

**Validações:**
- Tipo de arquivo: somente PDF.
- Tamanho máximo: 50 MB.

**Informação contextual:** Painel lateral explica o que acontece após o envio (OCR → Extração IA → Revisão → Cruzamento).

---

### 2.3 Upload de Editais em Lote

### F-09 — Upload de Múltiplos PDFs Simultaneamente

**Descrição:** Página dedicada para envio de múltiplos editais em uma única sessão.

**Fluxo do usuário:**
1. Adiciona múltiplos arquivos (drag-and-drop ou seleção).
2. Fila exibe cada arquivo com status, tamanho e barra de progresso individual.
3. Clica em "Enviar X edital(is)".
4. Upload ocorre em paralelo com progresso individual.
5. Ao final: contador de concluídos (verde) e com erro (vermelho).
6. Botão "Tentar novamente" aparece para arquivos com erro.

**Dados exibidos na fila:**
- Ícone de status (pendente / enviando / concluído / erro)
- Nome e tamanho do arquivo
- Barra de progresso (quando enviando)
- Mensagem de erro detalhada (quando falhou)

**Ações após conclusão:** "Ver editais" (navega para listagem) ou "Enviar mais" (limpa fila).

---

### 2.4 Busca e Importação via PNCP

### F-10 — Busca Avançada no Portal Nacional de Contratações Públicas

**Descrição:** Interface para consultar contratações públicas diretamente no PNCP sem sair do sistema.

**Filtros de busca organizados em abas:**

| Aba | Filtros |
|-----|---------|
| Dados | Busca livre, objeto |
| Órgão | Esfera (Federal/Estadual/Municipal), Poder, UF, fonte orçamentária |
| Datas | Data início e fim de publicação |
| Itens | Tipo de item, segmentos de engenharia |
| Arquivos | Tipo de instrumento (Edital, Aviso, etc.) |

**Filtros rápidos:** Status da compra (Aberta / Em Julgamento / Encerrada / Todos), tipo de data (Publicação / Proposta).

---

### F-11 — Resultados da Busca PNCP

**Descrição:** Cards de resultados com informações resumidas de cada contratação.

**Dados exibidos por card:**
- Número da compra e objeto
- Valor estimado e data de abertura
- Modalidade e situação (badge colorida)
- Órgão licitante + UF/Município
- Segmentos de engenharia identificados (badges coloridas)

**Ações:**
- "Ver Detalhes": exibe informações completas da contratação, itens e arquivos disponíveis.
- "Importar": baixa o edital do PNCP, salva no sistema e inicia o processamento automático.

---

### F-12 — Importação de Edital do PNCP

**Descrição:** Ao clicar em "Importar", o sistema executa automaticamente:
1. Busca os arquivos disponíveis no PNCP.
2. Identifica e baixa o PDF ou ZIP principal.
3. Se ZIP: extrai o PDF internamente.
4. Salva no storage e cria o registro de edital.
5. Inicia o pipeline de extração (OCR + IA).
6. Redireciona para a listagem com o novo edital visível.

**Feedback:** Indicador de progresso durante a importação. Mensagem de erro se a importação falhar.

---

### 2.5 Revisão de Edital

### F-13 — Página de Revisão com Dados Estruturados

**Descrição:** Após o processamento pela IA, o analista revisa os dados extraídos antes de liberar o edital para cruzamento.

**Metadados gerais exibidos no header:**
- Número, objeto, modalidade, status
- Órgão licitante, data de abertura, valor estimado
- UASG, regime de execução, lei regente
- Admite consórcio, prazo de execução

**Dados de habilitação organizados em 7 abas:**

| Aba | Conteúdo |
|-----|----------|
| Jurídica & Fiscal | Documentos jurídicos obrigatórios, certidões fiscais (CND, CRF, CNDT), declarações |
| Qualificação Técnica | Registro CREA/CAU, visita técnica, escritório local |
| Profissionais | Equipe técnica exigida (cargo, conselho, quantidade mínima) |
| Parcelas de Relevância | Serviços/obras com quantidade mínima e unidade exigidas |
| Atestados | Atestados necessários por profissional |
| Financeira | Índices financeiros mínimos (PL, LC, LG, SG), garantia de proposta |
| Alertas | Avisos críticos, de atenção e informativos extraídos pela IA |

---

### F-14 — Aprovação de Edital

**Descrição:** Após revisar os dados extraídos, o analista aprova o edital para liberar o cruzamento.

**Comportamento:**
- Botão "Aprovar" visível apenas quando status = "Aguardando Revisão".
- Ao aprovar, status muda para "Pronto".
- Edital fica disponível para iniciar cruzamentos.

---

### F-15 — Reprocessamento de Edital com Erro (admin)

**Descrição:** Quando a extração falhou, administradores podem reprocessar sem precisar fazer upload novamente.

**Comportamento:**
- Botão "Reprocessar" exibido apenas para editais com status "Erro".
- Re-enfileira o job de extração preservando o arquivo original.

---

## 3. Módulo de CATs

### 3.1 Listagem de CATs e Busca Semântica

### F-16 — Tabela de CATs com Filtros e Busca

**Descrição:** Listagem paginada de todas as CATs do tenant.

**Dados exibidos:**
| Coluna | Descrição |
|--------|-----------|
| Número CAT | Número de registro no CREA/CAU |
| Empresa Contratante | Quem contratou o serviço |
| Tipo de Obra/Serviço | Categoria da obra |
| Status | Badge com status de extração |
| Itens | Quantidade de itens extraídos |
| Ações | Ver detalhes, Editar, Deletar |

**Paginação:** 20 registros por página.

---

### F-17 — Busca Semântica nos Itens do Acervo

**Descrição:** Campo de busca em tempo real que encontra itens de CATs por semelhança de significado (não apenas por palavra-chave exata).

**Comportamento:**
- Busca híbrida: semântica (embedding) + texto completo (FTS em português).
- Resultados aparecem conforme o usuário digita (debounced).
- Cada resultado exibe: descrição do item, CAT de origem, empresa, quantidade.
- Clicar em um resultado navega para o detalhe da CAT correspondente.
- Filtro opcional por CAT específica restringe a busca a uma única CAT.

---

### F-18 — Edição Rápida de Metadados da CAT

**Descrição:** Modal inline para corrigir metadados da CAT sem sair da listagem.

**Campos editáveis:** Número CAT, Empresa Contratante, Tipo de Obra/Serviço, Descrição Técnica.

---

### F-19 — Exclusão de CAT

**Descrição:** Deletar uma CAT remove também todos os seus itens e embeddings.

**Comportamento:** Modal de confirmação exibe o nome da CAT e avisa sobre a remoção em cascata.

---

### 3.2 Cadastro de Profissionais Técnicos

### F-20 — Cadastro de Responsável Técnico

**Descrição:** Antes de fazer upload de uma CAT, é necessário ter pelo menos um profissional cadastrado como responsável.

**Campos obrigatórios:**
- Nome completo
- Número de registro CREA ou CAU
- Conselho (CREA ou CAU) — seleção via radio
- UF de registro — select com todos os estados

**Dados exibidos na listagem:**
- Avatar com iniciais
- Nome, número de registro, conselho (badge), UF
- Status Ativo / Inativo

---

### 3.3 Upload de CAT (Individual)

### F-21 — Upload de CAT com Seleção de Profissional

**Descrição:** Envio de uma CAT vinculada a um profissional técnico.

**Fluxo do usuário:**
1. Seleciona o profissional responsável (chips com nome e número).
2. Arrasta ou seleciona o arquivo (PDF ou Excel).
3. Clica em "Enviar para processamento".
4. Progresso exibido em barra.
5. Ao concluir, redireciona automaticamente para a listagem de CATs.

**Formatos aceitos:** PDF (`.pdf`), Excel (`.xls`, `.xlsx`).  
**Tamanho máximo:** 50 MB.  
**Pré-requisito:** Ao menos um profissional cadastrado. Se não houver, exibe aviso com link para cadastrar.

---

### 3.4 Upload de CATs em Lote

### F-22 — Upload de Múltiplas CATs com Profissional Único

**Descrição:** Envio de múltiplas CATs em uma única sessão, todas vinculadas ao mesmo profissional.

**Fluxo do usuário:**
1. Seleciona o profissional (todos os arquivos serão vinculados a ele).
2. Adiciona múltiplos arquivos (PDF ou Excel).
3. Fila exibe status individual de cada arquivo.
4. Inicia upload; progresso exibido por arquivo.
5. Ao final: contadores de sucesso e erro.
6. Botão "Tentar novamente" para arquivos com erro.

**Aviso exibido:** "Todos os arquivos serão vinculados ao profissional selecionado."

---

### 3.5 Revisão de CAT

### F-23 — Página de Detalhe e Revisão da CAT

**Descrição:** Visualização completa de uma CAT com todos os itens extraídos pela IA.

**Dados do card de resumo:**
- Status, número da CAT, empresa contratante
- Tipo de obra/serviço
- Descrição técnica completa (campo de texto)
- Profissional responsável vinculado
- Score de confiança da extração IA
- Data de cadastro

---

### F-24 — Tabela de Itens com Edição Inline

**Descrição:** Lista de todos os itens extraídos do documento, com possibilidade de corrigir cada um.

**Dados exibidos por item:**
| Coluna | Descrição |
|--------|-----------|
| Nº | Número de ordem no documento |
| Descrição | Descrição do serviço executado |
| Unidade | Sigla da unidade (M2, M3, KG, UN, KM...) |
| Quantidade | Valor numérico executado |
| Origem | ai_extracted / human_added / excel_imported |
| Score | Confiança da IA (0–100) |
| Ações | Editar, Deletar |

**Busca:** Campo de busca por descrição ou unidade (filtra itens em tempo real).

**Edição inline:** Ao clicar em editar, os campos do item ficam editáveis na própria linha. Botões "Salvar" e "Cancelar".

---

### F-25 — Adição Manual de Item

**Descrição:** Permite adicionar itens que a IA não extraiu ou que precisam ser incluídos manualmente.

**Modal com campos:**
- Descrição (obrigatório)
- Unidade
- Quantidade

**Item criado recebe `origem = human_added`.**

---

### F-26 — Aprovação de CAT

**Descrição:** Após revisar os itens, o analista marca a CAT como completa, disponibilizando-a para os cruzamentos.

**Comportamento:**
- Botão "Aprovar" visível apenas para CATs em status de revisão.
- Ao aprovar, status muda para "Completa".

---

### 3.6 Chat IA sobre o Acervo

### F-27 — Drawer de Chat com IA

**Descrição:** Interface de chat flutuante que permite consultar o acervo técnico do tenant em linguagem natural.

**Como acessar:** Ícone de chat na página de CATs ou no detalhe de uma CAT.

**Comportamento:**
- O usuário faz perguntas em linguagem natural sobre o acervo.
- O sistema busca automaticamente CATs relevantes por semântica e texto.
- A IA responde com base nas CATs encontradas, citando as fontes.
- O histórico da conversa é mantido durante a sessão.
- Contexto é reutilizado entre perguntas (cache de IA) para respostas mais rápidas.

**Exemplos de perguntas:**
- "Temos experiência em obras de pavimentação acima de 10 km?"
- "Quais profissionais têm CATs de saneamento básico?"
- "Qual a nossa maior CAT de edificações públicas?"

**Dados das respostas:**
- Resposta textual da IA
- CATs citadas como referência (empresa, número, tipo de obra)

---

## 4. Módulo de Cruzamentos

### 4.1 Listagem de Cruzamentos

### F-28 — Grid de Cruzamentos com Score Visual

**Descrição:** Visão em cards de todos os cruzamentos realizados, com indicadores visuais de aderência.

**Card de cruzamento concluído exibe:**
- Header: número do edital, objeto, órgão licitante
- **Score gauge circular** com cor (verde ≥ 70, amarelo ≥ 40, vermelho < 40)
- Badge de recomendação: Participar / Participar com Ressalvas / Não Participar
- Barra de aderência: requisitos atendidos (verde) / com ressalva (amarelo) / gap (vermelho)
- Grid de 3 indicadores: CATs utilizadas, Validade (OK/Alerta), Nível de Risco
- Rodapé: data do cruzamento e tempo de processamento

**Card de cruzamento em processamento:**
- Visual diferenciado (fundo tracejado)
- Spinner de progresso
- Texto: "Aguarde a conclusão"

**Empty state:** Instrução para acessar um edital com status "Pronto" e iniciar a análise.

---

### 4.2 Execução de Cruzamento

### F-29 — Disparo de Cruzamento

**Descrição:** A partir do detalhe de um edital com status "Pronto", o analista inicia a análise de aderência.

**Comportamento:**
1. Analista clica em "Iniciar Cruzamento" na página do edital.
2. Sistema cria o cruzamento com status "Na fila".
3. Redireciona para a página de detalhe do cruzamento.
4. Processamento ocorre em background com atualizações em tempo real.

**Pré-requisito:** Edital com status "Pronto" e pelo menos uma CAT completa no acervo.

---

### F-30 — Acompanhamento em Tempo Real via SSE

**Descrição:** A página de detalhe do cruzamento atualiza automaticamente conforme o processamento avança, sem necessidade de recarregar a página.

**Atualizações exibidas:**
- Mensagem de progresso: "Analisando requisito 3 de 15..."
- Cada requisito aparece na tabela conforme é analisado.
- Barra de progresso geral.
- Ao concluir: score final, recomendação e todos os resultados.

---

### 4.3 Detalhamento do Cruzamento

### F-31 — Hero Section com Score e Recomendação

**Descrição:** Destaque visual com os principais indicadores do cruzamento.

**Dados exibidos:**
- Score gauge grande (0–100) com cor adaptativa
- Recomendação principal com badge colorida
- Contadores: total de requisitos / atendidos / com ressalva / gaps
- Justificativa textual gerada pela IA

---

### F-32 — Tabela de Requisitos com Matches

**Descrição:** Listagem detalhada de cada requisito do edital e como o acervo de CATs o cobre.

**Filtros de visualização (abas):** Todos / Atendidos / Ressalvas / Gaps

**Dados exibidos por linha:**
- Descrição do requisito (parcela de relevância)
- Resultado: Atendido / Atendido Parcialmente / Gap (badge colorida)
- CAT(s) que cobrem o requisito: empresa, número, score de similaridade
- Nível de match: CAT inteira ou item específico
- Justificativa da IA para o resultado
- Indicador de validade da CAT
- Ícone de override (se resultado foi alterado manualmente)

---

### 4.4 Override Manual de Resultados

### F-33 — Sobrescrita de Resultado por Analista

**Descrição:** Permite que um analista discorde do resultado da IA e substitua manualmente o julgamento de um item.

**Fluxo:**
1. Clicar no ícone de edição do item.
2. Modal exibe o resultado atual da IA e campos para override.
3. Analista seleciona o novo resultado (Atendido / Ressalva / Gap).
4. Campo obrigatório de nota interna justificando a decisão.
5. Ao salvar, o score geral do cruzamento é recalculado automaticamente.

**Indicação visual:** Items com override exibem ícone diferenciado indicando que o resultado foi alterado por humano.

---

### 4.5 Exportação de Relatório

### F-34 — Exportação em CSV

**Descrição:** Gera arquivo CSV com o relatório completo do cruzamento para uso externo.

**Conteúdo do CSV:**
- Header: metadados do edital (número, objeto, órgão, data de abertura)
- Resumo: score, recomendação, contadores
- Linhas: um requisito por linha com resultado, justificativa e CATs que cobrem

**Ação:** Botão "Exportar CSV" no header da página de detalhe. Download iniciado imediatamente.

---

### F-35 — Impressão de Relatório

**Descrição:** Versão formatada para impressão do relatório de cruzamento.

**Conteúdo:**
- Sumário executivo com recomendação
- Tabela completa de requisitos e resultados
- Rodapé com data de geração

**Ação:** Botão "Imprimir" aciona o diálogo de impressão do navegador.

---

## 5. Configurações

### 5.1 Gestão de Usuários

### F-36 — Convite de Novo Usuário (admin)

**Descrição:** Administradores convidam novos membros da equipe definindo o papel de acesso.

**Campos do convite:**
- Nome completo
- E-mail
- Nível de acesso:
  - **Administrador:** Acesso total + gestão de usuários
  - **Analista:** Criar, editar e analisar editais, CATs e cruzamentos
  - **Visualizador:** Somente visualizar (sem criar ou editar)

**Comportamento:** O usuário convidado recebe e-mail com link para criar sua conta. O convite fica pendente até que o e-mail seja confirmado.

---

### F-37 — Gerenciamento de Usuários Ativos

**Descrição:** Lista de todos os usuários ativos com ações de gestão.

**Dados exibidos:** Avatar/iniciais, nome, e-mail, nível de acesso (badge), data de ingresso.

**Ações disponíveis (admin):**
- **Mudar papel:** Dropdown com confirmação antes de aplicar.
- **Desativar:** Remove o acesso sem deletar o usuário (reversível). Requer confirmação.

---

### F-38 — Gerenciamento de Usuários Inativos

**Descrição:** Aba separada com usuários desativados e opções de reativação ou exclusão permanente.

**Ações disponíveis (admin):**
- **Reativar:** Restaura o acesso do usuário.
- **Deletar permanentemente:** Remove o usuário do sistema. Requer dupla confirmação com aviso de que a ação é irreversível.

---

### 5.2 Monitoramento PNCP

### F-39 — Status do Cache PNCP

**Descrição:** Painel de estado da sincronização com o PNCP.

**Dados exibidos:**
- Última sincronização (tempo relativo)
- Total de registros em cache
- UFs atualmente monitoradas
- Status (Atualizado / Sincronizando / Erro / Não sincronizado)
- Barra de progresso quando sincronização está em andamento
- Mensagem de erro detalhada se a última sincronização falhou

---

### F-40 — Configuração de UFs Monitoradas

**Descrição:** Selecionar quais estados terão suas contratações públicas sincronizadas do PNCP.

**Interface:** Grid de checkboxes com sigla e nome completo de todos os 26 estados + DF.

**Aviso:** Se mais de 5 UFs forem selecionadas, sistema exibe alerta sobre volume alto de dados.

---

### F-41 — Configuração de Retenção e Sincronização

**Descrição:** Controles de configuração da sincronização automática.

**Campos:**
- **Retenção de histórico:** Número de dias que os registros do PNCP ficam armazenados (7 a 365 dias). Registros mais antigos são removidos automaticamente.
- **Sincronização automática:** Toggle para ativar/desativar sincronização periódica.

**Ação:** Botão "Salvar configurações" persiste as alterações.

---

### F-42 — Sincronização Manual

**Descrição:** Força uma sincronização imediata do PNCP independente do agendamento automático.

**Comportamento:**
- Botão "Sincronizar agora" inicia o processo.
- Painel de status atualiza em tempo real mostrando progresso.
- Ao concluir, exibe total de registros sincronizados.

---

## 6. Funcionalidades Transversais

### 6.1 Autenticação

### F-43 — Cadastro de Conta

**Descrição:** Novos usuários criam sua conta informando nome, e-mail e senha.

**Fluxo:** Formulário em `/sign-up` → verificação de e-mail → acesso liberado.

---

### F-44 — Login

**Descrição:** Acesso ao sistema via e-mail e senha.

**Fluxo:** Formulário em `/sign-in` → sessão criada → redirecionamento para dashboard.

---

### 6.2 Controle de Acesso por Papel

### F-45 — Permissões por Papel

**Descrição:** Cada rota e ação do sistema é protegida por papel de acesso.

| Ação | Viewer | Analyst | Admin |
|------|--------|---------|-------|
| Visualizar editais, CATs, cruzamentos | ✅ | ✅ | ✅ |
| Fazer upload de editais e CATs | ❌ | ✅ | ✅ |
| Aprovar editais e CATs | ❌ | ✅ | ✅ |
| Iniciar cruzamentos | ❌ | ✅ | ✅ |
| Fazer override de resultados | ❌ | ✅ | ✅ |
| Exportar CSV e imprimir | ✅ | ✅ | ✅ |
| Gerenciar usuários | ❌ | ❌ | ✅ |
| Deletar editais e CATs | ❌ | ✅ | ✅ |
| Reprocessar com erro | ❌ | ❌ | ✅ |
| Configurar monitoramento PNCP | ❌ | ❌ | ✅ |
| Sincronizar PNCP manualmente | ❌ | ❌ | ✅ |

---

### 6.3 Processamento Assíncrono e Status de Jobs

### F-46 — Indicadores de Status em Processamento

**Descrição:** O sistema processa editais e CATs em background. O usuário vê o andamento sem precisar aguardar na tela.

**Comportamento:**
- Status atualizados em tempo real (polling ou SSE conforme o módulo).
- Badges com indicadores animados (dot pulsante) enquanto há processamento ativo.
- Spinners desabilitam ações que não estão disponíveis durante o processamento.
- Ao concluir, status muda automaticamente e novas ações ficam disponíveis.

**Estados de processamento de editais:**

| Status | Significado |
|--------|------------|
| Uploaded | Arquivo recebido, aguardando fila |
| OCR em andamento | Reconhecimento óptico de caracteres ativo |
| Extraindo | IA analisando e estruturando os dados |
| Aguardando Revisão | Extração concluída, aguarda aprovação humana |
| Pronto | Revisado e aprovado, disponível para cruzamento |
| Erro | Falha no processamento (com mensagem detalhada) |

**Estados de processamento de CATs:**

| Status | Significado |
|--------|------------|
| Pendente | Arquivo recebido, aguardando fila |
| Processando | OCR + extração IA em andamento |
| Aguardando Revisão | Extração concluída, aguarda revisão |
| Completa | Revisada e aprovada |
| Erro | Falha no processamento |

---

### F-47 — Retry Automático de Jobs com Falha

**Descrição:** Jobs que falham por erros transientes (rede, rate limit de API) são reexecutados automaticamente, sem intervenção do usuário.

**Comportamento:**
- Até 3 tentativas automáticas.
- Após 3 falhas consecutivas, status muda para "Erro" e o administrador pode reprocessar manualmente.

---

### 6.4 Gerenciamento de Embeddings

### F-48 — Reconstrução de Embeddings

**Descrição:** Funcionalidade para regenerar os vetores de busca semântica quando necessário (ex: após atualização de modelo de IA ou importação em lote).

**Onde disponível:** Página de listagem de CATs e página de listagem de editais.

**Painel de status exibe:**
- Total de CATs/itens com embedding gerado vs. pendente
- Barra de progresso percentual
- Botão "Reconstruir Embeddings" (inicia regeneração em background)

**Comportamento:**
- Regeneração ocorre em background sem bloquear o uso do sistema.
- Sistema filtra automaticamente por modelo de embedding para evitar mistura de versões incompatíveis.

---

### F-49 — Normalização de Descrições

**Descrição:** Padroniza as descrições dos itens de CAT para sentence case, melhorando a qualidade dos resultados de busca.

**Onde disponível:** Página de listagem de CATs.

**Comportamento:** Aplica normalização em lote a todos os itens do tenant e regenera os embeddings afetados.

---

### 6.5 Navegação Global

### F-50 — Sidebar de Navegação

**Descrição:** Menu lateral fixo com acesso a todos os módulos do sistema.

**Itens do menu:**
1. Dashboard
2. Editais (com subitens: Upload, Buscar PNCP)
3. CATs (com subitens: Upload, Profissionais)
4. Cruzamentos
5. Configurações (com subitens: Usuários, Monitoramento PNCP)

**Elemento de destaque:** Botão "Novo Edital" no rodapé da sidebar para acesso rápido ao upload.

---

### F-51 — Busca Global (Command Palette)

**Descrição:** Barra de busca no header superior ativa uma paleta de comandos (atalho ⌘K / Ctrl+K) para encontrar editais, processos ou CATs rapidamente.

---

### F-52 — Informações do Usuário Logado

**Descrição:** Header superior exibe nome e papel do usuário atual, com menu dropdown para ações de conta.

---

## Índice de Funcionalidades

| ID | Funcionalidade | Módulo | Papéis |
|----|---------------|--------|--------|
| F-01 | KPIs do Sistema | Dashboard | Viewer+ |
| F-02 | Editais Prontos para Revisão | Dashboard | Viewer+ |
| F-03 | Atividade Recente | Dashboard | Viewer+ |
| F-04 | Próximas Aberturas | Dashboard | Viewer+ |
| F-05 | Acesso Rápido a Cruzamentos | Dashboard | Viewer+ |
| F-06 | Tabela de Editais com Filtros | Editais | Viewer+ |
| F-07 | Drag-and-Drop na Listagem | Editais | Analyst+ |
| F-08 | Upload de Edital Individual | Editais | Analyst+ |
| F-09 | Upload de Editais em Lote | Editais | Analyst+ |
| F-10 | Busca Avançada no PNCP | Editais | Analyst+ |
| F-11 | Resultados da Busca PNCP | Editais | Analyst+ |
| F-12 | Importação de Edital do PNCP | Editais | Analyst+ |
| F-13 | Revisão com Dados Estruturados | Editais | Analyst+ |
| F-14 | Aprovação de Edital | Editais | Analyst+ |
| F-15 | Reprocessamento de Edital | Editais | Admin |
| F-16 | Tabela de CATs com Filtros | CATs | Viewer+ |
| F-17 | Busca Semântica no Acervo | CATs | Viewer+ |
| F-18 | Edição Rápida de Metadados | CATs | Analyst+ |
| F-19 | Exclusão de CAT | CATs | Analyst+ |
| F-20 | Cadastro de Profissional Técnico | CATs | Analyst+ |
| F-21 | Upload de CAT Individual | CATs | Analyst+ |
| F-22 | Upload de CATs em Lote | CATs | Analyst+ |
| F-23 | Revisão de CAT | CATs | Analyst+ |
| F-24 | Tabela de Itens com Edição Inline | CATs | Analyst+ |
| F-25 | Adição Manual de Item | CATs | Analyst+ |
| F-26 | Aprovação de CAT | CATs | Analyst+ |
| F-27 | Chat IA sobre o Acervo | CATs | Viewer+ |
| F-28 | Grid de Cruzamentos com Score | Cruzamentos | Viewer+ |
| F-29 | Disparo de Cruzamento | Cruzamentos | Analyst+ |
| F-30 | Acompanhamento em Tempo Real | Cruzamentos | Viewer+ |
| F-31 | Hero Section com Score | Cruzamentos | Viewer+ |
| F-32 | Tabela de Requisitos com Matches | Cruzamentos | Viewer+ |
| F-33 | Override Manual de Resultados | Cruzamentos | Analyst+ |
| F-34 | Exportação em CSV | Cruzamentos | Viewer+ |
| F-35 | Impressão de Relatório | Cruzamentos | Viewer+ |
| F-36 | Convite de Novo Usuário | Configurações | Admin |
| F-37 | Gerenciamento de Usuários Ativos | Configurações | Admin |
| F-38 | Gerenciamento de Usuários Inativos | Configurações | Admin |
| F-39 | Status do Cache PNCP | Configurações | Admin |
| F-40 | Configuração de UFs Monitoradas | Configurações | Admin |
| F-41 | Configuração de Retenção | Configurações | Admin |
| F-42 | Sincronização Manual PNCP | Configurações | Admin |
| F-43 | Cadastro de Conta | Auth | Público |
| F-44 | Login | Auth | Público |
| F-45 | Permissões por Papel | Transversal | — |
| F-46 | Indicadores de Status de Jobs | Transversal | Viewer+ |
| F-47 | Retry Automático de Jobs | Transversal | — |
| F-48 | Reconstrução de Embeddings | Transversal | Analyst+ |
| F-49 | Normalização de Descrições | Transversal | Analyst+ |
| F-50 | Sidebar de Navegação | Transversal | Viewer+ |
| F-51 | Busca Global (Command Palette) | Transversal | Viewer+ |
| F-52 | Informações do Usuário Logado | Transversal | Viewer+ |
