# SYNAPSE — Plano 360 de Atuação para Agentes

## Reconstrução de Produto, UX, Jornadas e Arquitetura de Experiência

> Documento operacional para agentes de Produto, UX, Frontend, Backend e QA atuarem sobre o Synapse sem reinterpretar livremente a auditoria.
>
> Este documento não é uma lista de sugestões. Ele é um **contrato de transformação do produto**.

---

# 0. Resposta executiva: os agentes já podem atuar?

## Resposta curta

**Parcialmente.**

A auditoria existente é suficiente para:

- compreender os principais problemas;
- identificar telas e fluxos frágeis;
- iniciar correções locais de baixo risco;
- priorizar o trabalho.

Ela **não é suficiente, sozinha, para liberar atuação autônoma em todos os pontos**, porque várias mudanças exigem decisões coordenadas de:

- modelo de domínio;
- estados de negócio;
- papéis e permissões;
- versionamento de dados;
- relações entre entidades;
- contrato frontend/backend;
- migração;
- critérios de aceite;
- regressão;
- arquitetura da informação.

Sem essas definições, um agente pode corrigir a interface e, ao mesmo tempo, piorar a coerência do produto.

## O que pode começar imediatamente

Um agente pode atuar sem nova decisão de produto em:

1. preservar contexto entre **Gap → PDI**;
2. feedback de sucesso/erro de mutações;
3. estados vazios e orientações contextuais;
4. correções de navegação sem alteração de domínio;
5. testes cobrindo fluxos existentes;
6. remoção de promessas de "inteligência" que não correspondem à implementação;
7. melhoria da documentação funcional;
8. preparação de componentes para work queues;
9. preparação de deep links;
10. instrumentação técnica necessária aos novos fluxos.

## O que NÃO deve ser implementado livremente a partir apenas da auditoria

Não alterar de forma autônoma:

- lifecycle do assessment;
- papéis e permissões;
- semântica dos ciclos;
- modelo de evidências;
- versionamento de competências;
- regra da 9 Box;
- fórmula do índice de desenvolvimento;
- estados do PDI;
- associação de trilha, mentoria e evidência;
- modelo de recomendação;
- exclusão física de histórico.

Esses pontos devem seguir **as decisões-alvo deste documento** e, quando envolverem persistência, devem ser implementados também no backend.

---

# 1. Contexto do produto

## Produto

**Synapse**

Interface de gestão e evolução de capacidades técnicas para times de Arquitetura de Soluções.

Stack atual do frontend:

- React 19;
- TypeScript;
- TanStack Start;
- TanStack Router;
- TanStack React Query;
- Tailwind CSS 4;
- Radix UI;
- Vitest;
- Testing Library;
- Playwright disponível no projeto;
- Recharts.

O frontend consome o backend:

`architect-os-backend`

O frontend atual hidrata o estado principal via:

`GET /api/state`

e usa mutações otimistas com invalidação/revalidação em caso de erro.

---

# 2. North Star do produto

O Synapse NÃO deve ser tratado como:

> "um sistema com matriz de competências, PDI, trilhas e dashboards".

O produto deve ser tratado como:

> **Um sistema operacional para gestão e evolução de capacidades técnicas, capaz de transformar avaliações em prioridades, prioridades em ações e ações em evidências de evolução.**

## As cinco perguntas que o produto deve responder

Toda funcionalidade deve contribuir para pelo menos uma destas perguntas:

1. **Onde estamos?**
2. **Onde precisamos chegar?**
3. **O que merece atenção agora?**
4. **Qual intervenção devemos executar?**
5. **A intervenção realmente funcionou?**

Se uma tela, componente, campo ou fluxo não ajuda a responder nenhuma dessas perguntas, sua existência deve ser questionada.

---

# 3. Loop central obrigatório

Este é o fluxo principal do produto e deve orientar todas as decisões futuras:

```text
ASSESSMENT
   ↓
PRIORIDADE
   ↓
PLANO DE DESENVOLVIMENTO
   ↓
INTERVENÇÃO / ATIVIDADE
   ↓
EVIDÊNCIA
   ↓
FEEDBACK / VALIDAÇÃO
   ↓
EVOLUÇÃO
   ↓
NOVO ASSESSMENT
```

Versão conceitual:

```text
Avaliar
→ identificar prioridade
→ recomendar intervenção
→ executar
→ produzir evidência
→ receber feedback
→ validar evolução
→ recalibrar capacidade
→ replanejar
```

## Regra inviolável

**Nenhum novo módulo deve ser criado fora desse loop sem justificativa explícita de produto.**

---

# 4. Princípios de execução dos agentes

## 4.1 Jornada antes de tela

Nunca iniciar uma mudança perguntando:

> "Como melhorar esta página?"

Perguntar:

> "Qual objetivo do usuário esta página participa em alcançar?"

## 4.2 Consequência obrigatória

Toda informação coletada deve ter consequência.

Para cada campo novo ou existente, responder:

1. Por que precisamos dessa informação?
2. Onde ela será utilizada?
3. Qual decisão, recomendação ou comportamento ela altera?

Se não houver resposta, não adicionar o campo.

## 4.3 Não criar CRUD por conveniência

Uma entidade no banco não implica uma página própria.

Agrupar experiências pelo **objetivo do usuário**, não pela tabela ou interface TypeScript.

## 4.4 Não fingir inteligência

Não usar termos como:

- recomendação inteligente;
- sugestão automática;
- priorização inteligente;
- insight;
- IA;

quando a lógica implementada for apenas:

- sort;
- filter;
- slice;
- regra fixa genérica.

Toda recomendação deve apresentar um **rationale explicável**.

## 4.5 Não apagar história

Dados históricos utilizados em:

- assessments;
- ciclos;
- evolução;
- evidências;
- competências;

não podem ser destruídos para simplificar o estado atual.

Preferir:

- arquivamento;
- versionamento;
- inativação;
- snapshots.

## 4.6 Estado de negócio explícito

Não representar processos humanos complexos apenas por:

`vazio → preenchido`

ou:

`formulário → salvo`.

Quando a realidade exige:

- rascunho;
- enviado;
- revisão;
- calibração;
- aprovado;
- concluído;
- bloqueado;

o produto deve representar esses estados.

## 4.7 Contexto nunca deve ser descartado em uma transição

Se o usuário veio de:

> Ana → Threat Modeling → gap 2→4

a próxima etapa não pode perguntar novamente:

- pessoa;
- competência;
- nível atual;
- alvo;

se o sistema já sabe isso.

## 4.8 Frontend não inventa regra de domínio isoladamente

Mudanças em:

- enums;
- relacionamentos;
- lifecycle;
- autorização;
- histórico;
- ciclos;

devem ser alinhadas com o backend.

## 4.9 Sem regressão silenciosa

Todo fluxo alterado deve ter:

- teste;
- estado de loading;
- estado de erro;
- feedback de sucesso quando aplicável.

## 4.10 Não reescrever histórico Git publicado

O projeto está conectado ao Lovable.

Conforme `AGENTS.md`:

- não usar force push;
- não rebasear/amendar/squashar commits já publicados;
- manter a branch conectada em estado funcional.

