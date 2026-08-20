# AUDITORIA 360° — SYNAPSE

> **Data da revisão:** 19/08/2026
> **Escopo auditado:** frontend `architect-os-frontend-main(4)` + backend `architect-os-backend-main(1)` + documentação/screenshot presentes nos repositórios + histórico das revisões anteriores disponibilizado pelo usuário.
> **Natureza da auditoria:** produto, PDI, UX/UI, acessibilidade, frontend, backend, API, dados, segurança, qualidade, performance, coerência entre camadas e prontidão corporativa.

## 1. Executive Summary

### Conclusão executiva

O **Synapse já possui um núcleo de produto defensável** para PDI técnico: catálogo de capacidades, assessment com autoavaliação e revisão do Lead, identificação de gaps, PDI, trilhas, mentoria, evidências, revisão de evidências e ciclos. As rodadas anteriores removeram corretamente mecanismos frágeis ou ornamentais, como 9-Box operacional, Development Score, SWOT, OKR e Philosophy do fluxo ativo.

Entretanto, **o sistema ainda NÃO está pronto para produção corporativa**.

A razão não é estética. A interface tem bom nível visual e o código tem uma base de engenharia acima de um protótipo comum. O bloqueio é de **confiança operacional e integridade de domínio**.

Os dois P0 mais relevantes encontrados nesta rodada são:

1. **Cadastro público permite vínculo arbitrário com `architectId`.** O endpoint público de registro aceita `architectId`; como o vínculo `users.architect_id` não é único, uma conta criada fora do fluxo do frontend pode se associar ao perfil profissional de outra pessoa e passar a operar como "dona" daquele histórico. Evidências: `backend/src/routes/auth.ts:23-45`, `backend/src/auth/users.ts:73-90`, `backend/src/db/schema.sql:131-140`. O frontend ainda oferece "Criar uma nova conta" mesmo quando a instância já possui usuários: `frontend/src/components/app/LoginScreen.tsx:125-135`.
2. **PDI marcado como Approved/Completed continua mutável.** O backend governa a transição `Draft → Approved → Completed`, mas as rotas de adicionar/editar/excluir itens não verificam o status do plano. O próprio frontend exibe "locked" em `Completed` e, ao mesmo tempo, continua habilitando edição pelo `canEdit`. Evidências: `backend/src/routes/api/development.ts:19-27,50-87,135-148`; `backend/src/repositories/development.ts:30-44,84-122`; `frontend/src/routes/development-plans.tsx:81-99,142-180,217-258,308-337`.

Há ainda um problema transversal P1 de decisão: o backend filtra assessments/PDIs/evidências por escopo para Member/Lead, mas mantém o roster completo. O frontend calcula várias análises usando todo o roster. Assim, **"não tenho permissão para ver" pode aparecer como "não avaliado"**, tornando Dashboard, Capability Map, Gap Analysis e Training Needs semanticamente incorretos para perfis não administrativos. Evidências: `backend/src/auth/scope.ts:54-91`; `frontend/src/lib/selectors.ts:84-92,188-216`; `frontend/src/routes/index.tsx:48-79`.

### Tese do produto

> **Este produto existe para transformar uma necessidade real de evolução técnica em um ciclo governado de diagnóstico, prioridade, ação, evidência, feedback e evolução verificável.**

### Fluxo de valor real encontrado

```text
Modelo de Capacidades
→ Assessment (Self / Lead / Final)
→ Gap oficial do ciclo
→ Priorização
→ PDI
→ Ação de desenvolvimento
   ├─ Learning Path
   ├─ Mentoria
   └─ Prática/Projeto/Outras ações
→ Evidência
→ Review do Lead
→ Histórico / próximo Assessment
→ Evolução entre ciclos
```

O fluxo existe, mas ainda há rupturas no fechamento e na governança.

### Avaliação do escopo

**ESCOPO: PARCIALMENTE VALIDADO, com direção correta.**

O produto não precisa ganhar novas famílias de features agora. O escopo funcional recomendado é:

- **CORE:** Pessoas, Modelo de Capacidades, Assessments, Prioridades/Gaps, PDI, Evidências, Ciclos.
- **MEIOS DE DESENVOLVIMENTO:** Learning Paths e Mentoria.
- **ADMINISTRAÇÃO:** Usuários/Acessos e Modelo de Capacidades.
- **CONSOLIDAR:** Capability Map + Gap Analysis + Training Needs em uma experiência de "Capacidades e Prioridades"; PDI + trilhas atribuídas + mentoria + evidências em um workspace de desenvolvimento da pessoa.
- **REMOVER COMO DESTINO PRIMÁRIO:** `/settings` (Referência) e, preferencialmente, `/training-needs` como módulo standalone.
- **NÃO REINTRODUZIR AGORA:** 9-Box, Development Score, SWOT, OKR nativo, Philosophy editável ou gamificação de desenvolvimento.

### Método e limitações

**VALIDADO:** inspeção estática aprofundada de código, rotas, schemas Zod, repositórios, SQL, regras de autorização, componentes, selectors, store, testes existentes, documentação e relações frontend/backend.

**PARCIALMENTE VALIDADO:** UI visual e responsividade. Há screenshots no repositório, porém parte deles retrata versões anteriores e funcionalidades removidas; portanto, não foram usados como verdade única do estado atual.

**NÃO VALIDÁVEL COM OS ARTEFATOS DISPONÍVEIS:** comportamento real de produção, latência, volume, consumo de memória, contraste medido por ferramenta, navegação por leitor de tela, compatibilidade real entre browsers e resultados executados de build/lint/typecheck/test. As dependências não estavam integralmente presentes; uma instalação no ambiente de auditoria não foi concluída, logo não considero as suítes "verdes" como evidência reproduzida nesta rodada.

---

## 2. Entendimento do Produto

### Problema que resolve

Organizações técnicas frequentemente possuem avaliações dispersas, planos genéricos e pouca capacidade de demonstrar se uma ação de desenvolvimento realmente alterou a capacidade profissional. O Synapse tenta conectar:

```text
expectativa do papel
→ capacidade observada
→ gap
→ ação
→ evidência
→ feedback
→ nova avaliação
```

### Público-alvo

- profissionais técnicos de tecnologia;
- Tech Leads / gestores técnicos;
- responsáveis por capability management / People técnico;
- administradores do modelo e acessos.

### Entidades centrais encontradas

- `Architect` — pessoa/profissional técnico;
- `CompetencyCategory` e `Competency` — taxonomia de capacidades;
- `DevelopmentCycle` — período de avaliação/PDI;
- `Assessment` + itens — fotografia avaliada da capacidade;
- `DevelopmentPlan` + itens — ações do PDI;
- `LearningPath` — trilha catalogada e atribuída;
- `MentoringSession` — sessão de mentoria;
- `Evidence` — realização/evidência submetida e revisada;
- `User` — identidade, papel e vínculo com a pessoa;
- `audit_log` — trilha técnica de alterações.

### Conceitos do domínio

**Competência — VALIDADO.** Possui categoria, nível esperado por papel e estado ativo/arquivado.

**Gap — VALIDADO.** É derivado de `target - final` de Assessment `Completed`; rascunhos não alimentam gap oficial.

**Objetivo/Ação — PARCIALMENTE VALIDADO.** O PDI possui objetivo, tipo de ação, plano, prazo, prioridade, status e SMART opcional. O backend, porém, não valida a origem/consistência desses dados contra o diagnóstico oficial.

**Evidência — VALIDADO COM RESSALVAS.** Nasce `Pending`, pode vincular-se a item de PDI, e há review do Lead com autoria/data. Falta histórico de revisões e integridade relacional forte com o item de PDI.

**Progresso — PARCIALMENTE VALIDADO.** PDI e Learning Path possuem progresso operacional. Progresso de trilha é individual, uma correção importante. Contudo, progresso de atividade não equivale a evolução de competência e o produto precisa continuar evitando essa equivalência automática.

**Feedback — PARCIALMENTE VALIDADO.** Existe em comentários de Assessment e review de Evidence. Não há experiência forte de check-in periódico do PDI.

**Evolução — PARCIALMENTE VALIDADO.** Ciclos e histórico existem, porém a navegação histórica de Assessment possui quebra de contexto e Learning/Mentoring/Evidence não são temporalizados por ciclo.

### Ciclo de vida reconstruído

1. Admin configura capacidades e ciclos.
2. Admin cadastra pessoas e Lead responsável.
3. Pessoa abre Assessment e preenche `self`.
4. Pessoa envia para `In Review`.
5. Lead preenche `leader/final`, comenta e conclui.
6. Apenas `Completed` alimenta gaps e agregações.
7. Gap positivo pode gerar item de PDI.
8. Lead aprova PDI.
9. Pessoa executa ações e registra evidências.
10. Lead revisa evidências.
11. Próximo Assessment mostra contexto de evidências aceitas.
12. Ciclos podem ser comparados.

**Problema:** passos 3–5 ainda podem oficializar valores default não efetivamente avaliados; passos 7–9 não são bloqueados corretamente pelo status do plano; passos 11–12 ainda não formam uma experiência longitudinal completa.

---

## 3. Veredito Executivo

| Pergunta               | Veredito                              | Justificativa                                                                                                         |
| ---------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Produto é útil?        | **PARCIALMENTE**                      | Resolve um problema real e o core é pertinente, mas falhas de integridade impedem confiança plena.                    |
| Produto é coerente?    | **PARCIALMENTE**                      | O domínio está mais limpo, porém a navegação continua orientada a módulos e o escopo por papel diverge dos analytics. |
| Produto está completo? | **NÃO**                               | Faltam fechamento governado do PDI, histórico longitudinal consistente, work queues e integridade mais forte.         |
| Produto está pronto?   | **NÃO**                               | P0 de identidade/cadastro e P0 de mutabilidade do PDI bloqueiam produção corporativa.                                 |
| Principal risco        | **Confiança nos dados e autorização** | A aplicação pode apresentar ou persistir informação com semântica mais forte do que a evidência real suporta.         |
| Principal oportunidade | **Transformar módulos em jornada**    | O backend já possui elementos suficientes para uma experiência forte de "Minha Evolução" e "Pendências do Lead".      |

**Principal razão para adoção:** conexão entre modelo técnico de capacidades, assessment, gap, PDI e evidência em um único sistema.

**Principal razão para abandono:** se profissionais e líderes perceberem que planos "concluídos" podem ser alterados, avaliações podem virar oficiais sem preenchimento real, ou dashboards confundem falta de acesso com falta de avaliação, a confiança no sistema cai rapidamente.

---

## 4. Personas e Papéis

### Member / profissional técnico

**Existe:** VALIDADO.
**Objetivos:** autoavaliar-se, entender prioridades, executar PDI, registrar evidências, acompanhar trilhas e histórico.
**Permissões esperadas:** próprio perfil e desenvolvimento; não administrar catálogo, usuários ou dados de carreira alheios.
**Problema atual:** recebe navegação organizacional/administrativa demais e o frontend não é orientado primariamente a "Minha Evolução".

### Lead / Tech Lead

**Existe:** VALIDADO.
**Objetivos:** revisar assessments, aprovar/reabrir PDI, revisar evidências, acompanhar pessoas sob responsabilidade, orientar trilhas/mentoria.
**Escopo backend:** `architect.leadUserId === user.id`, com deny-by-default quando não há atribuição (`backend/src/auth/scope.ts:16-29`).
**Problema atual:** o frontend frequentemente usa apenas `isLeadCapable(role)` e exibe controles/seletores além do escopo real; o backend então retorna 403. Também há endpoints que não aplicam o mesmo recorte.

### Admin

**Existe:** VALIDADO.
**Objetivos:** administrar usuários, roster, catálogo e ciclos.
**Decisão atual:** Admin também pode agir como Lead de qualquer pessoa (`scope.ts`).
**Risco:** é uma opção de produto aceitável apenas se explicitamente assumida; para empresas maiores, "administrar sistema" e "decidir carreira" tendem a ser responsabilidades distintas.

### RH / People / Mentor / Avaliador dedicado

**Como papéis formais de autorização:** INEXISTENTE.
Mentoria existe como comportamento de qualquer usuário autenticado, mas não como role corporativa formal. Isso é aceitável para MVP se a governança de mentoria for clara; hoje não é suficientemente clara.

---

## 5. Jornada Principal

### Jornada alvo recomendada

```text
Entrar
→ entender pendências do ciclo
→ realizar/revisar Assessment
→ compreender prioridades
→ acordar PDI
→ executar ações
→ registrar evidências
→ receber feedback
→ revisar resultado
→ comparar evolução
→ iniciar novo ciclo
```

### Jornada atual

```text
Dashboard
→ selecionar módulo
→ Assessment
→ Gap Analysis
→ Development Plans
→ Learning Paths / Mentoring
→ Perfil para Evidence
→ Assessment futuro / Cycles
```

**Veredito:** EXISTE PARCIALMENTE.

O dado está mais conectado do que a navegação. O usuário ainda precisa conhecer a arquitetura interna do produto para ligar "Gap", "PDI", "Trilha", "Mentoria" e "Evidence". A aplicação deve passar de **entity navigation** para **task/journey navigation**.

---

## 6. Mapa de Telas

| Tela                    | Rota                 | Finalidade                         | Usuário principal                  | Papel na jornada           | Estado                             |
| ----------------------- | -------------------- | ---------------------------------- | ---------------------------------- | -------------------------- | ---------------------------------- |
| Login / Primeiro acesso | gate                 | autenticação e criação de conta    | todos                              | entrada                    | **INCONSISTENTE / P0**             |
| Dashboard               | `/`                  | visão executiva do ciclo           | hoje todos                         | orientar                   | **INCONSISTENTE por escopo**       |
| Pessoas                 | `/team`              | roster e acesso a perfis           | Lead/Admin; Member apenas contexto | entrada para pessoa        | **PARCIALMENTE VALIDADO**          |
| Perfil da pessoa        | `/architects/:id`    | workspace consolidado              | pessoa/Lead/Admin                  | desenvolvimento individual | **PARCIALMENTE VALIDADO**          |
| Capability Map          | `/capability-map`    | cobertura/risco por capacidade     | Lead/Admin                         | diagnóstico coletivo       | **PARCIALMENTE VALIDADO**          |
| Gap Analysis            | `/gap-analysis`      | gaps por pessoa/time               | pessoa/Lead/Admin                  | priorização                | **PARCIALMENTE VALIDADO**          |
| Training Needs          | `/training-needs`    | agregação de gaps para intervenção | Lead/Admin                         | priorização coletiva       | **REDUNDANTE como tela própria**   |
| Assessments             | `/assessments`       | avaliação/calibração               | Member/Lead                        | diagnóstico oficial        | **PARCIALMENTE VALIDADO**          |
| Development Plans       | `/development-plans` | plano e ações                      | Member/Lead                        | execução                   | **INCONSISTENTE / P0**             |
| Learning Paths          | `/learning-paths`    | trilhas e progresso                | Member/Lead                        | intervenção                | **PARCIALMENTE VALIDADO**          |
| Mentoring               | `/mentoring`         | sessões e follow-up                | todos/Lead                         | intervenção                | **PARCIALMENTE VALIDADO**          |
| Competency Matrix       | `/competency-matrix` | modelo de capacidades              | Admin                              | configuração               | **VALIDADO com ressalvas**         |
| Cycles                  | `/cycles`            | períodos e evolução                | Admin + leitura                    | governança temporal        | **INCONSISTENTE**                  |
| Users                   | `/users`             | acessos e vínculos                 | Admin                              | administração              | **VALIDADO com ressalvas**         |
| Reference               | `/settings`          | glossário read-only                | todos                              | auxílio                    | **SEM VALOR COMO MÓDULO PRIMÁRIO** |
| Loading auth            | gate                 | espera de sessão                   | todos                              | estado sistêmico           | **PARCIALMENTE VALIDADO**          |
| 404 / Error boundary    | root                 | recuperação                        | todos                              | estado sistêmico           | **VALIDADO estaticamente**         |
| Erro de backend/store   | StoreProvider        | indisponibilidade                  | todos                              | recuperação                | **PARCIALMENTE VALIDADO**          |

**Origem de dados predominante:** `/api/state` hidrata snapshot do frontend; operações de escrita usam endpoints específicos.
**Dependência transversal:** `activeCycleId` define Assessment/PDI/gaps atuais.

---

## 7. Análise Tela a Tela

### Tela: Login / Primeiro acesso

**Objetivo:** autenticar ou criar conta.
**Usuário:** todos.
**Jornada:** porta de entrada.
**O que funciona:** senha mínima; erros visíveis; login genérico evita enumeração simples de e-mail; JWT validado no backend.
**Problemas:** criação pública continua disponível após bootstrap; API aceita `architectId` do cliente.
**Problemas de UX:** "Criar uma nova conta" sugere self-service corporativo sem explicar governança/aprovação.
**Problemas de UI:** sem achado visual crítico estático.
**Problemas de negócio:** identidade de carreira pode ser autodeclarada por chamada direta à API.
**Problemas técnicos:** `registerSchema` aceita `architectId`; primeiro admin definido por `countUsers()` sem lock transacional.
**Estados ausentes:** convite expirado/pendente, SSO/identity provisioning, bloqueio de cadastro público.
**Problemas de acessibilidade:** não identificado bloqueador por inspeção estática.
**Problemas de consistência:** frontend não envia `architectId`, mas contrato público aceita; segurança depende do cliente "não usar" um campo.
**Risco:** takeover/duplicidade de identidade profissional.
**Prioridade:** **P0**.
**Recomendação:** cadastro público apenas para bootstrap atômico; depois convite/SSO/admin; servidor resolve vínculo; `UNIQUE` em `users.architect_id` quando não nulo.
**Veredito:** **INCONSISTENTE — BLOQUEIA PRODUÇÃO.**

### Tela: Dashboard

**Objetivo:** mostrar situação do ciclo e prioridades.
**Usuário:** hoje todos; deveria variar por papel.
**Jornada:** orientar próximo passo.
**O que funciona:** só Assessment `Completed` alimenta gaps; há cobertura de assessments e indicadores factuais em vez de score composto.
**Problemas:** usa `sel.activeArchitects` do roster completo, mesmo quando os records individuais foram filtrados pelo backend.
**Problemas de UX:** Member recebe visão executiva de "time" em vez de agenda pessoal; Lead pode receber visão incompleta do universo exibido.
**Problemas de UI:** densidade aceitável; excesso de cards ainda pode competir com a ação principal.
**Problemas de negócio:** `notStarted` pode significar "não tenho acesso ao assessment".
**Problemas técnicos:** agregações são client-side sobre snapshot parcialmente escopado.
**Estados ausentes:** "dados fora do seu escopo", work queue por papel.
**Problemas de acessibilidade:** gráficos precisam validação real de leitura não visual; não foi possível reproduzir.
**Problemas de consistência:** semântica de roster ≠ semântica de registros visíveis.
**Risco:** decisão incorreta.
**Prioridade:** **P1**.
**Recomendação:** homes distintas Member/Lead/Admin ou endpoints de agregação com escopo explícito.
**Veredito:** **INCONSISTENTE para Member/Lead; útil para Admin.**

### Tela: Pessoas

**Objetivo:** listar time, cadastrar/editar/desativar e entrar no perfil.
**Usuário:** Admin para CRUD; Lead para seu time; Member apenas se diretório for requisito.
**Jornada:** seleção da pessoa.
**O que funciona:** dados obrigatórios deixaram de receber defaults fictícios; desativação preserva histórico; Lead responsável é configurável.
**Problemas:** roster completo é enviado a Member/Lead e inclui e-mail/especialização/tempo/Lead; política de privacidade não está explicitada.
**Problemas de UX:** para Member, é navegação secundária e desvia de "Minha Evolução".
**Problemas de UI:** cards e estados vazios estão estruturados.
**Problemas de negócio:** ausência de entidade Team/Organization limita organizações maiores e relações matriciais.
**Problemas técnicos:** `lead_user_id` pode apontar para qualquer `users.id`; validação de role existe na UI, não no banco/backend de forma forte.
**Estados ausentes:** "não tenho acesso ao desenvolvimento desta pessoa".
**Problemas de acessibilidade:** sem achado crítico estático.
**Problemas de consistência:** pessoa pode aparecer, mas suas informações de desenvolvimento ficam vazias por escopo.
**Risco:** privacidade e interpretação.
**Prioridade:** **P2**.
**Recomendação:** política explícita de diretório; redaction; restringir roster ao escopo ou marcar dados indisponíveis; validar `leadUserId` no servidor.
**Veredito:** **PARCIALMENTE VALIDADO.**

### Tela: Perfil da pessoa

**Objetivo:** consolidar radar, gaps, histórico, PDI, trilhas, evidências e mentoria.
**Usuário:** profissional + Lead responsável + Admin.
**Jornada:** é o embrião correto do workspace de desenvolvimento.
**O que funciona:** concentra várias dimensões; PDI exibe evidências vinculadas; Evidence pode ser criada e revisada; histórico de assessment existe.
**Problemas:** link "Ver" de um Assessment histórico envia apenas `architectId` e não o `cycleId`; a tela Assessments usa o ciclo ativo, quebrando a navegação histórica (`architects.$architectId.tsx:190-208`).
**Problemas de UX:** ações críticas ainda estão distribuídas em módulos externos; perfil deveria ser o centro da jornada.
**Problemas de UI:** boa organização por cards; precisa priorizar pendências/próximo passo sobre inventário.
**Problemas de negócio:** perfil de pessoa fora do escopo pode parecer "sem histórico" em vez de "sem acesso".
**Problemas técnicos:** criação de Evidence usa ID por `Date.now()` e confirmação otimista antes do servidor.
**Estados ausentes:** erro específico por operação; histórico do PDI; review timeline.
**Problemas de acessibilidade:** precisa teste de foco de dialogs.
**Problemas de consistência:** histórico listado não preserva contexto ao navegar.
**Risco:** perda de confiança longitudinal.
**Prioridade:** **P1**.
**Recomendação:** transformar em Workspace da Pessoa e deep-link por `architectId + cycleId + section`.
**Veredito:** **PARCIALMENTE VALIDADO — é a direção de IA mais promissora do produto.**

### Tela: Capability Map

**Objetivo:** visualizar cobertura/risco técnico.
**Usuário:** principalmente Lead/Admin.
**Jornada:** diagnóstico coletivo.
**O que funciona:** ausência de assessment não é transformada em nível zero; risco considera referências/cobertura.
**Problemas:** sofre do escopo parcial do snapshot; roster completo + assessments visíveis parciais.
**Problemas de UX:** para Member individual, valor baixo como item de primeiro nível.
**Problemas de UI:** visual de mapa/heatmap adequado, sujeito a teste real de contraste.
**Problemas de negócio:** "capacidade do time" só é válida quando a população analisada é conhecida e completa.
**Problemas técnicos:** cálculo client-side.
**Estados ausentes:** cobertura parcial por permissão.
**Problemas de acessibilidade:** significado não pode depender somente de cor; requer teste real.
**Problemas de consistência:** deve compartilhar a mesma população canônica de Gap/LNT.
**Risco:** análise coletiva incorreta.
**Prioridade:** **P1**.
**Recomendação:** consolidar em "Capacidades", com população/escopo explícitos.
**Veredito:** **PARCIALMENTE VALIDADO.**

### Tela: Gap Analysis