---

# 5. Hierarquia das fontes de verdade

Quando houver conflito durante a implementação:

## Para entender o estado atual

Prioridade:

1. código executável atual;
2. contratos da API;
3. testes;
4. `docs/FUNCIONAL.md`;
5. README;
6. screenshots.

## Para definir o estado futuro

Prioridade:

1. este documento;
2. auditoria de Produto/UX;
3. decisões explícitas posteriormente registradas pelo Product Owner;
4. código existente.

O fato de algo existir hoje **não significa que deve ser preservado**.

---

# 6. Papéis do produto

O produto deve evoluir para reconhecer pelo menos três perspectivas distintas.

## 6.1 Arquiteto / Member

Objetivo:

> evoluir capacidades com clareza, contexto e evidência.

Deve poder:

- realizar autoavaliação;
- visualizar níveis esperados;
- visualizar feedback recebido;
- entender prioridades;
- acompanhar PDI;
- executar atividades;
- registrar evidências;
- responder feedback;
- acompanhar evolução.

Não deve poder:

- editar a avaliação do Tech Lead;
- definir unilateralmente nota final;
- alterar estrutura organizacional;
- editar modelo de competências;
- manipular 9 Box.

## 6.2 Tech Lead / Gestor

Objetivo:

> tomar decisões de desenvolvimento e reduzir risco de capacidade do time.

Deve poder:

- revisar avaliações;
- fornecer avaliação do líder;
- calibrar divergências;
- finalizar assessment conforme governança;
- priorizar gaps;
- criar/aprovar PDI;
- recomendar intervenções;
- validar evidências;
- acompanhar evolução;
- visualizar riscos coletivos.

## 6.3 Administrador

Objetivo:

> configurar o modelo operacional.

Deve poder:

- administrar usuários;
- administrar cargos;
- administrar modelo de competências;
- versionar modelo;
- administrar ciclos;
- administrar configurações.

## Pendência arquitetural

Hoje `SessionUser.role` é:

```ts
"admin" | "member";
```

e existe:

```ts
architectId: string | null;
```

Antes de implementar autorização completa de Tech Lead, verificar o backend.

Se não houver papel de líder, propor explicitamente um modelo compatível.

**Não simular segurança apenas escondendo botões no frontend.**

---

# 7. Arquitetura de informação alvo

A navegação atual reflete módulos demais no mesmo nível.

A arquitetura-alvo deve evoluir para:

```text
HOME / TRABALHO
|
|-- PESSOAS
|   |-- Visão da pessoa
|   |-- Capacidades
|   |-- Prioridades
|   |-- Desenvolvimento
|   |-- Evidências
|   |-- Evolução
|
|-- CAPACIDADES
|   |-- Cobertura
|   |-- Gaps
|   |-- Riscos
|   |-- Especialistas
|   |-- Necessidades coletivas
|
|-- DESENVOLVIMENTO
|   |-- Trilhas
|   |-- Mentorias
|   |-- Intervenções coletivas
|
|-- CICLOS
|   |-- Preparar
|   |-- Avaliar
|   |-- Calibrar
|   |-- Acompanhar
|   |-- Encerrar
|
|-- ADMINISTRAÇÃO
    |-- Modelo de capacidades
    |-- Cargos e níveis esperados
    |-- Usuários e papéis
    |-- Configurações
```

## Regra

Não é obrigatório executar essa reorganização em um único commit.

A migração pode ser progressiva.

Durante a transição:

- manter URLs existentes quando possível;
- utilizar redirects quando uma rota desaparecer;
- evitar quebrar links compartilhados;
- manter deep links.

---

# 8. Jornada alvo 1 — Onboarding e readiness

## Problema atual

O produto exige configuração prévia, mas o usuário precisa deduzir a ordem pelo menu.

## Objetivo

Fazer uma instância nova chegar rapidamente ao primeiro assessment válido.

## Fluxo alvo

```text
Primeiro acesso
→ Criar administrador
→ Readiness do workspace
→ Modelo de competências
→ Cargos / níveis esperados
→ Pessoas
→ Contas / vínculos
→ Primeiro ciclo
→ Iniciar assessment
```

## Home durante setup

Enquanto o produto não estiver pronto para avaliação, a Home deve priorizar:

### Configure seu Synapse

- [ ] Modelo de competências disponível
- [ ] Perfis por cargo configurados
- [ ] Time cadastrado
- [ ] Usuários vinculados
- [ ] Ciclo ativo
- [ ] Assessment pronto para iniciar

## Critérios de aceite

- usuário nunca cai em dashboard sem dados sem orientação;
- cada requisito mostra por que ele é necessário;
- cada item possui CTA para a ação correta;
- itens concluídos são reconhecidos automaticamente;
- setup concluído altera a Home para a experiência operacional;
- setup não depende de ordem memorizada pelo usuário.

---

# 9. Jornada alvo 2 — Assessment e calibração

## Problema atual

A mesma tela permite manipular:

- self;
- leader;
- final.

O lifecycle existe no domínio, mas não é operacionalizado.

## Estado alvo

O assessment deve ser um processo.

### Lifecycle mínimo

```text
DRAFT
  ↓
AUTOAVALIAÇÃO CONCLUÍDA
  ↓
IN REVIEW
  ↓
REVISÃO DO TECH LEAD
  ↓
CALIBRAÇÃO
  ↓
COMPLETED
```

## Compatibilidade com enum atual

O domínio atual possui:

```ts
"Draft" | "In Review" | "Completed";
```

Se for desejável evitar migração imediata:

- `Draft`: autoavaliação ainda editável;
- `In Review`: autoavaliação submetida; Tech Lead revisa e ocorre calibração;
- `Completed`: nota final bloqueada e oficial.

Caso o backend permita evolução segura do domínio, estados mais explícitos podem ser adicionados posteriormente.

## Regras obrigatórias

### Draft

Arquiteto pode editar:

- `self`;
- comentário próprio.

Não pode editar:

- `leader`;
- `final`.

### In Review

Tech Lead pode editar:

- `leader`;
- comentário do líder.

Arquiteto vê o assessment submetido e feedback disponível conforme regra definida.

### Calibração

O produto deve destacar:

- divergências `self vs leader`;
- gaps para target;
- evidências relacionadas à competência;
- comentários relevantes;
- histórico da competência quando disponível.

A UI deve reduzir ruído.

Não exigir revisar 100 itens com o mesmo peso se apenas 12 possuem divergência relevante.

### Completed

- `final` passa a ser oficial;
- assessment fica somente leitura, salvo reabertura autorizada;
- somente assessment `Completed` alimenta indicadores oficiais.

## Regra crítica

Funções como `gapsFor()` não devem tratar assessment não concluído como fotografia oficial do ciclo.

## Critérios de aceite

- member não consegue editar `leader` ou `final`;
- Tech Lead não sobrescreve silenciosamente `self`;
- cada etapa possui estado visível;
- usuário sabe o que falta para concluir;
- assessment incompleto não alimenta indicadores oficiais;
- finalização exige critérios explícitos;
- assessment finalizado possui data e autoria recuperável;
- reabertura, se existir, deve ser auditável.

## Arquivos inicialmente impactados