**Objetivo:** identificar diferenças entre nível final e esperado.
**Usuário:** Member para si; Lead para equipe; Admin para organização.
**Jornada:** priorização.
**O que funciona:** usa apenas Assessment oficial; há link para PDI e múltiplas visualizações.
**Problemas:** mesma inconsistência de escopo coletivo; ranking de gap não considera criticidade contextual além da diferença numérica.
**Problemas de UX:** diagnóstico ainda exige navegação manual para decisão/intervenção.
**Problemas de UI:** heatmap/radar/tabela podem gerar redundância cognitiva quando exibem o mesmo fato.
**Problemas de negócio:** gap maior não é automaticamente prioridade maior; não há rationale explícito.
**Problemas técnicos:** cálculo client-side sem contexto de autorização no selector.
**Estados ausentes:** prioridade acordada/adiada/justificada.
**Problemas de acessibilidade:** gráficos requerem alternativa tabular/semântica verificável.
**Problemas de consistência:** deveria ser uma etapa do workspace, não um destino isolado.
**Risco:** médio/alto.
**Prioridade:** **P2** após corrigir escopo.
**Recomendação:** "Prioridades" com rationale e CTA direto para ação.
**Veredito:** **IMPORTANTE, MAS DEVE SER REENQUADRADA.**

### Tela: Training Needs

**Objetivo:** agregar gaps para necessidades coletivas.
**Usuário:** Lead/Admin.
**Jornada:** decidir intervenção coletiva.
**O que funciona:** agrega gaps positivos por competência e sugere intervenção.
**Problemas:** recebe universo potencialmente incompleto para Lead; sobrepõe Gap Analysis e Capability Map.
**Problemas de UX:** gera outra tela para o mesmo momento de decisão.
**Problemas de UI:** sem problema visual principal; o problema é de arquitetura da informação.
**Problemas de negócio:** "necessidade de treinamento" reduz intervenção a treinamento; gap pode exigir prática, mentoria, exposição ou mudança de contexto.
**Problemas técnicos:** selector `teamTrainingNeeds()` usa todo `activeArchitects`.
**Estados ausentes:** decisão sobre intervenção, owner e acompanhamento coletivo.
**Problemas de acessibilidade:** não identificado bloqueador estático.
**Problemas de consistência:** duplicidade semântica com Capacidades/Prioridades.
**Risco:** burocracia e fragmentação.
**Prioridade:** **P3 funcional / QUICK WIN de IA.**
**Recomendação:** absorver em "Capacidades → Prioridades coletivas".
**Veredito:** **REDUNDANTE COMO TELA STANDALONE.**

### Tela: Assessments

**Objetivo:** autoavaliação, revisão, calibração e oficialização.
**Usuário:** Member + Lead.
**Jornada:** diagnóstico oficial.
**O que funciona:** lifecycle `Draft → In Review → Completed`; self bloqueia após envio; Lead/final só em revisão; Completed é fonte oficial; comentários têm autoria; snapshot preserva competência histórica; evidências aceitas aparecem como contexto.
**Problemas:** todo item novo nasce `self=1`, `leader=1`, `final=1` e target ausente cai para `3` (`repositories/assessments.ts:248-260`). Não há validação de completude antes de mudar status (`routes/api/assessments.ts:175-204`).
**Problemas de UX:** Lead global é inferido no frontend por role, não por relação; seleciona pessoas fora de escopo e descobre por 403. Conta `lead` vinculada a uma pessoa não consegue autoavaliar-se no frontend porque `isLead` bloqueia `canEditSelf`.
**Problemas de UI:** tabela densa, mas coerente para desktop; filtros por capacidade ajudam.
**Problemas de negócio:** um Assessment pode ser "Completed" com valores default nunca explicitamente avaliados — passa a ser fato oficial e gera gaps.
**Problemas técnicos:** falta estado nullable/touched/completeness por item; frontend e backend divergem no cálculo de papel contextual.
**Estados ausentes:** incompleto por competência, "não avaliado", checklist antes de submit/complete.
**Problemas de acessibilidade:** tabela e controles precisam teste real de teclado; formulários têm boa base semântica.
**Problemas de consistência:** CommentSection continua oferecendo formulário em Completed, embora backend bloqueie escrita.
**Risco:** **alto para integridade de decisão.**
**Prioridade:** **P1 (quase P0 de domínio).**
**Recomendação:** valores não avaliados devem ser `null`; marcar preenchimento; validar completude server-side; target obrigatório no catálogo; role contextual no frontend.
**Veredito:** **PARCIALMENTE VALIDADO — lifecycle melhorou, semântica de preenchimento ainda não é confiável.**

### Tela: Development Plans

**Objetivo:** transformar gaps em objetivos e ações.
**Usuário:** Member + Lead.
**Jornada:** planejamento e execução.
**O que funciona:** gap pode gerar ação sem inventar automaticamente tipo/prazo; lifecycle do plano existe; SMART opcional; status de ação; aprovação do Lead.
**Problemas:** item pode ser adicionado, alterado e removido em plano `Approved` ou `Completed`; backend não consulta status nas rotas de item.
**Problemas de UX:** tela diz "locked" mas mantém selects/botões habilitados; `canEdit` usa papel amplo, não Lead responsável.
**Problemas de UI:** estrutura por item é clara; status/nível/SMART legíveis.
**Problemas de negócio:** "Approved" não significa baseline acordada; "Completed" não é histórico imutável. Não há validação para concluir com itens incompletos/bloqueados ou sem evidência.
**Problemas técnicos:** `items` em JSONB; schema aceita current/target/owner/datas fornecidos pelo cliente sem conferir Assessment oficial; Evidence referencia ID textual interno do JSONB.
**Estados ausentes:** blocker reason, check-in, aprovação com autor/data, conclusão com outcome, histórico de alterações.
**Problemas de acessibilidade:** controles padrão adequados; dialogs precisam teste real.
**Problemas de consistência:** status do agregado não governa escrita dos filhos.
**Risco:** **muito alto.**
**Prioridade:** **P0.**
**Recomendação:** impor state machine no backend; Draft editável, Approved apenas execução/status conforme regra, Completed imutável; normalizar itens; auditar aprovação/conclusão.
**Veredito:** **INCONSISTENTE — BLOQUEIA PRODUÇÃO.**

### Tela: Learning Paths

**Objetivo:** catálogo de trilhas e progresso individual.
**Usuário:** Lead/Admin criam; pessoa/Lead acompanha progresso.
**Jornada:** intervenção de desenvolvimento.
**O que funciona:** progresso por pessoa, não compartilhado; autoria real do catálogo; item/progresso validados em endpoint específico.
**Problemas:** `GET /api/learning-paths` não aplica `visibleArchitectIds`; um usuário autenticado pode chamar a rota diretamente. Schema de criação aceita `progress` no corpo.
**Problemas de UX:** controles de progresso usam `isLeadCapable` e podem aparecer para Lead não responsável.
**Problemas de UI:** estrutura de catálogo e barras é adequada.
**Problemas de negócio:** concluir trilha não produz, por si só, evidência de domínio; conexão com PDI é fraca.
**Problemas técnicos:** `progress` JSONB é read-modify-write do array inteiro e admite perda de atualização concorrente; create usa client ID + upsert.
**Estados ausentes:** atribuição aceita/recusada, prazo, conexão explícita com ação do PDI.
**Problemas de acessibilidade:** barras de progresso devem possuir texto/ARIA equivalente; precisa teste real.
**Problemas de consistência:** rota GET foge da política de escopo usada em `/api/state`.
**Risco:** privacidade + concorrência.
**Prioridade:** **P1/P2.**
**Recomendação:** scope no GET; ignorar progress em create; normalizar assignment/progress; linkar atribuição a PDI/prioridade quando aplicável.
**Veredito:** **PARCIALMENTE VALIDADO.**

### Tela: Mentoring

**Objetivo:** registrar sessão, decisões, ações e follow-up.
**Usuário:** mentor/mentorado/Lead.
**Jornada:** intervenção e acompanhamento.
**O que funciona:** identidade do mentor é derivada da sessão autenticada; follow-up pode ser atualizado; ação pode virar item de PDI; UI exige campos relevantes.
**Problemas:** qualquer autenticado pode criar sessão para qualquer `menteeId` existente; a rota não exige relação de escopo/consentimento.
**Problemas de UX:** ausência de "meus mentorados/minhas mentorias" claramente orientada ao papel.
**Problemas de UI:** timeline e blocos de notas/decisões/ações são adequados.
**Problemas de negócio:** governança de quem pode declarar uma mentoria sobre quem é indefinida.
**Problemas técnicos:** client-provided ID + `ON CONFLICT DO UPDATE` permite colisão/alteração indevida de sessão conhecida; backend aceita notas/decisões/ações vazios apesar de UI exigir.
**Estados ausentes:** consentimento, cancelada, realizada, no-show, correção/auditoria.
**Problemas de acessibilidade:** sem bloqueador estático encontrado.
**Problemas de consistência:** validação de obrigatoriedade UI > API.
**Risco:** integridade de histórico profissional.
**Prioridade:** **P1.**
**Recomendação:** autorização explícita por relação; server UUID; sem upsert em POST; alinhar schema aos campos realmente obrigatórios.
**Veredito:** **PARCIALMENTE VALIDADO.**

### Tela: Competency Matrix

**Objetivo:** administrar modelo de capacidades e níveis esperados por papel.
**Usuário:** Admin.
**Jornada:** preparação do sistema.
**O que funciona:** arquivamento preserva histórico; competências ativas alimentam Assessment novo; snapshots protegem avaliações antigas; roles/níveis são configuráveis.
**Problemas:** nomenclatura "Competency Matrix" é menos clara que "Modelo de Capacidades"; `expected` JSONB não tem constraints fortes no banco.
**Problemas de UX:** deveria existir onboarding/configuração guiada para primeira implantação.
**Problemas de UI:** boa organização por categoria e níveis.
**Problemas de negócio:** alteração de expectativa ao longo do tempo ainda não é uma versão formal do modelo; snapshot protege Assessment, mas não há "model version" explícita.
**Problemas técnicos:** JSONB e validação Zod garantem aplicação, não integridade independente do banco.
**Estados ausentes:** versão publicada/rascunho, vigência do modelo.
**Problemas de acessibilidade:** tabelas requerem teste de navegação.
**Problemas de consistência:** `/settings` duplica parte das definições.
**Risco:** médio.
**Prioridade:** **P2**.
**Recomendação:** renomear "Modelo de Capacidades"; versionamento/vigência quando houver necessidade histórica mais forte.
**Veredito:** **VALIDADO COM RESSALVAS.**

### Tela: Cycles

**Objetivo:** administrar períodos e comparar evolução.
**Usuário:** Admin; leitura para demais.
**Jornada:** governança temporal.
**O que funciona:** Assessment e PDI pertencem a ciclo; ciclo em uso não é apagado; `setActiveCycleId` tenta sincronizar status.
**Problemas:** criação/edição permite definir `status: Active` diretamente sem fechar outros; `setActiveCycleId` aceita ID sem conferir existência; deletar ciclo ativo sem histórico não limpa necessariamente `app_settings`; não há validação `start <= end`/sobreposição.
**Problemas de UX:** select genérico de status expõe estado técnico, em vez de ações "Ativar/Encerrar".
**Problemas de UI:** visão de comparação é útil.
**Problemas de negócio:** Learning Paths, Mentoring e Evidence são explicitamente tratados como "sem ciclo", enfraquecendo a narrativa longitudinal.
**Problemas técnicos:** duas formas de alterar estado do ciclo; `activeCycleId` em `app_settings` não é FK.
**Estados ausentes:** transições formais Planned→Active→Closed, lock de período após uso, reabertura excepcional auditada.
**Problemas de acessibilidade:** sem bloqueador estático.
**Problemas de consistência:** `status` e `activeCycleId` ainda podem divergir por rotas alternativas.
**Risco:** histórico/semântica temporal.
**Prioridade:** **P1**.
**Recomendação:** uma única state machine transacional; ID validado; somente um Active por constraint/regra; temporalizar intervenções/evidências por ocorrência.
**Veredito:** **INCONSISTENTE.**

### Tela: Users

**Objetivo:** administrar role e vínculo usuário–profissional.
**Usuário:** Admin.
**Jornada:** administração.
**O que funciona:** endpoint de diretório é Admin-only; impede rebaixar último Admin; roles admin/lead/member existem.
**Problemas:** `architect_id` não é unique; vínculo pode ser duplicado. `lead_user_id` também não garante role de Lead/Admin no banco.
**Problemas de UX:** o modelo "conta" vs "pessoa" é complexo e merece explicação de vínculo.
**Problemas de UI:** adequada e restrita visualmente para Admin.
**Problemas de negócio:** bootstrap/self-registration conflita com esta administração formal.
**Problemas técnicos:** faltam constraints e fluxo de convite.
**Estados ausentes:** convite, suspenso, desativado, última autenticação.
**Problemas de acessibilidade:** sem achado crítico estático.
**Problemas de consistência:** identidade central é administrável aqui, mas também reivindicável no cadastro público da API.
**Risco:** alto.
**Prioridade:** **P0/P1 por dependência de SEC-001.**
**Recomendação:** tornar Users a única fonte de provisionamento após bootstrap/SSO.
**Veredito:** **BOM DESENHO LOCAL, MAS GOVERNANÇA GLOBAL INCONSISTENTE.**

### Tela: Reference

**Objetivo:** glossário de escala, cargos, ações e evidências.
**Usuário:** todos.
**Jornada:** suporte contextual.
**O que funciona:** conteúdo read-only e útil como referência.
**Problemas:** não constitui jornada autônoma.
**Problemas de UX:** obriga usuário a sair do contexto para entender conceito que deveria estar em tooltip/help local.
**Problemas de UI:** clara, porém pouco acionável.
**Problemas de negócio:** quase nenhum valor como módulo principal.
**Problemas técnicos:** nenhum relevante.
**Estados ausentes:** não aplicável.
**Problemas de acessibilidade:** sem achado crítico.
**Problemas de consistência:** parte do conteúdo duplica Modelo de Capacidades/Ciclos.
**Risco:** baixo; ruído de IA.
**Prioridade:** **P4 / QUICK WIN.**
**Recomendação:** remover da navegação primária; distribuir ajuda contextual.
**Veredito:** **COMPLEMENTAR, NÃO DEVE SER MÓDULO.**

### Tela: Estados sistêmicos — Loading, 404, Error

**Objetivo:** informar espera/falha e permitir recuperação.
**Usuário:** todos.
**Jornada:** transversal.
**O que funciona:** há `notFoundComponent`, `errorComponent`, AuthGate e tratamento padronizado de erro de API.
**Problemas:** loading de auth é apenas spinner visual sem texto/status acessível (`__root.tsx:194-199`). Operações otimistas críticas podem mostrar sucesso antes da confirmação remota.
**Problemas de UX:** feedback assíncrono não é uniforme entre operações.
**Problemas de UI:** estados globais existem.
**Problemas de negócio:** sucesso falso em Evidence/PDI pode comprometer confiança.
**Problemas técnicos:** `remote()` fire-and-forget em várias mutações.
**Estados ausentes:** partial success/conflito/concurrency padronizados.
**Problemas de acessibilidade:** spinner sem `role=status`/texto.
**Problemas de consistência:** comentários/status usam confirmação do servidor; outras operações não.
**Risco:** médio/alto.
**Prioridade:** **P2**.
**Recomendação:** mutations críticas server-confirmed; estado pending/error local; padrão único de toast.
**Veredito:** **PARCIALMENTE VALIDADO.**

---

## 8. Coerência entre Telas

### Fluxo coerente existente

```text
Assessment Completed
→ Gap Analysis
→ CTA para PDI
→ item de PDI
→ Evidence vinculável
→ review do Lead
→ Evidence aceita aparece no Assessment futuro
```

Essa é a principal melhoria estrutural confirmada em relação às versões anteriores.

### Rupturas

**Dashboard → análises coletivas**
O dashboard pode contar pessoas cujo Assessment foi filtrado por autorização como "não iniciado". A próxima tela não está vendo o mesmo universo semântico.

**Gap Analysis → PDI**
O contexto de competência é preservado melhor que antes, mas o backend permite criar item com valores arbitrários; a continuidade existe na UI, não como invariante do domínio.

**PDI Approved/Completed → edição**
A narrativa diz "acordado/concluído", enquanto a tela e API continuam permitindo mutação dos itens. Contradição direta.

**Perfil → Assessment histórico**
`Tela Perfil → Tela Assessment` perde `cycleId`; "ver histórico" pode abrir o ciclo ativo atual.

**Assessment → Evidence**
Evidência aceita é mostrada como contexto, mas não há mecanismo explícito para o Lead registrar "esta evidência justifica/ não justifica mudança de nível" com rationale longitudinal.

**Cycles → Learning/Mentoring/Evidence**
O produto afirma evolução por ciclo, mas parte relevante das intervenções não possui associação temporal com ciclo. Isso dificulta responder "o que foi feito entre A e B?".

**Navigation → Role**
`NAV_GROUPS` é estático e todos os 13 destinos são exibidos a todos os papéis. O backend é mais restritivo que a arquitetura de informação.

---

## 9. Análise de User Stories

### US-01 — Autoavaliação

**Como** profissional técnico
**quero** avaliar meu nível por competência
**para** iniciar um diagnóstico de desenvolvimento.

**Critérios:** Draft editável pelo dono; envio congela self; não pode concluir sem avaliação explícita; erro persiste sem corromper; somente próprio escopo.

**Implementação:** **ATENDE PARCIALMENTE.** Lifecycle/ownership atendem; completude não.

### US-02 — Revisão do Lead

**Como** Tech Lead responsável
**quero** revisar e calibrar o Assessment
**para** gerar fotografia oficial confiável.

**Implementação:** **ATENDE PARCIALMENTE.** Backend usa relação real de Lead; frontend usa role ampla e defaults podem ser oficializados.

### US-03 — Transformar gap em PDI

**Como** profissional/Lead
**quero** transformar uma prioridade em ação
**para** executar desenvolvimento concreto.

**Implementação:** **ATENDE PARCIALMENTE.** CTA e formulário existem; backend não preserva a integridade diagnóstica e lifecycle não governa item.

### US-04 — Aprovar PDI

**Como** Lead
**quero** aprovar um plano
**para** registrar o acordo de desenvolvimento.

**Implementação:** **NÃO ATENDE semanticamente.** A transição existe, mas Approved continua livremente mutável.

### US-05 — Executar Learning Path

**Como** profissional
**quero** acompanhar meu progresso individual
**para** saber o que completei.

**Implementação:** **ATENDE PARCIALMENTE.** Progresso individual correto; GET e concorrência precisam correção.

### US-06 — Registrar mentoria

**Como** mentor
**quero** registrar decisões e ações
**para** manter continuidade do acompanhamento.

**Implementação:** **ATENDE PARCIALMENTE.** Autoria real/follow-up existem; qualquer autenticado pode criar sessão sobre qualquer pessoa.

### US-07 — Evidenciar evolução

**Como** profissional
**quero** registrar evidência vinculada ao PDI
**para** demonstrar aplicação concreta.

**Implementação:** **ATENDE PARCIALMENTE.** Vínculo e review existem; POST/upsert, false-success e integridade do item de PDI fragilizam confiança.

### US-08 — Revisar evidência

**Como** Lead responsável
**quero** aceitar ou pedir melhoria
**para** qualificar o que será usado na conversa de evolução.

**Implementação:** **ATENDE**, com ressalva de ausência de histórico de múltiplas revisões.

### US-09 — Ver evolução histórica

**Como** profissional/Lead
**quero** comparar ciclos e abrir o detalhe antigo
**para** demonstrar evolução.

**Implementação:** **ATENDE PARCIALMENTE / link histórico quebrado.**

### US-10 — Administrar acesso corporativo

**Como** administrador
**quero** controlar quem possui acesso e a qual pessoa está vinculado
**para** proteger dados de carreira.

**Implementação:** **NÃO ATENDE** enquanto self-registration aceitar vínculo de `architectId`.

---

## 10. Análise de Produto / PO

| Capacidade                                    | Classificação              | Valor                               | Decisão                                   |
| --------------------------------------------- | -------------------------- | ----------------------------------- | ----------------------------------------- |
| Assessment                                    | **CORE**                   | diagnóstico confiável               | manter e corrigir completude              |
| Modelo de Capacidades                         | **CORE / ADMIN**           | define expectativa técnica          | manter                                    |
| Gap Analysis                                  | **CORE**                   | identifica necessidade              | manter, integrar em Prioridades           |
| PDI                                           | **CORE**                   | transforma gap em ação              | manter e reconstruir governança           |
| Evidence + Review                             | **CORE**                   | demonstra execução/aprendizado      | manter e fortalecer                       |
| Cycles                                        | **CORE**                   | cria temporalidade                  | manter e corrigir state machine           |
| Learning Paths                                | **IMPORTANTE**             | intervenção estruturada             | manter como meio, não fim                 |
| Mentoring                                     | **IMPORTANTE**             | intervenção relacional              | manter com governança                     |
| Capability Map                                | **IMPORTANTE**             | gestão coletiva de capacidade       | integrar em Capacidades                   |
| Training Needs                                | **REDUNDANTE como módulo** | agrega gap                          | incorporar em Capacidades/Desenvolvimento |
| Team/Pessoas                                  | **IMPORTANTE**             | navegação e administração           | tornar role-aware                         |
| Users                                         | **CORE ADMIN**             | segurança/acesso                    | manter                                    |
| Reference                                     | **COMPLEMENTAR**           | ajuda conceitual                    | retirar da navegação primária             |
| 9-Box / Development Score / SWOT / OKR nativo | **NÃO FAZER agora**        | valor insuficiente/governança fraca | manter removidos                          |

**Pergunta:** se Training Needs ou Reference fossem removidos como páginas, o produto perderia valor?
**Resposta:** não materialmente; o conteúdo pode viver em contextos mais naturais.

---

## 11. Análise do Domínio de PDI

### O que está correto

- diagnóstico baseado em expectativa do papel;
- Assessment oficial separado de Draft/In Review;
- gap derivado, não cadastrado manualmente;
- PDI como conjunto de ações;
- Evidence como elemento verificável;
- review independente do Lead;
- ciclos para comparar evolução;
- Learning e Mentoring tratados como intervenções.

### Gaps conceituais

1. **Assessment sem estado "não avaliado".** Nível 1 default é dado, não ausência.
2. **PDI não é um acordo imutável quando aprovado/concluído.**
3. **Conclusão do plano não exige resultado mínimo.** Pode completar sem todos os itens, sem rationale ou evidência.
4. **Blocked é pobre.** Falta motivo, data, owner do desbloqueio e check-in.
5. **Evidência revisada não possui histórico de decisões.** O último review substitui o estado anterior.
6. **Intervenções não têm temporalidade de ciclo.** Dificulta atribuir evolução a um período.
7. **Não há formalização de check-in.** PDI é atualizado, mas acompanhamento é implícito.
8. **Evolução de competência é inferida por novo Assessment, o que é correto, porém o sistema deveria tornar a cadeia evidencial visível.**

### Ciclo de vida recomendado do PDI

```text
Draft
  → solicitar acordo
Awaiting Approval
  → Lead aprova
Active
  ├─ check-ins
  ├─ ações In Progress / Blocked / Completed
  ├─ evidências Pending / Accepted / Improvement
  → revisão de encerramento
Completed
  → somente leitura
Archived/Historical
```

Não é necessário adotar exatamente esses nomes; é necessário adotar a **semântica**.

---

## 12. Análise UX

### Clareza