Frontend:

- `src/routes/assessments.tsx`
- `src/lib/domain.ts`
- `src/lib/selectors.ts`
- `src/lib/api.ts`
- `src/lib/store.tsx`
- `src/lib/auth.tsx`
- testes de assessment

Backend:

- verificar contratos de assessment;
- autorização;
- status;
- autoria;
- persistência dos comentários.

---

# 10. Jornada alvo 3 — Gap → prioridade → ação

## Problema atual

`Gap Analysis` possui CTA "Tratar no PDI", mas navega apenas para:

```text
/development-plans
```

O contexto é perdido.

## Estado alvo

A navegação deve transportar contexto semanticamente.

### Origem

```text
Pessoa: Ana Martins
Competência: Threat Modeling
Nível atual: 2
Nível esperado: 4
Gap: 2
Ciclo: 2026 H2
Origem: Gap Analysis
```

### Destino

Workspace de desenvolvimento de Ana já aberto em:

```text
Prioridade: Threat Modeling
Atual: 2
Alvo: 4
```

## Implementação mínima

Permitir deep link com parâmetros ou rota contextual.

Exemplo conceitual:

```text
/development-plans?architectId=...&competencyId=...&source=gap-analysis
```

ou, na arquitetura futura:

```text
/people/:architectId/development/:competencyId
```

## Regras

Não armazenar contexto crítico apenas em estado efêmero do componente.

Deep link deve funcionar após refresh.

## Critérios de aceite

- CTA de um gap abre a pessoa correta;
- competência correta permanece selecionada;
- current/target são carregados automaticamente;
- usuário não precisa redigitar informações conhecidas;
- origem pode ser registrada para analytics/auditoria;
- refresh não perde o contexto.

---

# 11. Motor de priorização

## Problema atual

O produto possui gaps, mas não explica adequadamente quais devem ser tratados primeiro.

## Objetivo

Transformar gap em **prioridade explicável**.

## Primeira versão permitida: regras determinísticas explicáveis

Não é necessário utilizar IA inicialmente.

Uma prioridade pode considerar:

```text
Gap de proficiência
× criticidade da competência para o cargo
× risco de cobertura do time
× demanda organizacional
× existência de PDI já cobrindo o tema
× objetivo de carreira da pessoa
× recorrência histórica
```

Nem todos esses dados existem hoje.

O agente deve:

1. mapear quais existem;
2. não inventar os ausentes;
3. implementar versão 1 somente com sinais disponíveis;
4. exibir explicitamente quais fatores influenciaram.

## Exemplo de saída

> **Threat Modeling — prioridade alta**
>
> Motivos:
>
> - nível atual 2; esperado 4;
> - gap de 2 níveis;
> - somente 1 pessoa do time está em nível ≥ 4;
> - nenhuma ação ativa do PDI cobre essa competência.

## Proibido

Mostrar:

> "Recomendado pela IA"

sem mecanismo implementado e evidência.

---

# 12. Jornada alvo 4 — Workspace de Desenvolvimento da Pessoa

## Objetivo

Substituir a fragmentação entre:

- PDI;
- trilhas atribuídas;
- mentoria;
- evidências;
- progresso;

por uma experiência organizada pela prioridade da pessoa.

## Modelo mental

O usuário não deve pensar:

> "Agora vou na tela de PDI; depois na tela de trilhas; depois na tela de evidências."

Deve pensar:

> "Estou trabalhando a prioridade Threat Modeling da Ana."

## Estrutura alvo

```text
ANA MARTINS

Prioridade: Threat Modeling
Atual 2 → Alvo 4
Status: Em desenvolvimento
Prazo: 30/11/2026

Por que isto é prioridade?
[ rationale ]

Plano
[ objetivo ]
[ ações ]

Atividades
- Curso X
- Aplicação no Projeto Y
- Sessão de mentoria com Carlos

Evidências esperadas
- Threat model de projeto real
- Review aprovado

Evidências enviadas
- ADR ...
- Architecture Review ...

Feedback
- Tech Lead ...
- Mentor ...

Evolução
2 → 3 → ...
```

## Regra

A biblioteca de trilhas pode continuar global.

A **atribuição** da trilha deve aparecer dentro da prioridade da pessoa quando relacionada.

## Critérios de aceite

- uma prioridade possui contexto completo;
- ações não ficam desconectadas;
- trilha pode ser vinculada ao objetivo;
- mentoria pode ser vinculada ao objetivo;
- evidência pode ser vinculada ao objetivo;
- progresso é derivado de ações reais sempre que possível;
- usuário visualiza histórico da prioridade.

---

# 13. PDI — estado alvo

## Problema atual

PDI é parcialmente estruturado, mas ainda funciona como registro manual.

## Manter

`DevelopmentPlanItem` possui boa base:

- competencyId;
- currentLevel;
- targetLevel;
- objective;
- actionType;
- actionPlan;
- startDate;
- targetDate;
- priority;
- owner;
- status;
- progress;
- evidenceIds;
- smart.

## Corrigir

### `evidenceIds`

Deve passar a ser efetivamente usado.

### `status`

Não deve existir apenas como select isolado.

Transições devem respeitar condições mínimas.

### `progress`

Evitar slider puramente subjetivo quando o progresso puder ser inferido por:

- atividades concluídas;
- evidências aceitas;
- checkpoints realizados.

Pode haver override manual, mas deve ser explícito.

### `DevelopmentPlan.status`

Estados atuais:

```text
Draft
Approved
Completed
```

devem participar da experiência.

## Regras propostas

### Draft

Plano em elaboração.

### Approved

Plano acordado entre pessoa e responsável.

### Completed

Todos os itens encerrados ou plano formalmente finalizado.

## Critérios de aceite

- plano possui status visível;
- approval tem autoria/data se backend suportar;
- item criado a partir de gap preserva origem;
- evidências podem ser vinculadas;
- ações vencidas ficam identificáveis;
- item bloqueado exige motivo ou comentário;
- conclusão não apaga histórico.

---

# 14. Jornada alvo 5 — Atividade → evidência

## Problema atual

A aplicação registra evidência, mas a evidência pode nascer com:

```ts
competencyIds: [];
```

e `DevelopmentPlanItem.evidenceIds` não fecha o ciclo.

## Estado alvo

Toda evidência deve responder:

1. quem produziu;
2. quando;
3. qual atividade ou contexto originou;
4. quais competências demonstra;
5. qual nível/resultado pretende evidenciar;
6. quem revisou;
7. qual feedback recebeu;
8. se foi aceita como evidência válida.

## Modelo mínimo proposto

Não alterar o backend sem inspeção, mas o domínio futuro deve suportar conceitualmente:

```ts
Evidence {
  id
  architectId
  competencyIds
  developmentPlanItemId?
  learningPathItemId?
  mentoringSessionId?
  cycleId?
  title
  description
  type
  date
  complexity
  project?
  url?
  reviewStatus
  reviewerId?
  reviewerComment?
  reviewedAt?
}
```

## `reviewStatus`

Sugestão:

```text
Pending
Accepted
Needs Improvement
Rejected
```

A nomenclatura final deve ser alinhada ao backend e produto.