**6/10.** Rótulos locais são bons, mas o mapa global continua orientado a módulos.

### Navegação

**5/10.** Sidebar agrupou destinos, porém continua com 13 rotas estáticas para todos os papéis. Mobile replica todos em uma faixa horizontal (`AppShell.tsx:435-445`).

### Feedback

**5/10.** Status críticos usam resposta do servidor em alguns fluxos, mas várias gravações são otimistas e toasts podem confirmar antes da persistência.

### Formulários

**7/10.** Uso frequente de labels, validação e estados; Mentoring e Team melhoraram. Backend não espelha todas as obrigações.

### Carga cognitiva

**Média/alta.** Um profissional ocupado ainda precisa saber a diferença operacional entre Gap, Training Needs, PDI, Learning Path, Mentoring e Evidence para concluir uma história que deveria ser apresentada como uma única jornada.

---

## 13. Análise de Usabilidade

**Pergunta:** um profissional técnico ocupado conseguiria usar sem treinamento?
**Resposta:** **PARCIALMENTE.** Operações isoladas são compreensíveis; a sequência correta e a governança do ciclo ainda exigem conhecimento do produto.

Principais fricções:

- falta de "o que faço agora?";
- falta de fila de pendências do Lead;
- pessoa/Lead veem módulos administrativos/organizacionais irrelevantes;
- seletores permitem escolher objetos fora do escopo e depois sofrer 403;
- histórico não abre necessariamente o ciclo selecionado;
- ações optimisticamente "salvas" podem falhar depois;
- telas analíticas apresentam múltiplas representações do mesmo diagnóstico.

---

## 14. Análise UI / Design

**PARCIALMENTE VALIDADO por código + screenshots históricos.**

Pontos positivos:

- componentes de superfície, cards, badges, níveis e botões consistentes;
- hierarquia tipográfica clara;
- grids responsivos e overflow de tabelas;
- dark/light/system;
- i18n PT/EN;
- uso consistente de Lucide e primitives Radix.

Pontos de atenção:

- densidade de telas como Assessment/PDI é alta;
- mobile recebe 13 destinos horizontais;
- dashboards/gráficos precisam priorizar ação e não ornamentação;
- status/nível precisam continuar legíveis sem depender apenas de cor.

**Não foi detectado motivo para uma redesign estética ampla antes de corrigir P0/P1.**

---

## 15. Design System

**Estado: BOM / 7,5 de 10.**

Evidências:

- Tailwind 4;
- Radix UI;
- biblioteca `src/components/ui/*` ampla e reutilizável;
- `ui-bits` para padrões do produto;
- testes de design tokens/chart/scale;
- variants por componentes e utilitário `cn`.

Melhorias:

- documentar componentes semânticos do domínio, não apenas primitives;
- criar padrões oficiais de `AsyncAction`, `EmptyState`, `PermissionState`, `WorkQueueItem`, `StatusTimeline`;
- manter tokens de nível/status centralizados;
- evitar classes ad hoc para estados semânticos.

---

## 16. Acessibilidade

### Achados estáticos

- **P2:** `<html lang="en">` fixo apesar de UI PT/EN (`src/routes/__root.tsx:142-153`). Deve refletir locale ativo.
- **P3:** loading de autenticação é spinner sem texto/`role=status` (`__root.tsx:194-199`).
- **Positivo:** sidebar resize possui teclado e ARIA; links/botões usam elementos semânticos; vários inputs possuem labels/`aria-invalid`; Radix melhora dialogs/popovers.
- **NÃO VALIDÁVEL:** contraste WCAG mensurado, leitor de tela real, sequência de foco, zoom 200/400%, voice control e touch target em dispositivo.

### Severidade

- locale incorreto: **P2**;
- spinner: **P3**;
- gráficos sem validação de alternativa não visual: **P2 potencial**, precisa teste;
- mobile nav extensa: **P2 usabilidade/acessibilidade cognitiva**.

---

## 17. Frontend

### Arquitetura

React 19 + TanStack Router/Start + React Query + TypeScript + Zod + store própria sobre snapshot `/api/state`.

**Pontos fortes:**

- tipagem consistente;
- selectors centralizados e cacheados;
- React Query para hidratação;
- testes unitários/integrados de regras importantes;
- módulos removidos de fato do route tree;
- estado oficial de Assessment encapsulado em selector;
- design system reutilizável.

### Problemas

1. **Role ≠ contexto:** `isLeadCapable()` é usado onde deveria ser "Lead responsável por esta pessoa".
2. **Snapshot parcialmente escopado + roster total:** gera semântica incorreta em analytics.
3. **Mutações optimistic/fire-and-forget em dados de carreira:** Evidence, PDI items, Mentoring, Learning Path etc. (`store.tsx:324-415`).
4. **Componentes/rotas grandes:** Assessments ~654 linhas, perfil ~642, PDI ~641, Competency Matrix ~545, Learning ~537, AppShell ~522. Não é defeito por contagem isolada, mas há mistura crescente de regra, IO e apresentação.
5. **IDs gerados no cliente por `Date.now()`** em evidências e outras entidades — inadequado como autoridade de identidade.
6. **Menu não role-aware.**
7. **Sem E2E encontrado no repositório**, embora Playwright esteja em devDependencies.

### Recomendação arquitetural

- `usePermissionsFor(architectId)` derivado de usuário + roster escopado;
- React Query mutations aguardadas para writes de negócio;
- server IDs;
- extrair use cases/hooks de Assessment/PDI/Evidence;
- route-level data scopes em vez de snapshot global para módulos de escala;
- E2E para as jornadas críticas.

---

## 18. Backend

### Arquitetura

Fastify + TypeScript + Zod + Postgres + Redis + repositories + auth scope helpers + audit hook.

**Pontos fortes:**

- módulos de rota por agregado;
- Zod na borda;
- autenticação global para `/api/*` protegido (`app.ts:102-108`);
- erro de constraint traduzido;
- CORS allowlist;
- `canActFor/isLeadOf` melhoraram autorização contextual;
- audit log global;
- password hashing scrypt;
- cache com invalidação.

### Problemas

- invariantes de negócio ainda dispersas nas rotas e ausentes nos repositórios/banco;
- POSTs importantes usam `ON CONFLICT(id) DO UPDATE`, transformando criação em upsert com IDs do cliente;
- state machine de PDI não governa itens;
- inexistência de camada de use-case/domain service começa a pesar conforme regras de lifecycle crescem;
- `/api/state` monta estado completo e só depois filtra por usuário;
- sem rate limiting, Helmet/CSP observados na aplicação;
- produção pode iniciar com JWT secret default;
- bootstrap do primeiro admin não é atômico.

**Veredito backend:** base boa, governança insuficiente para dado corporativo sensível.

---

## 19. API

### Pontos positivos

- status HTTP em geral coerentes (201/204/400/403/404/409);
- schemas por rota;
- endpoints de status separados para Assessment/PDI;
- review de Evidence separado do create;
- listagens de Assessment/PDI/Evidence/Mentoring aplicam escopo em grande parte.

### Achados relevantes

| Endpoint/área                            | Achado                                                                |         Prioridade |
| ---------------------------------------- | --------------------------------------------------------------------- | -----------------: |
| `POST /api/auth/register`                | público + `architectId` controlado pelo cliente                       |             **P0** |
| `POST/PATCH/DELETE /api/plans/.../items` | não respeitam status do PDI                                           |             **P0** |
| `GET /api/learning-paths`                | não aplica scope                                                      |             **P1** |
| `POST /api/evidences`                    | ID do cliente + upsert permite colisão/overwrite de recurso conhecido |             **P1** |
| `POST /api/mentoring-sessions`           | qualquer autenticado pode criar para qualquer mentee; upsert por ID   |             **P1** |
| `POST /api/learning-paths`               | criação recebe `progress` e usa upsert                                |             **P2** |
| `PUT /api/settings/active-cycle`         | não valida existência antes de gravar setting                         |             **P1** |
| `POST/PATCH /api/cycles`                 | permite status Active direto e potencial múltiplo Active              |             **P1** |
| `/api/cache/stats`, `/api/cache/flush`   | qualquer autenticado                                                  |             **P2** |
| listagens/snapshot                       | sem paginação/versionamento/concurrency token                         | **P2** para escala |

### API versioning

**INEXISTENTE (`/api/...`).** Não é P0 para implantação controlada, mas a evolução de clientes/integrações futuras justificará `/api/v1` ou versionamento contratual.

---

## 20. Modelagem de Dados

### Avaliação geral

**5/10.** O esquema representa o domínio, mas parte das coleções JSONB já ultrapassou o pressuposto original do próprio comentário do schema.

O header afirma que itens JSONB "são sempre lidos e escritos juntos e nunca consultados isoladamente" (`schema.sql:1-4`). Isso não é mais verdade:

- itens de Assessment são editados/comentados individualmente;
- itens de PDI são PATCH/DELETE individualmente e Evidence os referencia por ID;
- progresso de Learning Path é alterado por `(architectId,itemId)`.

### Problemas estruturais

1. `development_plan_item_id` em Evidence é `TEXT`, sem FK possível para item dentro de JSONB.
2. exclusão de item de PDI pode deixar Evidence órfã semanticamente.
3. `learning_paths.progress` é array JSONB atualizado por read-modify-write; concorrência pode perder atualização.
4. `users.architect_id` não é unique.
5. statuses/roles/datas não possuem `CHECK` no banco.
6. core de PDI/Assessment não possui `created_at/updated_at/approved_at/completed_at` suficientes.
7. tabelas legadas (`swots`, `okrs`, `certifications`, `development_philosophy`) continuam sendo criadas em baseline novo, apesar de removidas do produto ativo.
8. migração de certificação inventa `01/01/<ano>` a partir de dado que tinha apenas ano (`schema.sql:491-510`).
9. não há entidade `organization/team`; modelo assume uma instância/estrutura relativamente plana.

### Normalização recomendada

Priorizar:

- `assessment_items` + `assessment_comments`;
- `development_plan_items`;
- `learning_path_assignments`;
- `learning_path_item_progress`;
- opcionalmente `evidence_reviews` para histórico.

Não é necessário normalizar todo JSONB; normalize onde já existe identidade, concorrência, referência externa ou histórico.

---

## 21. Integridade entre Camadas

### Divergência 1 — PDI

```text
UI: "Completed / locked"
→ Frontend: canEdit continua true
→ API: item PATCH/POST/DELETE permitido
→ Repository: altera JSONB sem checar status
→ Banco: status Completed permanece
```

**Resultado:** significado de "Completed" é falso.

### Divergência 2 — escopo

```text
Backend /api/state: filtra assessments/PDIs/evidências
→ mantém roster inteiro
→ Frontend activeArchitects = roster inteiro
→ analytics usam população inteira + dados visíveis parciais
→ UI chama ocultação de "não avaliado"
```

**Resultado:** ausência por autorização vira ausência de dado.

### Divergência 3 — Assessment

```text
UI: usuário pensa "ainda não avaliei"
→ Repository: item já é nível 1
→ transição não valida preenchimento
→ Completed: vira fato oficial
→ Gap/Analytics: usam como avaliação real
```

### Divergência 4 — acesso

```text
UI de registro comum: não envia architectId
→ API pública aceita architectId
→ Banco aceita múltiplos users para o mesmo architect
→ scope considera user.architectId como ownership
```

### Divergência 5 — histórico

```text
Perfil lista Assessment do ciclo X
→ Link envia somente architectId
→ Assessments usa activeCycleId Y
```

---

## 22. Segurança

### P0 — identidade/cadastro público

Descrito em SEC-001. Deve bloquear go-live.

### P1 — recurso criado por client ID + upsert

**Evidence:** `createEvidence()` usa `INSERT ... ON CONFLICT(id) DO UPDATE` e não altera `architect_id` no conflito. A autorização do POST verifica `body.architectId`, não o recurso existente. Com ID conhecido, há vetor de alteração indevida do conteúdo de Evidence de terceiro. `repositories/learning.ts:324-355`.

**Mentoring:** padrão semelhante em `createMentoringSession()` (`learning.ts:239-267`).

**Learning Path:** create também é upsert (`learning.ts:50-77`), podendo atravessar governança de autoria em colisão conhecida.

### P1 — segredo JWT de produção

`JWT_SECRET` possui default válido e a aplicação não falha em `NODE_ENV=production` se ele não for sobrescrito (`config/env.ts:26-28`).

### P1/P2 — ausência de anti-abuse

Não foi encontrado rate limiting de login/register. Para dado de carreira corporativo, adotar rate limit, lockout progressivo/observabilidade e preferencialmente SSO/MFA corporativo.

### P2 — token em localStorage

`api.ts:57-76`. Amplifica impacto de XSS. Se mantido, exigir CSP forte e superfície XSS mínima; preferível sessão/cookie HttpOnly quando arquitetura permitir.

### P2 — cache operacional

`/api/cache/stats` e `/api/cache/flush` estão acessíveis a qualquer autenticado (`routes/api/analytics.ts:14-20`). Restringir a Admin/ops.

### P2 — roster

Member/Lead recebem roster inteiro, inclusive e-mail. Validar base legal/política interna e minimização de dados.

### Controles positivos

- scrypt + salt;
- generic login error;
- JWT verifica usuário no banco a cada request;
- CORS explicitamente configurável;
- audit log com autoria;
- admin-only para diretório de contas;
- scope helpers deny-by-default para Lead não atribuído;
- Evidence review apenas Lead responsável.

---

## 23. Performance

**NÃO VALIDADA por benchmark; apenas riscos estáticos.**

### Frontend

- snapshot `/api/state` traz grande conjunto de dados de uma vez;
- analytics são recalculados client-side, embora selectors possuam caches locais;
- telas/tabelas podem crescer sem paginação.

### Backend

- `getAppState()` consulta todos os agregados em paralelo e filtra por usuário **depois** de recuperar/cachear o estado completo (`repositories/state.ts:39-77`);
- Admin recebe histórico integral da instância;
- endpoints listam sem paginação;
- filtros sobre JSONB (`assigned_to`, competências, etc.) tendem a scans sem índices GIN específicos;
- progress de Learning Path grava array inteiro.

### Banco

Índices básicos de FK/lookup existem, mas o desenho JSONB limita índices relacionais e integridade. Escala de centenas de pessoas pode ser aceitável; milhares/ciclos longos exigirão revisão. Não há evidência para afirmar um limite real sem carga.

---

## 24. Qualidade de Código

### Pontos fortes

- TypeScript estrito o suficiente para tipos de domínio;
- módulos claros no backend;
- schemas centralizados;
- comentários explicam decisões de auditorias anteriores;
- testes cobrem lifecycle, comentários, learning progress, mentoring–PDI, evidence loop, selectors, design tokens;
- tratamento de erro de Postgres centralizado;
- audit log global.

### Dívidas

| Dívida                                            | Impacto                       | Urgência | Recomendação                       |
| ------------------------------------------------- | ----------------------------- | -------: | ---------------------------------- |
| regras de domínio espalhadas entre route/frontend | regressão semântica           |     alta | domain services/state machines     |
| route components >500–650 linhas                  | manutenção/testes             |    média | separar orchestration/presentation |
| optimistic writes de dados críticos               | confiança                     |     alta | mutations aguardadas               |
| IDs client-side                                   | segurança/integridade         |     alta | UUID servidor                      |
| JSONB com identidade própria                      | integridade/concorrência      |     alta | normalização seletiva              |
| docs/screenshots desatualizados                   | reintrodução de feature morta |    média | docs as-code/ADRs                  |
| sem E2E encontrado                                | regressão de jornada          |    média | Playwright critical paths          |

---

## 25. Estados da Aplicação

| Estado                | Assessment     | PDI               | Evidence        | Learning       | Mentoring         | Observação                                            |
| --------------------- | -------------- | ----------------- | --------------- | -------------- | ----------------- | ----------------------------------------------------- |
| Loading               | parcial        | parcial           | parcial         | parcial        | parcial           | global existe, por ação é desigual                    |
| Empty                 | sim            | sim               | sim             | sim            | sim               | boa cobertura local                                   |
| Success               | sim            | sim               | sim             | sim            | sim               | alguns são falsamente otimistas                       |
| Error                 | sim/parcial    | sim/parcial       | global/rollback | global         | global            | falta padrão uniforme                                 |
| Partial success       | não explícito  | não               | não             | não            | não               | **GAP**                                               |
| Validation error      | sim            | parcial           | parcial         | parcial        | UI melhor que API | backend precisa alinhar                               |
| Permission denied     | backend sim    | backend sim       | backend sim     | parcial        | parcial           | UI frequentemente mostra ação proibida                |
| Not found             | sim            | sim               | sim             | sim            | sim               | adequado                                              |
| Conflict              | sim            | lifecycle parcial | pouco           | pouco          | pouco             | concurrency não tratada                               |
| Expired session       | 401/AuthGate   | transversal       | transversal     | transversal    | transversal       | existe tecnicamente                                   |
| Offline/intermitência | não específico | não específico    | não específico  | não específico | não específico    | não requisito declarado; falha de rede deve ser clara |

---

## 26. Responsividade

**PARCIALMENTE VALIDADO.**

- Desktop: arquitetura favorece uso corporativo; sidebar, grids, tabelas e cards adequados.
- Tablet/mobile: sidebar desaparece e é substituída por nav horizontal com todos os 13 destinos (`AppShell.tsx:435-445`). É funcional tecnicamente, mas ruim cognitivamente e pouco escalável.
- Tabelas usam overflow; evita quebra, mas não cria experiência mobile própria.
- Modais e forms usam primitives responsivos em boa parte.

**Recomendação:** bottom/nav ou menu condensado role-aware em mobile; priorizar 2–5 destinos por papel.

---

## 27. Glossário Canônico

| Termo recomendado                  | Definição                                                            | Evitar/confundir com                                 |
| ---------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| **Pessoa / Profissional**          | indivíduo técnico que possui histórico                               | "Architect" na UI se produto for além de arquitetura |
| **Modelo de Capacidades**          | catálogo de capacidades e expectativa por papel                      | "Competency Matrix" como nome técnico                |
| **Capacidade / Competência**       | habilidade/conhecimento avaliado                                     | alternância Skill/Competency sem regra               |
| **Assessment / Avaliação**         | fotografia do ciclo, com self e revisão                              | score informal                                       |
| **Nível esperado**                 | expectativa para o papel                                             | "meta" genérica                                      |
| **Gap / Lacuna**                   | esperado − nível final oficial                                       | prioridade automática                                |
| **Prioridade de desenvolvimento**  | gap escolhido para agir, com rationale                               | todo gap                                             |
| **PDI / Plano de Desenvolvimento** | acordo de objetivos e ações                                          | lista de tarefas                                     |
| **Ação de desenvolvimento**        | unidade executável do PDI                                            | "atividade" quando significar algo diferente         |
| **Trilha de aprendizagem**         | intervenção estruturada de itens                                     | progresso de competência                             |
| **Mentoria**                       | intervenção relacional com decisão/ação                              | feedback avulso                                      |
| **Evidência**                      | artefato/realização que sustenta evolução                            | prova automática de nível                            |
| **Review de evidência**            | decisão do Lead sobre qualidade/adequação                            | Assessment de competência                            |
| **Check-in**                       | revisão periódica de execução do PDI                                 | conclusão                                            |
| **Ciclo de desenvolvimento**       | janela temporal de Assessment/PDI                                    | ciclo técnico do sistema                             |
| **Evolução**                       | mudança demonstrada entre avaliações, contextualizada por evidências | score composto                                       |

---

## 28. Gaps Funcionais

### GAP CRÍTICO

- provisionamento corporativo seguro de identidade;
- imutabilidade/governança real do PDI Approved/Completed;
- Assessment com "não avaliado" e completude obrigatória.

### GAP ALTO

- home/analytics por papel e escopo;
- histórico de ciclo com deep-link correto;
- state machine de ciclo única;
- governança de mentoria;
- integridade de Evidence–PDI;
- work queue do Lead / Minha Evolução do Member.

### GAP MÉDIO

- check-ins de PDI;
- histórico de review de evidência;
- temporalidade de Learning/Mentoring/Evidence;
- model version do catálogo;
- normalização seletiva;
- E2E de jornadas.

### GAP BAIXO

- remover Reference da nav;
- `lang` dinâmico;
- loading acessível;
- consolidar nomenclaturas.

---

## 29. Problemas Críticos

### SEC-001 — Cadastro público pode reivindicar identidade profissional

- **Categoria:** Segurança / Autorização
- **Localização:** `routes/auth.ts`, `auth/users.ts`, `schema.sql`, `LoginScreen.tsx`
- **Evidência:** registro público aceita `architectId`; create persiste; vínculo não unique.
- **Impacto:** leitura/escrita de Assessment, PDI, Evidence etc. em nome de outra pessoa.
- **Severidade:** P0
- **Causa provável:** bootstrap e onboarding modelados como self-registration permanente.
- **Recomendação:** bootstrap único atômico; após isso somente convite/SSO/Admin; server-side linking + unique constraint.
- **Prioridade:** imediata.

### DOM-001 — PDI "concluído" continua mutável

- **Categoria:** Domínio / Integridade
- **Localização:** `routes/api/development.ts`, `repositories/development.ts`, `development-plans.tsx`
- **Evidência:** item routes não consultam plan.status; UI locked não desabilita `canEdit`.
- **Impacto:** histórico de acordo e conclusão não confiável.
- **Severidade:** P0
- **Causa provável:** state machine implementada apenas no endpoint de status.
- **Recomendação:** invariantes centralizadas e enforcement backend/repository + UI.
- **Prioridade:** imediata.

### DOM-002 — Assessment oficial pode ser concluído sem avaliação explícita

- **Categoria:** Domínio / Qualidade de dados
- **Localização:** `repositories/assessments.ts:248-260`, `routes/api/assessments.ts:175-204`
- **Evidência:** defaults 1/1/1 + target fallback 3; transição sem completeness check.
- **Impacto:** gaps falsos e decisões incorretas.
- **Severidade:** P1 crítico
- **Recomendação:** null/touched + validação server-side.

### ANA-001 — Escopo de dados gera analytics semanticamente falsos

- **Categoria:** Produto / Autorização / Analytics
- **Localização:** `auth/scope.ts:54-91`, `selectors.ts:84-92,188-216`, `index.tsx:48-79`
- **Impacto:** "sem acesso" vira "não avaliado".
- **Severidade:** P1
- **Recomendação:** população visível canônica ou aggregates server-side role-aware.

### IDOR-001 — POST + upsert por client ID permite sobrescrita indevida

- **Categoria:** Segurança / Integridade
- **Localização:** `repositories/learning.ts` create Evidence/Mentoring/Learning Path
- **Impacto:** mutação de recurso existente por colisão/ID conhecido.
- **Severidade:** P1
- **Recomendação:** UUID servidor; create apenas INSERT; update por rota própria autorizada contra recurso existente.

---

## 30. Problemas por Prioridade