## Critérios de aceite

- evidência criada a partir de uma atividade já vem contextualizada;
- competência não é perdida;
- evidência aparece no PDI relacionado;
- Tech Lead pode validar;
- evidência aceita aparece no próximo assessment da competência;
- número bruto de evidências não implica automaticamente evolução.

---

# 15. Jornada alvo 6 — Evidência → feedback → novo assessment

## Objetivo

Fechar o ciclo de aprendizado.

Ao avaliar uma competência em ciclo futuro, mostrar contexto relevante.

## Exemplo

```text
Threat Modeling

Último nível final: 2
Alvo atual: 4

Desde o último assessment:
✓ Curso de Threat Modeling concluído
✓ Threat Model — Projeto Atlas
✓ Architecture Review aprovado por Carlos
✓ Mentoria em 04/08
```

## Regra

Essas informações são **evidência para decisão**, não atualização automática de nível.

O produto pode recomendar:

> "Existem novas evidências desde a última avaliação."

Mas a mudança de proficiência continua sendo decisão governada pelo processo de assessment.

---

# 16. Ciclos — semântica alvo

## Problema atual

O seletor de ciclo é global, mas nem todas as entidades são realmente escopadas por ciclo.

## Regra conceitual

Separar:

### Entidades permanentes

Exemplos:

- pessoa;
- competência;
- definição de cargo;
- biblioteca de trilha.

### Eventos ou relações temporais

Exemplos:

- assessment;
- PDI;
- atribuição de trilha;
- mentoria;
- evidência;
- resultado;
- classificação de talento, caso exista.

## Regra

Se a UI muda de ciclo, tudo que se apresenta como pertencente ao ciclo deve efetivamente ser filtrado ou contextualizado pelo ciclo.

## Exemplo de modelagem

Uma `LearningPath` pode continuar permanente.

Mas a atribuição deveria conceitualmente ser uma entidade:

```ts
LearningPathAssignment {
  id
  learningPathId
  architectId
  cycleId?
  developmentPlanItemId?
  assignedAt
  dueDate?
  status
  progress
}
```

Não implementar essa interface no frontend sem alinhar o contrato com backend.

## Critérios de aceite

- trocar ciclo nunca mantém silenciosamente métricas incompatíveis;
- itens globais são claramente identificados como globais;
- itens do ciclo têm referência temporal;
- dashboards explicam o período;
- histórico permanece recuperável.

---

# 17. Versionamento do modelo de competências

## Problema crítico

Excluir ou alterar competências não pode modificar retroativamente o significado de assessments anteriores.

## Estado alvo

O modelo de competências deve ser versionável.

### Exemplo

```text
Modelo 2026.1
- usado no ciclo H1

Modelo 2026.2
- usado no ciclo H2
```

## Regras

### Nunca

- apagar assessment histórico porque uma competência foi excluída;
- sobrescrever silenciosamente o significado histórico da competência.

### Preferir

- `archivedAt`;
- `active`;
- `version`;
- snapshot por ciclo;
- referência à versão do modelo.

## Estratégia de implementação

Antes de implementar:

1. inspecionar backend;
2. mapear relações e cascades;
3. definir migração;
4. criar testes de preservação histórica;
5. só então alterar UI.

## Critérios de aceite

Teste obrigatório:

```text
Dado assessment H1 com Competência X
Quando X é arquivada para o modelo H2
Então o assessment H1 continua exibindo X e sua nota histórica
E X não aparece para novas avaliações H2, se não pertencer à nova versão
```

---

# 18. Mapa de Capacidades + Gap Analysis + Training Needs

## Objetivo

Consolidar conceitualmente essas experiências sob:

> **Prioridades de Capacidade**

Não é necessário eliminar rotas imediatamente.

## Lentes

### Pessoa

Quem precisa desenvolver o quê?

### Time

Quais gaps são mais recorrentes?

### Domínio

Onde existe baixa cobertura?

### Organização

Onde há risco concentrado?

## O que cada insight deve permitir

Todo insight acionável deve possuir um próximo passo.

Exemplos:

### Gap individual

`Criar ação de desenvolvimento`

### Baixa cobertura

`Planejar mitigação`

### Necessidade coletiva

`Criar intervenção coletiva`

### Mentor potencial

`Iniciar mentoria`

## Critério

Não terminar a jornada em um gráfico quando o produto já possui dados suficientes para iniciar a ação.

---

# 19. Necessidades de treinamento — intervenção coletiva

## Estado alvo

Exemplo:

> 4 arquitetos possuem gap em IAM.

O produto deve oferecer:

**Criar intervenção coletiva**

## Pré-preenchimento

- competência;
- pessoas afetadas;
- current/target agregados;
- ciclo;
- criticidade.

## Próximas opções

- atribuir trilha;
- criar workshop;
- indicar mentor;
- definir atividade prática;
- definir evidência esperada.

## Regra

Não usar sempre o mesmo texto genérico:

> "Workshop + Architecture Review"

para todas as competências.

Se não houver mecanismo de recomendação diferenciado, chamar de:

> "Opções de intervenção"

e deixar claro que são alternativas.

---

# 20. Mentoria — estado alvo

## Problema atual

A sessão registra:

- notas;
- decisões;
- ações;

mas essas ações não se transformam em continuidade.

## Estado alvo

Sessão de mentoria deve poder estar ligada a:

- pessoa;
- competência;
- item de PDI;
- prioridade;
- ciclo/contexto.

## Ações extraídas

Após salvar uma sessão, permitir:

- adicionar ação ao PDI;
- criar follow-up;
- definir próxima sessão;
- solicitar evidência;
- concluir atividade.

## Critérios de aceite

- `competencyIds` deixa de ser sempre vazio quando a sessão é contextual;
- `nextSession` é utilizável na experiência;
- ações não ficam apenas em texto;
- histórico de mentoria aparece na prioridade relacionada;
- não duplicar manualmente informações já conhecidas.

---

# 21. 9 Box — decisão de produto

## Estado atual

A funcionalidade permite alterar `performance` × `potential` via drag-and-drop com baixa governança.

## Decisão

### Durante a reconstrução

**Suspender a 9 Box como mecanismo operacional de decisão de RH ou mantê-la explicitamente como experimental/somente leitura até haver governança suficiente.**

## Não permitir como definitivo sem:

- critérios documentados;
- origem das notas;
- ciclo;
- autoria;
- data;
- justificativa;
- histórico;
- permissão;
- calibração.

## Se for mantida

Reposicionar como:

> **Talent Calibration**

e não apenas quadro drag-and-drop.

## Regra

Não permitir que uma interação visual de baixa fricção produza decisão humana de alto impacto sem confirmação e rastreabilidade.

---

# 22. Índice de Desenvolvimento — decisão de produto

## Estado atual

O score composto mistura:

- PDI;
- OKR;
- learning;
- evidência;
- evolução.

A contagem de evidências pode gerar pontuação sem considerar qualidade ou relação.

## Decisão

### Até existir modelo defensável

Não tratar o score como KPI central.

Preferir indicadores legíveis:

- `3 de 4 prioridades em andamento`;
- `2 evidências aceitas`;
- `1 competência evoluiu`;
- `1 ação bloqueada`;
- `2 pendências de feedback`.