| ID        | Prioridade | Categoria      | Localização / evidência                                                    | Problema                                                    | Impacto                                         | Causa provável                                          | Recomendação                                    |
| --------- | ---------: | -------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| SEC-001   |         P0 | Segurança      | `auth.ts:23-45`; `users.ts:80-90`; `schema.sql:131-140`                    | Registro público pode reivindicar `architectId`             | takeover/duplicidade de identidade profissional | bootstrap tratado como self-service permanente          | convite/SSO + vínculo server-side + unique link |
| DOM-001   |         P0 | PDI            | `development.ts:50-87,135-148`; `development-plans.tsx:81-99,217-337`      | Approved/Completed continuam mutáveis                       | histórico e acordo não confiáveis               | state machine aplicada só ao status do agregado         | governar item por status no backend e UI        |
| DOM-002   |         P1 | Assessment     | `repositories/assessments.ts:248-260`; `routes/api/assessments.ts:175-204` | defaults 1/1/1 podem virar avaliação oficial                | gaps falsos/decisão errada                      | ausência modelada como nível real                       | `null`/touched + completeness server-side       |
| ANA-001   |         P1 | Analytics      | `scope.ts:54-91`; `selectors.ts:84-92,188-216`; `index.tsx:48-79`          | dados invisíveis viram "não avaliados"                      | indicadores incorretos                          | roster e records usam populações diferentes             | população canônica/aggregates role-aware        |
| AUTH-002  |         P1 | Segurança      | `routes/api/learning.ts:14-16`                                             | listagem de trilhas ignora scope                            | exposição de assignments/progress               | endpoint ficou fora da política transversal             | aplicar `visibleArchitectIds`/filtro de recurso |
| IDOR-001  |         P1 | Segurança      | `repositories/learning.ts:324-355`                                         | create de Evidence sobrescreve ID existente                 | alteração indevida de recurso                   | POST modelado como upsert com ID do cliente             | UUID servidor + INSERT-only + PATCH autorizado  |
| IDOR-002  |         P1 | Integridade    | `repositories/learning.ts:239-267`                                         | create de Mentoring é upsert por ID                         | corrupção de histórico                          | client ID como chave de autoridade                      | UUID servidor + INSERT-only                     |
| MENT-001  |         P1 | Negócio        | `routes/api/learning.ts:156-168`                                           | qualquer autenticado registra mentoria para qualquer mentee | poluição de histórico profissional              | autoria foi corrigida, escopo do mentee não             | definir relação/consentimento/canActFor         |
| AUTH-003  |         P1 | Identidade     | `schema.sql:131-140`                                                       | múltiplos usuários podem possuir o mesmo perfil             | ownership ambíguo                               | FK sem unicidade                                        | unique partial index + regra de provisionamento |
| CYC-001   |         P1 | Ciclos         | `routes/api/cycles.ts:16-35,53-57`; `catalog.ts:284-294,340-353`           | status Active pode ser alterado por caminhos independentes  | ciclos incoerentes                              | CRUD genérico coexistindo com ação de negócio           | state machine transacional única                |
| CYC-002   |         P1 | Ciclos         | `repositories/catalog.ts:340-353`                                          | activeCycleId aceita ID inexistente                         | contexto global inválido                        | setting textual sem FK/lookup prévio                    | validar existência + transação                  |
| HIST-001  |         P1 | Jornada        | `architects.$architectId.tsx:190-208`                                      | histórico abre Assessment do ciclo ativo                    | usuário vê contexto errado                      | search param não inclui ciclo                           | deep-link com `architectId+cycleId`             |
| PDI-002   |         P1 | Domínio        | `routes/schemas.ts:70-89`                                                  | cliente controla fatos derivados do diagnóstico             | PDI pode contradizer Assessment                 | contrato espelha objeto UI em vez de comando de domínio | derivar/validar current/target/owner/datas      |
| DATA-001  |         P1 | Dados          | `schema.sql:61-68,584-587`                                                 | Evidence aponta por TEXT para item dentro de JSONB          | órfãos/integridade não garantida                | item ganhou identidade externa sem normalização         | normalizar `development_plan_items` + FK        |
| SEC-002   |         P1 | Segurança      | `config/env.ts:26-28`                                                      | produção pode usar secret default                           | falsificação de token se default conhecido      | configuração permissiva                                 | hard-fail se prod + secret default/ausente      |
| SEC-003   |      P1/P2 | Segurança      | `app.ts`; dependências do backend                                          | login/register sem anti-abuse observado                     | brute force/abuso                               | auth MVP sem controles operacionais                     | rate limit + SSO/MFA conforme contexto          |
| UX-001    |      P1/P2 | UX             | `api.ts:49-50`; `assessments.tsx:76-94`; `development-plans.tsx:81-99`     | UI autoriza por role onde backend autoriza por relação      | 403 tardio/confusão                             | helper genérico reutilizado além do escopo              | helper contextual por pessoa/recurso            |
| EVD-001   |      P1/P2 | UX/Integridade | `architects.$architectId.tsx:390-419`; `store.tsx:385-388`                 | sucesso exibido antes do servidor                           | falsa confiança/perda de dado                   | fire-and-forget optimistic mutation                     | await server + pending/error local              |
| DATA-002  |         P2 | Concorrência   | `repositories/learning.ts:181-213`                                         | atualização grava array inteiro                             | lost update concorrente                         | progresso modelado como blob                            | tabela por assignment/item + UPSERT atômico     |
| OPS-001   |         P2 | Segurança      | `routes/api/analytics.ts:14-20`                                            | qualquer autenticado acessa/limpa cache                     | disponibilidade/operacional                     | endpoint técnico herdou guard genérico                  | Admin/ops only                                  |
| PRIV-001  |         P2 | Privacidade    | `auth/scope.ts:62-65` + objeto Architect                                   | roster inteiro inclui e-mail/perfil                         | exposição além da necessidade                   | comentário assume roster menos sensível que objeto real | minimização/redaction/política explícita        |
| CYC-003   |         P2 | Domínio        | `routes/cycles.tsx:104-106`                                                | intervenções não têm contexto temporal de ciclo             | evolução difícil de explicar                    | ciclo modelado só para Assessment/PDI                   | registrar ocorrência/período/ciclo opcional     |
| DATA-003  |         P2 | Dados          | `db/schema.sql`                                                            | estados/roles/datas pouco protegidos no DB                  | integridade depende só da app                   | schema MVP permissivo                                   | CHECKs, timestamps, approver/reviewer metadata  |
| DATA-004  |         P2 | Dados          | `schema.sql:51-76,117-149` e comentários posteriores                       | banco novo nasce com features mortas                        | dívida/confusão                                 | baseline e migrações históricas misturados              | baseline ativo separado de migrations legadas   |
| DATA-005  |         P2 | Histórico      | `schema.sql:491-510`                                                       | ano histórico vira data exata inventada                     | precisão falsa                                  | schema destino exige DATE                               | armazenar precisão (`year`/`day`)               |
| PERF-001  |         P2 | Performance    | `repositories/state.ts:39-77`                                              | servidor carrega estado completo antes de filtrar           | escala/latência/memória                         | snapshot global como estratégia de hidratação           | endpoints paginados/queries por escopo          |
| FRONT-001 |         P2 | Manutenção     | `assessments.tsx`, perfil, PDI, learning >500 linhas                       | manutenção/regressão                                        | lógica de domínio + UI no mesmo módulo          | extrair hooks/use cases/components                      |
| IA-001    |         P2 | Produto        | `AppShell.tsx:53-84`                                                       | todos os papéis veem a mesma arquitetura                    | carga cognitiva/rotas sem valor                 | menu derivado de módulos, não jobs-to-be-done           | IA role-aware                                   |
| RESP-001  |         P2 | Mobile         | `AppShell.tsx:435-445`                                                     | mobile expõe 13 links em scroll horizontal                  | descoberta/eficiência ruim                      | réplica direta da navegação desktop                     | menu condensado role-aware                      |
| ACC-001   |         P2 | A11y           | `__root.tsx:142-153`                                                       | idioma do documento não acompanha UI                        | pronúncia/leitor de tela incorretos             | shell estático                                          | bind de `lang` ao locale                        |
| DOC-001   |         P2 | Governança     | `docs/FUNCIONAL.md` ainda referencia 9-Box/SWOT/OKR                        | agentes/equipe podem recriar feature removida               | documentation drift                             | atualizar docs/screenshots + ADRs                       |
| API-001   |         P2 | API            | `routes/schemas.ts:130-138,167-214`; repositories                          | comandos de create aceitam estado demais                    | bypass de regras/colisões                       | schema de entidade reutilizado como comando             | DTOs de create mínimos + IDs server-side        |
| OBS-001   |         P2 | Operação       | logger Fastify + audit existem; tracing/metrics não encontrados            | diagnóstico de produção limitado                            | observabilidade parcial                         | métricas, tracing e alertas por SLO                     |
| ACC-002   |         P3 | A11y           | `__root.tsx:194-199`                                                       | spinner sem anúncio acessível                               | espera invisível a leitor de tela               | loading puramente visual                                | `role=status` + texto sr-only                   |
| IA-002    |         P4 | Produto        | `settings.tsx`                                                             | glossário ocupa destino primário                            | ruído de navegação                              | ajuda concebida como página                             | ajuda contextual/tooltips                       |

---

## 31. Matriz de Notas

| Dimensão                |    Nota | Justificativa                                                            |
| ----------------------- | ------: | ------------------------------------------------------------------------ |
| Clareza do produto      | **7,0** | tese e core agora são discerníveis; IA ainda fragmenta                   |
| Valor de negócio        | **7,0** | problema real e relevante para organizações técnicas                     |
| Modelo de PDI           | **5,5** | boas entidades, mas lifecycle/integridade ainda falham                   |
| Jornada do usuário      | **5,0** | fluxo existe, porém depende de módulos e contexto manual                 |
| UX                      | **6,0** | telas locais boas; arquitetura de tarefa ainda mediana                   |
| Usabilidade             | **6,0** | utilizável, mas não autoexplicativo ponta a ponta                        |
| UI                      | **7,5** | consistente e corporativa por inspeção estática                          |
| Design System           | **7,5** | primitives/tokens/reuso/testes bons                                      |
| Acessibilidade          | **6,0** | boa base; locale/loading/gráficos e validação real pendentes             |
| Frontend                | **6,5** | tipado/testado/organizado, mas permissões e mutations frágeis            |
| Backend                 | **6,0** | boa base Fastify/Zod/repos, invariantes ainda incompletas                |
| API                     | **4,5** | contratos coerentes em parte; P0/P1 de criação/scoping                   |
| Modelagem de dados      | **5,0** | representa domínio, JSONB já limita integridade                          |
| Segurança               | **2,5** | P0 de identity binding + upserts/secret/rate limit                       |
| Performance             | **6,0** | aceitável para escala pequena por desenho, riscos claros de state global |
| Testabilidade           | **7,0** | boa suíte existente; sem reprodução nem E2E encontrado                   |
| Manutenibilidade        | **6,0** | padrões bons, arquivos grandes e regras distribuídas                     |
| Consistência            | **4,5** | divergências UI/API/domain importantes                                   |
| Completude              | **5,0** | core existe; experiências de governança/fechamento faltam                |
| Prontidão para produção | **2,0** | P0s bloqueiam uso corporativo real                                       |

> **Nota média não deve ser usada como gate.** Um produto pode ter UI 7,5 e ainda ser impróprio para produção por segurança 2,5 e prontidão 2,0.

---

## 32. Quick Wins

1. **QW-01 — Role-aware menu:** esconder destinos administrativos e organizar Member/Lead por tarefa.
2. **QW-02 — Remover `/settings` da navegação primária.**
3. **QW-03 — Levar Training Needs para "Capacidades → Prioridades coletivas".**
4. **QW-04 — `html lang` dinâmico.**
5. **QW-05 — Loading acessível.**
6. **QW-06 — Passar `cycleId` no link de histórico.**
7. **QW-07 — Ocultar CommentForm em Assessment Completed.**
8. **QW-08 — Substituir `isLeadCapable` por permission helper contextual.**
9. **QW-09 — Restringir cache endpoints a Admin.**
10. **QW-10 — Atualizar `docs/FUNCIONAL.md`, README e screenshots para estado atual.**

Quick Win não significa prioridade superior a P0. Os P0 devem vir primeiro.

---