## Proibido

Ajustar pesos arbitrariamente para "melhorar" o score.

## Se houver futura reconstrução

Produzir documento separado:

- objetivo do índice;
- fatores;
- normalização;
- vieses;
- validação;
- interpretação;
- limites de uso.

---

# 23. SWOT — decisão de produto

## Estado atual

SWOT existe na experiência de PDI, mas sua consequência não é evidente.

## Regra

SWOT só deve permanecer se seus dados alterarem:

- prioridade;
- decisão;
- recomendação;
- conversa de desenvolvimento.

Caso contrário:

- remover do fluxo principal;
- ou converter em reflexão opcional.

## Proibido

Manter quatro campos apenas porque SWOT é um framework conhecido.

---

# 24. Home orientada a trabalho

## Problema atual

Dashboard é predominantemente observacional.

## Home alvo

A Home deve mudar conforme papel.

## Member

### Agora

- concluir autoavaliação;
- responder feedback;
- executar ação;
- registrar evidência.

### Meu desenvolvimento

- prioridades ativas;
- próximos prazos;
- evidências aguardando feedback.

## Tech Lead

### Pendências

- assessments aguardando revisão;
- divergências para calibrar;
- PDI aguardando aprovação;
- evidências aguardando validação;
- ações bloqueadas;
- riscos críticos sem intervenção.

## Admin

### Readiness / operação

- configuração incompleta;
- ciclo sem cobertura;
- usuários não vinculados;
- inconsistências.

## Critério

A Home deve responder:

> "O que requer minha atenção agora?"

antes de:

> "Quais números existem no sistema?"

---

# 25. Empty states

Todo empty state deve dizer:

1. o que está vazio;
2. por que isso importa;
3. o que precisa acontecer;
4. quem pode executar;
5. CTA adequado.

## Ruim

> Nenhuma avaliação encontrada.

## Bom

> **Ana ainda não possui assessment neste ciclo.**
>
> Sem uma avaliação concluída, gaps e prioridades de desenvolvimento não podem ser calculados.
>
> `Iniciar autoavaliação`

---

# 26. Loading, erro e feedback

## Loading

Usar:

- skeleton quando estrutura é conhecida;
- progress quando ação é demorada;
- estado local para mutação.

## Erro

Não depender de:

```ts
console.error(...)
```

como resposta de produto.

Mostrar:

- o que não foi salvo;
- impacto;
- ação para tentar novamente;
- manter entrada do usuário sempre que possível.

## Sucesso

Confirmar explicitamente ações de alto impacto:

- assessment enviado;
- assessment finalizado;
- PDI aprovado;
- evidência enviada;
- evidência validada;
- ciclo encerrado.

## Mutação otimista

Só manter quando rollback visual é claro.

Se o usuário puder interpretar o estado intermediário como sucesso definitivo, mostrar estado `saving`.

---

# 27. Deep links e persistência de contexto

## Regra

Estados de jornada relevantes devem ser recuperáveis por URL ou backend.

Não depender exclusivamente de:

```ts
useState(...)
```

para:

- pessoa selecionada;
- competência;
- ciclo;
- prioridade;
- ação em foco.

## Exigência

URLs relevantes devem sobreviver a:

- refresh;
- compartilhamento;
- back/forward;
- navegação interna.

---

# 28. Design e UI

A reconstrução é de produto, não de estética.

## Preservar

O design system atual quando não atrapalhar a experiência.

## Não fazer

- redesign visual completo sem necessidade;
- adicionar animação para mascarar falta de lógica;
- criar dezenas de cards;
- duplicar informação;
- adotar componentes "AI SaaS" genéricos sem função.

## Priorizar

- hierarquia;
- contexto;
- estados;
- progressão;
- decisão;
- próximo passo;
- confiança.

---

# 29. Regras técnicas do frontend

## Routing

TanStack Start utiliza file-based routing.

Não criar:

- `src/pages/`;
- padrões de Next.js;
- `app/layout.tsx`.

Não editar manualmente:

`src/routeTree.gen.ts`

## TypeScript

- manter tipos explícitos de domínio;
- evitar `any`;
- modelar estados de negócio;
- não duplicar enums em componentes.

## React Query

- manter fonte de verdade consistente;
- invalidar queries corretas;
- tratar erros;
- evitar divergência prolongada entre cache e backend.

## Store

Não ampliar indefinidamente `src/lib/store.tsx` como um mega-facade.

Durante refactors maiores, avaliar hooks de domínio por área:

- assessments;
- people;
- development;
- evidence;
- cycles.

Não fazer refactor técnico massivo antes das jornadas prioritárias.

---

# 30. Backend como dependência obrigatória

Este repositório é apenas frontend.

Antes de qualquer alteração de persistência, agente deve inspecionar:

`architect-os-backend`

## Mudanças que provavelmente exigem backend

- permissões por papel;
- lifecycle de assessment;
- versionamento de competências;
- evidence review;
- relacionamentos entre PDI e evidência;
- atribuição de learning path;
- ciclo em eventos;
- histórico/auditoria;
- 9 Box governada.

## Regra

Se o backend não suportar o estado-alvo:

1. registrar a lacuna;
2. propor contrato;
3. implementar backend;
4. adicionar teste de contrato;
5. implementar frontend.

Não mascarar ausência do backend com estado apenas local.

---

# 31. Estratégia de migração

## Princípio

Evolução incremental.

Não tentar reconstruir todas as telas em um único PR.

## Estratégia recomendada

### Fase A — Integridade e contexto

- lifecycle do assessment;
- filtros oficiais só com Completed;
- Gap → PDI contextual;
- feedback de mutações;
- testes de regressão.

### Fase B — Loop de desenvolvimento

- workspace da pessoa;
- PDI → atividade;
- evidência contextual;
- feedback da evidência;
- próxima avaliação com contexto histórico.

### Fase C — Semântica temporal

- ciclos;
- atribuições temporais;
- histórico;
- versionamento de competências.

### Fase D — Arquitetura de informação

- nova Home;
- consolidar capacidades;
- consolidar desenvolvimento;
- Administração.

### Fase E — Inteligência

- priorização explicável;
- recomendação de intervenção;
- ações coletivas;
- automações.

### Fase F — Features sensíveis

- reconstruir ou remover 9 Box;
- decidir índice de desenvolvimento.

---

# 32. Backlog operacional por épico

## EPIC 01 — Assessment confiável

### Entregas

- separar responsabilidades;
- lifecycle visível;
- status funcional;
- Completed como fonte oficial;
- calibração;
- testes.

### Definition of Done

- fluxo completo passa por todos os estados;
- permissões validadas no backend;
- selectors não usam assessment não concluído para KPI oficial;
- UI mostra pendências;
- testes unitários/integrados passam;
- screenshots funcionais atualizadas.

---

## EPIC 02 — Continuidade Gap → Ação

### Entregas

- deep link;
- pessoa e competência persistidas;
- CTA contextual;
- criação de PDI pré-preenchida.

### Definition of Done

Usuário consegue:

```text
Gap
→ Tratar
→ confirmar ação
```

sem selecionar novamente pessoa ou competência.

---

## EPIC 03 — Workspace de Desenvolvimento

### Entregas

- prioridade;
- rationale;
- PDI;
- atividades;
- evidências;
- feedback;
- progresso.

### Definition of Done

Um Tech Lead consegue conduzir uma conversa de desenvolvimento sem navegar por módulos independentes.

---

## EPIC 04 — Evidence Loop

### Entregas

- evidence contextual;
- review;
- vínculo com PDI;
- histórico;
- contexto no próximo assessment.

### Definition of Done

É possível rastrear:

```text
gap
→ ação
→ evidência
→ feedback
→ assessment futuro
```

---

## EPIC 05 — Ciclos corretos

### Entregas

- semântica temporal;
- métricas filtradas;
- eventos contextualizados;
- histórico.

### Definition of Done

Trocar de ciclo nunca produz mistura silenciosa de dados.

---

## EPIC 06 — Modelo versionado

### Entregas

- archive/version;
- preservação histórica;
- UX de edição;
- testes.

### Definition of Done

Alterar o catálogo atual não altera assessments encerrados.

---

## EPIC 07 — Work Queues

### Entregas

- Home Member;
- Home Lead;
- Home Admin;
- tarefas ordenadas.

### Definition of Done

Cada papel entra no produto e sabe sua próxima ação sem explorar o menu.

---

## EPIC 08 — Prioridades de Capacidade

### Entregas

- Gap;
- Capability Map;
- Training Needs;
- ações contextuais.

### Definition of Done

Todo insight crítico possui uma ação possível.

---

## EPIC 09 — Intervenção coletiva

### Entregas

- selecionar necessidade;
- participantes;
- intervenção;
- acompanhamento;
- resultado.

### Definition of Done

Uma necessidade coletiva pode virar execução monitorada.

---

## EPIC 10 — Governança de features sensíveis

### Escopo

- 9 Box;
- Development Score;
- SWOT.

### Definition of Done

Cada feature:

- tem propósito;
- tem regra defensável;
- tem consequência;
- ou foi removida/suspensa.

---

# 33. Dependências entre épicos

```text
EPIC 01 Assessment
      |
      v
EPIC 02 Gap → Ação
      |
      v
EPIC 03 Workspace
      |
      v
EPIC 04 Evidence Loop
      |
      +------------------+
      |                  |
      v                  v
EPIC 05 Ciclos       EPIC 07 Work Queues
      |
      v
EPIC 06 Versionamento
      |
      v
EPIC 08 Prioridades
      |
      v
EPIC 09 Intervenção coletiva

EPIC 10 deve ocorrer após a integridade do core ou em paralelo apenas para suspensão/remoção.
```

---

# 34. Ordem obrigatória de prioridade

1. **Assessment confiável**
2. **Gap → PDI contextual**
3. **PDI → atividade → evidência → feedback**
4. **Workspace de Desenvolvimento**
5. **Semântica de ciclos**
6. **Versionamento do modelo**
7. **Home orientada a trabalho**
8. **Priorização explicável**
9. **Intervenção coletiva**
10. **9 Box / Development Score / SWOT**

## Regra

Não investir primeiro em dashboard, estética ou IA enquanto os itens 1–6 estiverem incompletos.

---

# 35. Agentes recomendados

Os agentes podem ser especializados, mas devem trabalhar sobre o mesmo contrato.

## Agente A — Product/Flow Architect

Responsável por:

- jornada;
- estados;
- transições;
- regras;
- IA;
- critérios de aceite.

Não implementa feature se a jornada estiver ambígua.

## Agente B — Domain/API Architect

Responsável por:

- entidades;
- contratos;
- versionamento;
- ciclos;
- autorização;
- migrações;
- integridade histórica.

## Agente C — Frontend Product Engineer

Responsável por:

- rotas;
- componentes;
- deep links;
- estados;
- feedback;
- acessibilidade;
- integração.

## Agente D — QA/Product Validation

Responsável por:

- testes de jornada;
- regressão;
- permissões;
- estados;
- dados históricos;
- erro/loading;
- critérios de aceite.

## Agente E — UX Consistency Reviewer

Responsável por:

- linguagem;
- modelo mental;
- progressive disclosure;
- continuidade;
- excesso de decisão manual;
- redundância.

## Regra de coordenação

Nenhum agente deve redefinir o produto localmente.

Mudança em regra central deve ser registrada neste documento ou em ADR específico.

---

# 36. Protocolo de execução de cada agente

Antes de modificar código, o agente deve produzir internamente:

## 1. Estado atual

- rota;
- arquivos;
- dados envolvidos;
- comportamento;
- dependências.

## 2. Problema

Qual lacuna da auditoria está sendo atacada?

## 3. Estado alvo

Como a jornada deve funcionar?

## 4. Impacto de domínio

Há alteração em:

- tipo;
- API;
- banco;
- permissão;
- histórico;
- ciclo?

## 5. Plano mínimo

Menor conjunto coerente de alterações.

## 6. Critérios de aceite

Específicos e verificáveis.

Só então implementar.

---

# 37. Formato obrigatório de entrega de um agente

Ao finalizar uma tarefa, responder com:

```md
## Entrega

### Problema atacado

...

### Jornada antes

...

### Jornada depois

...

### Arquivos alterados

- ...

### Contratos alterados

- ...

### Migrações

- ...

### Decisões de produto aplicadas

- ...

### Testes adicionados

- ...

### Validações executadas

- npm test
- npm run typecheck
- npm run lint
- npm run build

### Evidências

- ...

### Riscos / pendências

- ...

### Próxima dependência recomendada

- ...
```

---

# 38. Critérios globais de Definition of Done

Uma entrega não está pronta apenas porque "funciona".

Precisa cumprir:

## Produto

- resolve problema declarado;
- possui próximo passo;
- não cria dead end;
- não perde contexto.

## Domínio

- estados coerentes;
- histórico preservado;
- relações corretas;
- sem regra apenas visual.

## UX

- loading;
- empty;
- erro;
- sucesso;
- disabled quando aplicável;
- confirmação para ação de alto impacto.

## Técnica

Rodar:

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Quando backend estiver disponível:

```sh
RUN_INTEGRATION=1 npm test
```

Se tela mudar visualmente:

```sh
npm run screenshots
```

## Regressão

Fluxos não relacionados não podem quebrar.

---

# 39. Testes mínimos obrigatórios

## Assessment

- member altera self;
- member não altera leader;
- assessment Draft não alimenta gap oficial;
- Completed alimenta gap;
- finalização bloqueia edição indevida;
- erro de gravação é visível.

## Gap → PDI

- pessoa preservada;
- competência preservada;
- refresh preserva contexto;
- item criado contém current/target corretos.

## Evidência

- vínculo com competência;
- vínculo com PDI quando aplicável;
- review funciona;
- evidência aparece no contexto correto;
- contagem bruta não altera nível automaticamente.

## Ciclo

- troca de ciclo muda métricas relacionadas;
- dados globais são explicitamente globais;
- histórico fechado não é alterado.

## Competência

- arquivar não apaga assessment histórico;
- nova versão não contamina ciclo anterior.