## 33. Plano de Correção

### FASE 0 — BLOQUEADORES

**SEC-001** provisionamento/identity binding.
**DOM-001** imutabilidade e state machine de PDI.
**DOM-002** Assessment nullable/completude.
**IDOR-001/002** server IDs e remover upsert de create.
**SEC-002** hard-fail do JWT secret em produção.
**AUTH-002** escopo de Learning Paths.

**Gate:** nenhuma implantação real antes de testes automatizados de autorização desses casos.

### FASE 1 — CORREÇÃO DO CORE

- população/analytics por papel;
- permission helper contextual frontend;
- state machine de ciclos;
- deep-link histórico;
- integridade Evidence–PDI;
- governança de Mentoring;
- conclusão de PDI com regras de negócio;
- audit metadata em aprovação/conclusão.

### FASE 2 — UX/UI

- Home "Minha Evolução" para Member;
- Home "Pendências do Lead" para Lead;
- Workspace de Pessoa como centro;
- consolidar Capacidades/Gap/Training Needs;
- reduzir navegação;
- check-ins e timeline;
- estados permission/empty/error claros.

### FASE 3 — ENGENHARIA

- normalizar itens de PDI e Learning progress;
- extrair domain services/state machines;
- server-generated IDs;
- revisar constraints e timestamps;
- E2E Playwright de jornada;
- baseline SQL sem tabelas mortas.

### FASE 4 — ESCALA

- paginação e filtros server-side;
- reduzir dependência de `/api/state` global;
- observabilidade, métricas e tracing;
- rate limiting/SSO/MFA conforme ambiente;
- índices/queries baseados em volume real;
- testes de carga.

### FASE 5 — EVOLUÇÃO DO PRODUTO

Somente após confiança do core:

- recomendações explicáveis de intervenção;
- priorização por criticidade/risco/contexto;
- intelligence sobre evolução longitudinal;
- intervenção coletiva;
- integrações corporativas (HRIS/LMS/SSO/OKR read-only quando necessário).

---

## 34. Roadmap Recomendado

| ID    | Título                                  | Categoria    | Problema                                              | Impacto              | Esforço estimado | Prioridade | Dependências           | Recomendação                         | Classe          |
| ----- | --------------------------------------- | ------------ | ----------------------------------------------------- | -------------------- | ---------------- | ---------- | ---------------------- | ------------------------------------ | --------------- |
| R-001 | Fechar self-registration corporativo    | Segurança    | identidade pode ser reivindicada pelo cliente         | crítico              | M                | P0         | nenhuma                | convite/SSO e vínculo server-side    | **ESTRUTURAL**  |
| R-002 | State machine real do PDI               | Domínio      | Approved/Completed ainda mutáveis                     | crítico              | M                | P0         | testes                 | centralizar invariantes e lock       | **ESTRUTURAL**  |
| R-003 | Assessment sem defaults factuais        | Domínio      | nível default representa ausência como fato           | crítico              | M/H              | P1         | migração               | nullable/touched + completeness      | **ESTRUTURAL**  |
| R-004 | IDs servidor + create sem upsert        | API          | colisões podem sobrescrever recursos                  | crítico              | M                | P1         | clients                | UUID servidor + INSERT-only          | **REFATORAÇÃO** |
| R-005 | Role-aware data scope                   | Produto/Auth | analytics misturam roster completo com dados parciais | muito alto           | M/H              | P1         | selectors/API          | população canônica por papel         | **ESTRUTURAL**  |
| R-006 | Minha Evolução / Pendências             | UX/Produto   | produto não orienta próximo passo por papel           | muito alto           | M                | P1         | R-005                  | homes/work queues específicas        | **IMPORTANTE**  |
| R-007 | Workspace da Pessoa                     | UX/Produto   | desenvolvimento está fragmentado em módulos           | muito alto           | H                | P1         | R-002/R-005            | consolidar prioridade→ação→evidência | **ESTRUTURAL**  |
| R-008 | Ciclo transacional                      | Domínio      | Active/status possuem fontes concorrentes             | alto                 | M                | P1         | DB                     | ações de negócio transacionais       | **ESTRUTURAL**  |
| R-009 | Normalizar PDI items                    | Dados        | Evidence não pode ter FK para item JSONB              | alto                 | H                | P1/P2      | R-002                  | tabela `development_plan_items`      | **REFATORAÇÃO** |
| R-010 | Normalizar Learning assignment/progress | Dados        | progress JSONB sofre lost update e baixa integridade  | alto                 | M/H              | P2         | API                    | linhas por assignment/item           | **REFATORAÇÃO** |
| R-011 | Histórico de review/check-in            | PDI          | acompanhamento e reviews são sobrescritos/implícitos  | alto                 | M                | P2         | R-009                  | timeline auditável de decisões       | **IMPORTANTE**  |
| R-012 | Consolidar Capacidades                  | IA           | Map/Gap/Training duplicam momento de decisão          | alto                 | M                | P2         | R-005                  | uma jornada Capacidades/Prioridades  | **IMPORTANTE**  |
| R-013 | Remover Reference da nav                | IA           | glossário não é jornada                               | médio                | L                | P4         | nenhuma                | ajuda contextual                     | **QUICK WIN**   |
| R-014 | Atualizar docs/ADRs                     | Governança   | docs podem reintroduzir features removidas            | alto                 | L                | P2         | decisões atuais        | docs atuais + ADRs                   | **QUICK WIN**   |
| R-015 | E2E das 3 personas                      | QA           | jornada não tem E2E encontrado                        | alto                 | M                | P1/P2      | core estabilizado      | Playwright Member/Lead/Admin         | **IMPORTANTE**  |
| R-016 | Reintroduzir 9-Box                      | Produto      | não há governança de talent calibration necessária    | baixo/agora negativo | H                | —          | governança futura      | não reintroduzir no core atual       | **NÃO FAZER**   |
| R-017 | Novo Development Score                  | Produto      | score composto mascara sinais factuais                | negativo agora       | M                | —          | modelo validado futuro | manter indicadores factuais          | **NÃO FAZER**   |

---

## 35. Teste Final de Coerência

### Simulação: profissional técnico entra pela primeira vez

| Passo                          | Estado atual                                                     | Avaliação                                                        |
| ------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1. Ele entra                   | **EXISTE**, mas cadastro corporativo está inseguro               | **EXISTE MAS ESTÁ MAL IMPLEMENTADO**                             |
| 2. Entende seu contexto        | Dashboard genérico de time                                       | **EXISTE PARCIALMENTE**                                          |
| 3. Identifica onde está        | ciclo aparece no header                                          | **EXISTE**                                                       |
| 4. Entende seu desenvolvimento | precisa navegar entre módulos                                    | **EXISTE PARCIALMENTE**                                          |
| 5. Identifica um gap           | Gap Analysis + perfil                                            | **EXISTE**                                                       |
| 6. Define um objetivo          | item de PDI                                                      | **EXISTE**                                                       |
| 7. Cria ações                  | PDI/SMART/ação                                                   | **EXISTE**, mas governança fraca                                 |
| 8. Executa ações               | status, Learning, Mentoring                                      | **EXISTE**                                                       |
| 9. Registra evidências         | Evidence                                                         | **EXISTE**                                                       |
| 10. Acompanha progresso        | PDI + trilhas                                                    | **EXISTE PARCIALMENTE**                                          |
| 11. Recebe feedback            | Assessment comments + Evidence review                            | **EXISTE PARCIALMENTE**                                          |
| 12. Demonstra evolução         | ciclos + novo Assessment + evidências                            | **EXISTE PARCIALMENTE**                                          |
| 13. Encerra/revisa PDI         | status Completed existe, mas não é imutável nem valida resultado | **EXISTE MAS ESTÁ MAL IMPLEMENTADO**                             |
| 14. Inicia novo ciclo          | ciclos e Assessment novo                                         | **EXISTE PARCIALMENTE**, intervenções não são bem temporalizadas |

### Narrativa comparada

O produto já consegue representar **quase todos os substantivos** da história. Ainda não garante todos os **verbos**.

Ele sabe armazenar avaliação, gap, PDI, ação, trilha, mentoria e evidência. Para ser um sistema corporativo de desenvolvimento, precisa garantir que:

- "avaliar" significa que alguém de fato avaliou;
- "aprovar" significa que o plano acordado ficou governado;
- "concluir" significa que o histórico não será reescrito;
- "ver time" significa ver uma população completa ou explicitamente parcial;
- "evidenciar" significa deixar trilha verificável de autoria/review;
- "evoluir" significa comparar períodos com contexto preservado.

Hoje essas garantias ainda são parciais.

---

## 36. Veredito Final

### O produto útil

**PARCIALMENTE.**

O Synapse deixou de ser um CRUD genérico e possui uma tese de produto clara. A remoção de features frágeis das rodadas anteriores foi correta e deve ser preservada. O core atual é suficientemente bom para continuar investimento.

### O produto pronto

**NÃO.**

Não recomendo disponibilizar o estado atual como sistema corporativo real de PDI até fechar, no mínimo:

1. provisionamento de identidade e autorização;
2. imutabilidade e invariantes de PDI;
3. completude sem defaults fictícios de Assessment;
4. escopo coerente entre backend e analytics;
5. POSTs com server IDs e sem upsert inseguro;
6. ciclo/histórico consistente;
7. testes E2E/segurança reproduzíveis das jornadas críticas.

### Julgamento de maturidade

- **Funcionalidade do core:** ~3/5
- **Coerência de produto:** ~3/5
- **Confiança/governança:** ~2/5
- **Prontidão de produção:** ~1–2/5

### Direção recomendada

A próxima rodada **não deve adicionar funcionalidades**.

Ela deve ser chamada de algo equivalente a:

> **Rodada de Integridade Corporativa e Fechamento do Core**

A pergunta de aceite deve ser:

> **"Uma organização pode confiar que identidade, avaliação, plano, evidência, autorização e histórico significam exatamente o que a interface diz que significam?"**

Enquanto a resposta não for "sim", IA, recomendadores, novos dashboards, gamificação ou novos módulos apenas aumentarão a superfície de um core ainda não confiável.

### Decisão de escopo final

**MANTER:** Assessment, Modelo de Capacidades, Prioridades/Gaps, PDI, Evidence/Review, Ciclos, Learning Paths, Mentoring, Pessoas, Usuários.
**CONSOLIDAR:** Capability Map + Gap Analysis + Training Needs; desenvolvimento individual em Workspace da Pessoa.
**RETIRAR DA NAV PRIMÁRIA:** Reference.
**NÃO REINTRODUZIR AGORA:** 9-Box, Development Score, SWOT, OKR nativo, Philosophy editável.
**PRIORIZAR:** confiança, integridade, autorização e jornada por papel.

---

### Evidências-chave utilizadas nesta revisão

- `backend/src/routes/auth.ts`
- `backend/src/auth/users.ts`
- `backend/src/auth/scope.ts`
- `backend/src/routes/api/assessments.ts`
- `backend/src/routes/api/development.ts`
- `backend/src/routes/api/learning.ts`
- `backend/src/routes/api/cycles.ts`
- `backend/src/routes/api/analytics.ts`
- `backend/src/routes/schemas.ts`
- `backend/src/repositories/assessments.ts`
- `backend/src/repositories/development.ts`
- `backend/src/repositories/learning.ts`
- `backend/src/repositories/state.ts`
- `backend/src/db/schema.sql`
- `backend/src/config/env.ts`
- `frontend/src/components/app/AppShell.tsx`
- `frontend/src/components/app/LoginScreen.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/store.tsx`
- `frontend/src/lib/selectors.ts`
- todas as rotas atuais em `frontend/src/routes/*`
- testes existentes em `frontend/src/lib/__tests__/*` e `backend/src/__tests__/*`
- `frontend/docs/FUNCIONAL.md` e screenshots, tratados como documentação parcialmente desatualizada.