## Permissões

- member;
- lead;
- admin.

Backend deve ser fonte definitiva de autorização.

---

# 40. Métricas de produto recomendadas

Não implementar analytics fictício.

Quando houver instrumentação, medir:

## Time to Value

- tempo até primeiro assessment concluído;
- tempo assessment → primeira ação de desenvolvimento.

## Conversão de jornada

- gaps identificados → gaps com ação;
- ações → atividades iniciadas;
- atividades → evidências;
- evidências → feedback;
- feedback → evolução em assessment futuro.

## Operação

- assessments pendentes;
- evidências aguardando review;
- ações bloqueadas;
- ações atrasadas;
- capacidades críticas sem intervenção.

## Qualidade

- divergência média self vs lead;
- percentual de PDIs com evidência;
- percentual de recomendações aceitas.

---

# 41. O que NÃO fazer

Agentes estão explicitamente proibidos de:

1. criar features novas para "enriquecer" o produto sem lacuna de jornada;
2. adicionar chat/IA genérica;
3. gerar dashboard ornamental;
4. duplicar métricas;
5. criar score arbitrário;
6. apagar histórico;
7. transformar regra de autorização em simples `if` visual;
8. criar estados locais que deveriam estar no backend;
9. mudar todos os layouts de uma vez;
10. reescrever git history;
11. editar `routeTree.gen.ts` manualmente;
12. substituir o stack sem necessidade;
13. criar novas entidades sem mapear consequência;
14. adicionar campos que não serão usados;
15. manter uma tela apenas por sunk cost.

---

# 42. Critérios para remover uma tela

Uma tela pode ser removida/consolidada quando:

- não representa objetivo independente do usuário;
- é apenas visão da mesma informação;
- termina sem ação;
- exige navegação desnecessária;
- pertence naturalmente ao workspace de uma pessoa ou capacidade.

## Candidatas atuais

### Referência do Modelo

Conteúdo deve migrar para:

- ajuda contextual;
- Administração → Modelo de Capacidades.

### Gap Analysis / Capability Map / Training Needs

Podem permanecer como rotas durante migração, mas convergir para:

**Prioridades de Capacidade**.

### PDI / trilhas atribuídas / mentoria / evidências

Convergir para:

**Workspace de Desenvolvimento da Pessoa**.

---

# 43. Critérios para criar uma nova tela

Só criar rota nova se:

1. representar objetivo real;
2. precisar de espaço/contexto próprio;
3. não puder ser resolvida por progressive disclosure;
4. tiver entrada e saída claras;
5. fizer parte do loop central.

---

# 44. Momento "aha" que os agentes devem proteger

## Para Tech Lead

> **"O sistema identificou onde meu time tem risco, explicou por que aquilo importa e transformou o diagnóstico em um plano acionável."**

## Para arquiteto

> **"Eu sei exatamente o que desenvolver agora, por que isso importa e como demonstrar minha evolução."**

Toda mudança deve aproximar o usuário desse momento.

---

# 45. Pergunta de validação de qualquer feature

Antes de concluir uma alteração, responder:

> Esta mudança ajuda o produto a entender, orientar, acompanhar ou aprender?

Se a resposta for não, questionar a mudança.

---

# 46. Mapa de arquivos do frontend atual

Arquivos centrais conhecidos:

## Shell / navegação

- `src/components/app/AppShell.tsx`
- `src/routes/__root.tsx`
- `src/router.tsx`

## Auth

- `src/components/app/LoginScreen.tsx`
- `src/lib/auth.tsx`
- `src/lib/api.ts`

## Dashboard

- `src/routes/index.tsx`

## Pessoas

- `src/routes/team.tsx`
- `src/routes/architects.$architectId.tsx`

## Assessment

- `src/routes/assessments.tsx`

## Capacidades

- `src/routes/capability-map.tsx`
- `src/routes/competency-matrix.tsx`
- `src/routes/gap-analysis.tsx`
- `src/routes/training-needs.tsx`

## Desenvolvimento

- `src/routes/development-plans.tsx`
- `src/routes/learning-paths.tsx`
- `src/routes/mentoring.tsx`

## Talento

- `src/routes/talent-matrix.tsx`

## Ciclos / Configuração

- `src/routes/cycles.tsx`
- `src/routes/settings.tsx`

## Domínio

- `src/lib/domain.ts`
- `src/lib/selectors.ts`
- `src/lib/store.tsx`
- `src/lib/labels.ts`

## Testes

- `src/lib/__tests__/`

## Documentação funcional

- `docs/FUNCIONAL.md`

---

# 47. Regras para `docs/FUNCIONAL.md`

A documentação deve acompanhar a nova lógica.

Após cada épico:

- atualizar finalidade da tela;
- atualizar jornada;
- remover afirmações que não sejam verdadeiras;
- atualizar screenshots;
- explicar estados;
- explicar dependências.

## Regra importante

Documentação não pode prometer comportamento que o código não implementa.

Exemplo atual a evitar:

> "Sugestão baseada em SWOT"

quando SWOT não participa da regra.

---

# 48. ADRs recomendados

Criar decisões arquiteturais/documentais separadas para:

## ADR-001 — Assessment Lifecycle

- estados;
- responsáveis;
- transições;
- fonte oficial.

## ADR-002 — Cycle Semantics

- permanente vs temporal;
- filtros;
- atribuições.

## ADR-003 — Competency Model Versioning

- versões;
- archive;
- histórico.

## ADR-004 — Evidence Graph

- PDI;
- trilha;
- mentoria;
- competência;
- review.

## ADR-005 — Authorization Model

- admin;
- lead;
- member.

## ADR-006 — Talent Calibration

Somente se 9 Box permanecer.

## ADR-007 — Development Score

Somente se o índice for reconstruído.

---

# 49. Estratégia de commits e PRs

Preferir mudanças pequenas e semanticamente completas.

## Bom

```text
feat(assessment): enforce review lifecycle
feat(development): preserve gap context in PDI
feat(evidence): link evidence to development item
```

## Ruim

```text
refactor: improve app
```

## Cada PR deve conter

- problema;
- estado alvo;
- screenshots quando visual;
- testes;
- impacto de domínio;
- migração;
- riscos.

---

# 50. Estratégia de branches

Respeitar integração Lovable.

- não reescrever commits publicados;
- evitar long-lived branch gigantesca;
- integrar incrementalmente;
- manter build verde.

---

# 51. Plano de atuação recomendado para um agente autônomo

Se apenas um agente for executar tudo, usar esta sequência:

## Passo 1 — Baseline

1. rodar testes;
2. typecheck;
3. lint;
4. build;
5. registrar falhas preexistentes;
6. compreender API/backend.

## Passo 2 — Assessment

Implementar EPIC 01.

Parar se backend não suportar autorização/status.

## Passo 3 — Gap → PDI

Implementar EPIC 02.

## Passo 4 — Evidence Loop

Implementar EPIC 03 + 04 progressivamente.

## Passo 5 — Ciclos

Implementar EPIC 05.

## Passo 6 — Versionamento

Implementar EPIC 06.

## Passo 7 — Home / IA

Implementar EPIC 07 + reorganização gradual.

## Passo 8 — Prioridades

Implementar EPIC 08.

## Passo 9 — Treinamento coletivo

Implementar EPIC 09.

## Passo 10 — Sensíveis

Decidir EPIC 10.

---

# 52. Stop conditions — quando o agente deve parar e registrar impedimento

O agente deve parar a implementação específica quando:

- backend necessário não está disponível;
- regra de autorização é desconhecida;
- migração pode destruir histórico;
- não existe consenso sobre owner de uma decisão;
- requisito contradiz este documento;
- feature humana sensível não possui governança;
- teste revela dado histórico incompatível.

## O agente NÃO deve

preencher a lacuna com uma decisão inventada.

Deve registrar:

```md
### Bloqueio

Decisão necessária:
...

Impacto:
...

Opções:
A. ...
B. ...

Recomendação técnica:
...
```

---

# 53. Definition of Success da transformação

A reconstrução é considerada bem-sucedida quando um usuário consegue completar:

```text
1. realizar assessment
2. concluir calibração
3. identificar prioridade
4. transformar prioridade em plano
5. executar atividade
6. enviar evidência
7. receber feedback
8. visualizar evolução
9. iniciar próximo ciclo com histórico disponível
```

sem:

- redigitar contexto;
- procurar manualmente em módulos desconectados;
- interpretar sozinho todos os dados;
- perder histórico;
- confundir dado preliminar com oficial.

---

# 54. Cenário de aceite 360 — usuário individual

```gherkin
Dado que Ana é Arquiteta de Soluções
E existe um ciclo ativo
E o modelo de competências está configurado

Quando Ana conclui sua autoavaliação
Então o assessment entra em revisão

Quando o Tech Lead revisa as competências
Então o produto destaca divergências e gaps relevantes

Quando a calibração é concluída
Então somente a avaliação final passa a alimentar os indicadores oficiais

E quando Threat Modeling apresenta gap prioritário
Então o produto permite criar uma ação de desenvolvimento sem perder o contexto

E quando a ação inclui prática em projeto real
Então Ana pode registrar uma evidência ligada à ação e à competência

E quando o Tech Lead aceita a evidência
Então ela passa a compor o histórico da competência

E no próximo assessment
Então o produto apresenta as evidências acumuladas desde a avaliação anterior

Sem alterar automaticamente a nota de proficiência.
```

---

# 55. Cenário de aceite 360 — gestão do time

```gherkin
Dado que o Tech Lead possui um time com assessments concluídos

Quando acessa a Home
Então vê as principais pendências e riscos

E quando uma competência possui baixa cobertura
Então o produto explica o motivo do risco

E quando várias pessoas compartilham a mesma lacuna
Então o produto permite iniciar uma intervenção coletiva

E quando a intervenção é executada
Então atividades e evidências ficam associadas aos participantes

E quando um novo ciclo é concluído
Então o gestor consegue verificar se a capacidade do time evoluiu.
```

---

# 56. Cenário de aceite 360 — preservação histórica

```gherkin
Dado que um assessment do ciclo H1 foi concluído com a Competência X

Quando o modelo de competências é atualizado para H2
E a Competência X deixa de fazer parte do modelo atual

Então o assessment H1 continua exibindo a Competência X
E sua nota histórica permanece íntegra
E a competência não precisa aparecer em novos assessments H2
E nenhuma exclusão atual destrói a história anterior.
```

---

# 57. Perguntas que devem ser respondidas antes de considerar o produto maduro

1. Quem pode finalizar uma avaliação?
2. Quem pode reabri-la?
3. Qual dado é oficial antes da finalização?
4. O que exatamente torna um gap prioritário?
5. O que transforma uma atividade em evidência?
6. Quem pode validar evidência?
7. O que significa uma evidência aceita?
8. Como um ciclo afeta trilhas e mentorias?
9. Como preservar uma competência removida historicamente?
10. Qual papel o SWOT realmente exerce?
11. O que justifica manter 9 Box?
12. O que justifica o Development Score?
13. Como o sistema diferencia arquiteto, Tech Lead e admin?
14. Qual é a próxima ação após cada insight?
15. Por que o usuário deve voltar amanhã?

---

# 58. Resultado esperado após Correção → Evolução → Transformação

## Hoje

```text
Cadastrar
→ Avaliar
→ Visualizar
→ Registrar
```

## Após Correção

```text
Avaliar corretamente
→ identificar gap confiável
→ preservar contexto
→ agir
```

## Após Evolução

```text
Avaliar
→ priorizar
→ desenvolver
→ evidenciar
→ receber feedback
```

## Após Transformação

```text
Entender
→ orientar
→ executar
→ acompanhar
→ aprender
→ melhorar a próxima decisão
```

---

# 59. Instrução final para qualquer agente

Você não está trabalhando em um conjunto de páginas.

Você está reconstruindo um sistema de decisões sobre desenvolvimento de capacidades.

Antes de criar ou alterar qualquer tela, pergunte:

> **Que decisão ou resultado do usuário esta experiência melhora?**

Antes de criar qualquer dado:

> **Que consequência esse dado terá?**

Antes de criar qualquer recomendação:

> **Por que o produto acredita nisso?**

Antes de concluir qualquer fluxo:

> **O que acontece depois?**

E antes de considerar qualquer feature pronta:

> **Ela fecha uma parte do loop Assessment → Prioridade → Desenvolvimento → Evidência → Feedback → Evolução?**

Se não fechar, revise a solução.

---

# 60. Ordem de comando recomendada ao iniciar o trabalho

Entregue este documento ao agente junto ao repositório e use a seguinte instrução:

```text
Leia integralmente o arquivo PLANO-360-AGENTES-SYNAPSE.md antes de alterar qualquer código.

Em seguida:

1. inspecione o frontend e o backend;
2. valide o baseline de testes/build;
3. reconstrua o fluxo atual do EPIC 01;
4. liste contratos e arquivos impactados;
5. implemente apenas o EPIC 01;
6. cumpra todos os critérios de aceite e Definition of Done;
7. não avance para o próximo épico enquanto o atual não estiver íntegro;
8. não invente regras ausentes;
9. não apague histórico;
10. não reescreva Git history publicado;
11. documente todas as decisões;
12. ao finalizar, entregue o relatório no formato definido na seção 37.

Priorize coerência de produto e integridade de dados sobre preservação da interface atual.
```

---

# Conclusão

A auditoria original fornece o **diagnóstico**.

Este documento fornece o **contrato de execução**.

A partir dele, agentes já podem atuar de maneira muito mais segura porque passam a ter:

- North Star;
- loop central;
- arquitetura-alvo;
- papéis;
- regras de domínio;
- prioridades;
- dependências;
- critérios de aceite;
- Definition of Done;
- estratégia de testes;
- stop conditions;
- sequência de implementação;
- limites claros de autonomia.

A principal regra permanece:

> **Não adicionar mais profundidade horizontal ao produto antes de conectar verticalmente Assessment → Prioridade → PDI → Atividade → Evidência → Feedback → Evolução.**

O Synapse não precisa de mais telas.

Ele precisa que as telas existentes passem a funcionar como **um único produto**.
