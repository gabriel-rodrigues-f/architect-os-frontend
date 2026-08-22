# Auditoria Rígida — Segunda Revisão do Synapse / Architect OS Frontend

## 1. Veredito

### Maturidade geral: **2/5 — Aplicação funcional, produto ainda frágil**

A nova revisão do ZIP atualizado identificou que houve uma rodada real de correções desde a auditoria anterior, principalmente em:

- lifecycle de assessment;
- selectors;
- store;
- testes;
- documentação;
- screenshots.

O avanço é real, mas **o EPIC de Assessment ainda não pode ser considerado concluído**.

Além disso, a segunda passada revelou problemas estruturais novos que afetam:

- integridade de dados;
- permissões;
- semântica temporal;
- confiabilidade de métricas;
- histórico;
- progresso de trilhas;
- evidências;
- 9 Box;
- PDI;
- recomendações;
- estados de negócio.

A principal descoberta desta revisão é:

> **A correção de “fonte oficial” do Assessment melhorou a governança, mas várias telas ainda confundem ausência de informação com nível zero, produzindo conclusões falsas.**

Também foi identificado um erro estrutural importante em Learning Paths:

> **O progresso da trilha é compartilhado por todos os arquitetos atribuídos à mesma trilha.**

### Limitação da validação

A auditoria foi realizada por inspeção estática aprofundada do ZIP atualizado.

A suíte não pôde ser executada no ambiente porque o pacote não continha dependências instaladas e o ambiente retornou:

```text
vitest: not found
```

Portanto, as conclusões abaixo são baseadas em:

- código;
- domínio;
- selectors;
- rotas;
- store;
- testes existentes;
- documentação;
- screenshots.

---

# 2. Assessment — lifecycle ainda incompleto

## P0 — Arquiteto continua podendo editar `self` depois da submissão

**Natureza:** Observado  
**Confiança:** Alta

Atualmente:

```ts
const canEditSelf = !isAdmin && isOwner && !isCompleted;
```

`src/routes/assessments.tsx:64`

Isso significa:

| Estado    | Member pode editar Self? |
| --------- | -----------------------: |
| Draft     |                      Sim |
| In Review |                  **Sim** |
| Completed |                      Não |

Depois de clicar em **Enviar para revisão**, a autoavaliação deveria ficar congelada.

### Correção esperada

Semântica equivalente a:

```ts
canEditSelf = isOwner && assessment.status === "Draft";
```

### Prioridade

**P0**

---

# 3. Assessment — Admin consegue pular a revisão

## P0 — `Draft → Completed` é permitido

Hoje:

```ts
const canComplete = isAdmin && assessment && assessment.status !== "Completed";
```

`src/routes/assessments.tsx:67`

Portanto, um admin consegue concluir uma avaliação ainda em Draft.

O problema é agravado porque um teste novo valida esse comportamento:

`src/lib/__tests__/assessment-lifecycle.test.tsx:106-120`

### Lifecycle correto

```text
Draft
  →
In Review
  →
Completed
```

Não:

```text
Draft ———————————— Completed
```

### Correção

A ação de completar só deve existir quando:

- assessment estiver `In Review`;
- revisão tiver ocorrido;
- campos obrigatórios estiverem válidos;
- usuário possuir autorização adequada.

### Prioridade

**P0**

---

# 4. Assessment — Admin pode preencher Leader e Final cedo demais

Hoje:

```ts
const canEditLeaderFinal = isAdmin && !isCompleted;
```

`src/routes/assessments.tsx:65`

Isso permite editar `leader` e `final` ainda durante o Draft da autoavaliação.

### Estado desejado

| Campo  | Draft           | In Review       | Completed |
| ------ | --------------- | --------------- | --------- |
| Self   | Arquiteto edita | Bloqueado       | Bloqueado |
| Leader | Bloqueado       | Lead edita      | Bloqueado |
| Final  | Bloqueado       | Lead/calibração | Bloqueado |

### Prioridade

**P0**

---

# 5. Comentários continuam modelados de forma incorreta

## P0 — O comentário funciona como uma “conversa fabricada”

O domínio define:

```ts
interface AssessmentComment {
  architectText: string;
  techLeadText: string;
}
```

`src/lib/domain.ts:78-90`

A experiência ainda exige que os dois lados sejam preenchidos conjuntamente.

Isso significa que um único usuário registra simultaneamente:

- o comentário do arquiteto;
- o comentário do Tech Lead.

Não existe autoria real por mensagem.

### Problemas

Faltam:

- `authorUserId`;
- `authorRole`;
- timestamp individual;
- ordenação conversacional;
- regra de edição por autor;
- relação com lifecycle do assessment.

### Modelo recomendado

```ts
AssessmentComment {
  id
  assessmentId
  competencyId
  authorUserId
  authorRole
  text
  createdAt
  updatedAt?
}
```

Cada usuário deve registrar sua própria fala.

### Prioridade

**P0**

---

# 6. “Sem dado” está sendo convertido em “nível 0”

Essa é uma das falhas sistêmicas mais importantes da revisão.

`domainAverages()` agora usa apenas assessments oficiais, o que é correto.

Mas na ausência de assessment oficial retorna:

```ts
avg: 0;
target: 0;
```

`src/lib/selectors.ts:152-159`

O produto não diferencia:

> **sem informação**

de:

> **nível 0**

### Correção estrutural

Representar ausência com:

```ts
undefined;
```

ou:

```ts
{
  assessed: false;
}
```

Nunca utilizar zero como ausência.

### Prioridade

**P0**

---

# 7. Capability Map classifica não avaliados como “Lacunas”

O mapa calcula:

```ts
level:
  sel.domainAverages(a.id)
    .find(...)
    ?.avg ?? 0
```

`src/routes/capability-map.tsx:74-82`

Bandas:

```text
< 2,5   → Lacunas
2,5–3,5 → Praticantes
3,5–4,5 → Avançados
≥ 4,5   → Experts
```

`src/routes/capability-map.tsx:50-61`

Portanto:

```text
sem assessment Completed
→ média 0
→ Lacunas
```

Isso é incorreto.

### Regra

**Ausência de avaliação não é lacuna.**

### Prioridade

**P0**

---

# 8. “Lacuna” no Capability Map não significa realmente gap

A banda “Lacunas” é baseada apenas em proficiência absoluta `< 2,5`.

Mas o conceito de gap no produto é:

```text
target - final
```

### Exemplo A

```text
Atual: 2
Target: 2
```

Não existe gap.

Mas a pessoa aparece em:

> Lacunas

### Exemplo B

```text
Atual: 3
Target: 5
```

Existe gap 2.

Mas aparece em:

> Praticantes

### Correção

Escolher uma das opções:

1. renomear a banda para algo como **Proficiência inicial**;
2. ou utilizar target-gap real na classificação.

### Prioridade

**P0**

---

# 9. Radar do Gap Analysis produz médias incorretas

O radar calcula todas as pessoas:

```ts
const rows = architects.map(...)
```

Quem não possui Completed vira:

```ts
{ avg: 0, target: 0 }
```

Depois a média é dividida por:

```ts
rows.length;
```

`src/routes/gap-analysis.tsx:37-50`

### Exemplo

```text
Ana → média 4
Bruno → sem assessment
```

Produto:

```text
(4 + 0) / 2 = 2
```

Resultado exibido:

> média do time = 2

Correto seria:

> média = 4  
> cobertura = 1 de 2

### Regra

Todo agregado deve carregar:

```text
valor + cobertura
```

Exemplo:

> **Média 4,0 · 1 de 2 pessoas avaliadas**

### Prioridade

**P0**

---

# 10. “Sem avaliação” e “sem gap” são tratados como o mesmo estado

No card do time:

```tsx
{
  top.length === 0 && <p>Sem avaliação neste ciclo.</p>;
}
```

`src/routes/team.tsx:202-217`

Mas `top.length === 0` também ocorre quando:

- assessment existe;
- foi concluído;
- não existem gaps.

### Estados que precisam ser distintos

```text
Não avaliado
Assessment em andamento
Assessment concluído sem gaps
Assessment concluído com gaps
```

### Prioridade

**P0/P1**

---

# 11. Learning Paths possui erro estrutural de domínio

## P0 — progresso compartilhado entre pessoas

Modelo atual:

```ts
LearningPath {
  assignedTo: string[];
  items: LearningPathItem[];
}

LearningPathItem {
  status;
  progress;
}
```

`src/lib/domain.ts:192-215`

### Problema

Se uma trilha está atribuída a:

- Ana;
- Bruno;

e existe:

```text
Item 1 → progress: 60%
```

esse progresso é compartilhado.

Não existe:

```text
Ana → 60%
Bruno → 10%
```

### Impacto adicional

`developmentScore()` usa:

```ts
pathsByArchitect.flatMap((p) => p.items.map((i) => i.progress));
```

`src/lib/selectors.ts:173-179`

Logo, arquitetos diferentes recebem o mesmo progresso quando compartilham a trilha.

### Modelo necessário

Separar:

```text
LearningPath
```

de:

```text
LearningPathAssignment
```

e progresso individual.

Exemplo:

```ts
LearningPathAssignment {
  pathId
  architectId
  cycleId?
  assignedAt
  status
}

LearningItemProgress {
  assignmentId
  itemId
  progress
  status
}
```

### Decisão

**Suspender evolução funcional de Learning Paths até corrigir o modelo.**

### Prioridade

**P0**

---

# 12. “Somente leitura” em Learning Paths não é realmente somente leitura

A página calcula:

```ts
const editable = canEdit(path);
```

e mostra:

> Somente leitura

Mas o slider continua ativo:

```tsx
<input
  type="range"
  ...
  onChange={() => store.updateLearningItem(...)}
/>
```

`src/routes/learning-paths.tsx:184-200`

### Resultado

O usuário vê:

> Somente leitura

mas consegue modificar progresso.

### Prioridade

**P0/P1**

---

# 13. Teste de Learning Paths não testa o componente real

O teste recria:

```ts
const canEdit = (...) => ...
```

`src/lib/__tests__/learning-paths.test.ts:5-7`

Ou seja, o teste valida uma cópia da regra, não o comportamento da interface.

Isso explica por que o slider editável em modo “somente leitura” passou despercebido.

### Correção

Renderizar o componente real e validar:

- ausência dos controles;
- `disabled`;
- mutation não chamada;
- regra aplicada no DOM.

### Prioridade

**P1 alto**

---

# 14. Permissões permanecem incompletas no produto

`useCurrentUser()` aparece principalmente em:

- Assessments;
- Learning Paths;
- Mentoring.

Não governa adequadamente operações administrativas como:

- criar/excluir arquiteto;
- alterar perfil por cargo;
- criar/excluir competência;
- criar/excluir domínio;
- editar PDI de outra pessoa;
- editar OKR de outra pessoa;
- manipular 9 Box;
- criar/excluir ciclo;
- editar filosofia global.

### Problema

Mesmo que o backend rejeite algumas ações:

> a UX ainda oferece ações indevidas.

### Risco adicional

É necessário verificar se:

```text
GET /api/state
```

retorna dados de toda a organização para usuários member.

Se sim, esconder controles no frontend não resolve privacidade.

### Prioridade

**P0 para autorização e verificação de privacidade**

---

# 15. Filosofia global editável por usuário comum

`PhilosophyCard` possui:

```tsx
<Button onClick={startEditing}>Editar</Button>
```

`src/components/app/PhilosophyCard.tsx:57-67`

Sem verificação de role.

Isso permite alterar conteúdo institucional exibido no shell da aplicação.

### Correção

Tratar como configuração administrativa.

### Prioridade

**P1 alto**

---

# 16. Cadastro de arquiteto fabrica dados

Trecho atual:

```ts
yearsAsArchitect: Number(form.years) || 1,
email: form.email.trim() || `${slug(form.name)}@company.com`,
strongDomain: form.strongDomain || store.categories[0]?.id || "",
gapDomain: form.gapDomain || store.categories[1]?.id || "",
```

`src/routes/team.tsx:97-107`

### Problemas

#### 0 anos vira 1 ano

```text
0 → 1
```

#### Email ausente vira email inventado

O sistema cria um endereço sem garantia de validade.

#### Domínio forte ausente vira primeiro domínio

O produto transforma ausência em uma afirmação.

#### Gap ausente vira segundo domínio

Novamente, ausência vira dado avaliativo fictício.

### Regra

Nunca preencher dados avaliativos ausentes com fatos inventados.

Preferir:

```text
Não informado
Não avaliado
Não definido
```

### Prioridade

**P0/P1**

---

# 17. Novo arquiteto entra automaticamente como Medium/Medium na 9 Box

No cadastro:

```ts
performance: "Medium",
potential: "Medium",
```

`src/routes/team.tsx:112-117`

Uma pessoa recém-cadastrada já recebe:

- performance média;
- potencial médio;

sem avaliação.

### Correção

Usar estado nulo:

```ts
null;
```

até existir processo de Talent Calibration.

### Prioridade

**P0 se 9 Box continuar operacional**

---

# 18. Excluir arquiteto apaga histórico

O store remove em cascata:

```ts
assessments;
plans;
okrs;
swots;
evidences;
certifications;
mentoringSessions;
```

`src/lib/store.tsx:144-162`

### Problema

Saída de funcionário não significa inexistência histórica.

Devem ser preservados:

- assessments;
- evolução;
- evidências;
- mentorias;
- decisões;
- relatórios do ciclo.

### Correção

Pessoa deve possuir estados como:

```text
Ativa
Inativa
Arquivada
```

Exclusão física deve ser excepcional.

### Prioridade

**P0**

---

# 19. Excluir domínio altera assessments históricos

O store remove itens antigos dos assessments:

```ts
assessments: s.assessments.map((a) => ({
  ...
  items: a.items.filter((i) => !doomed.has(i.competencyId)),
}))
```

`src/lib/store.tsx:199-220`

Isso altera retroativamente avaliações passadas.

### Impacto

Invalida:

- comparações;
- evolução entre ciclos;
- auditoria;
- histórico;
- confiança.

### Correção

Implementar:

- arquivamento;
- versionamento;
- snapshot histórico.

### Prioridade

**P0 absoluto**

---

# 20. Ciclos usam fonte oficial no gráfico e não oficial na tabela

Na mesma página:

- gráfico usa `domainAverages()` → considera só Completed;
- tabela usa `assessmentFor()` → aceita Draft/In Review.

`src/routes/cycles.tsx:50-67`

### Resultado

A página pode mostrar:

> gráfico sem valor oficial

e simultaneamente:

> tabela com L4

para a mesma pessoa.

### Correção

Definir fonte oficial única para leitura histórica.

### Prioridade

**P0**

---

# 21. Página Ciclos promete uma temporalidade não garantida pelo domínio

Texto atual:

> “Cada ciclo agrupa avaliação, SWOT, PDI, metas SMART, OKRs, trilhas, mentorias e evidências.”

`src/routes/cycles.tsx:71-74`

Mas:

- Learning Paths;
- Mentoring;
- Evidence;

não possuem relação consistente com ciclo.

### Problema

A UI promete uma semântica que o modelo não garante.

### Prioridade

**P0/P1**

---

# 22. Duas fontes de verdade para “ciclo ativo”

Existem:

```ts
DevelopmentCycle.status:
"Active" | "Closed" | "Planned"
```

e:

```ts
activeCycleId;
```

Sem invariantes claros.

### Possível estado inconsistente

```text
H1 → Active
H2 → Active
activeCycleId → H3
```

### Decisão necessária

Ou:

- `status` define o ciclo ativo;

ou:

- `activeCycleId` é apenas ciclo selecionado e deve ter outro nome.

### Prioridade

**P1 alto**

---

# 23. Exclusão de ciclo não possui governança suficiente

Em `cycles.tsx`:

```tsx
onClick={() => store.removeCycle(c.id)}
```

A remoção ocorre diretamente.

### Problema

O problema não é apenas falta de modal.

Um ciclo histórico provavelmente não deveria ser deletável.

### Correção

Preferir:

- encerramento;
- arquivamento;
- proteção de histórico.

### Prioridade

**P0/P1**

---

# 24. Development Score continua não defensável

Score atual:

```text
PDI        30%
OKR        15%
Learning   15%
Evidence   20%
Growth     20%
```

`src/lib/selectors.ts:169-196`

### Problema 1 — Evidence

```ts
evidenceCount * 25;
```

4 evidências = 100%.

Sem considerar:

- qualidade;
- contexto;
- dificuldade;
- aprovação;
- relação com competência.

### Problema 2 — Learning

Usa progresso global da trilha, que já está estruturalmente incorreto.

### Problema 3 — OKR

Há inconsistências de ciclo.

### Problema 4 — Growth

```ts
(after - before) * 100;
```

Evolução média de +1 nível satura 100%.

### Problema 5 — Mistura temporal

Combina dados do ciclo com dados all-time.

### Recomendação

Retirar o score da posição central.

Não ajustar pesos arbitrariamente.

### Prioridade

**P0 se usado em people decisions; P1 se experimental**

---

# 25. OKRs possuem inconsistência de ciclo

O domínio possui:

```ts
cycleId;
```

Mas há seleções apenas por:

```ts
architectId;
```

No perfil:

```ts
store.okrs.find((o) => o.architectId === architect.id);
```

Isso pode mostrar o OKR errado quando existem múltiplos ciclos.

### Prioridade

**P0/P1**

---

# 26. SMART continua inventando fatos organizacionais

Ao clicar em:

> Transformar em meta SMART

o sistema gera frases como:

```text
Duas entregas arquiteturais, um ADR e uma sessão técnica
```

e afirma:

```text
Compatível com a alocação atual em projetos
```

e:

```text
é prioridade no roadmap técnico do time
```

`src/routes/development-plans.tsx:234-253`

### Problema

O produto não possui dados que comprovem:

- alocação atual;
- roadmap técnico.

Isso é fabricação de contexto.

### Regra

Nunca afirmar fatos organizacionais não presentes no sistema.

### Prioridade

**P0 de confiança**

---

# 27. “Sugestões automáticas” continuam sendo apenas ordenação

A tela afirma utilizar:

- lacunas;
- SWOT;
- target;
- avaliação do Tech Lead.

Mas a lógica real é:

```ts
const suggestions = gaps
  .filter(...)
  .slice(0, 5);
```

`src/routes/development-plans.tsx:51-56`

Além disso, a ação criada assume:

```ts
actionType: "Learn"
targetDate: +4 meses
priority: baseada apenas no tamanho do gap
```

### Problema

A UI promete recomendação contextual.

O sistema entrega filtro e ordenação.

### Correção

Ou:

- implementar rationale real;

ou:

- reduzir a promessa textual.

### Prioridade

**P1 alto**

---

# 28. PDI permite estados contraditórios

`status` e `progress` são independentes.

Logo, podem existir estados como:

```text
Not Started + 100%
Completed + 10%
Blocked + 100%
```

### Correção

Definir invariantes e transições.

### Prioridade

**P1 alto**

---

# 29. `DevelopmentPlan.status` existe no domínio, mas não na jornada

Estados:

```text
Draft
Approved
Completed
```

`src/lib/domain.ts:158-164`

Mas o produto não conduz claramente:

```text
elaborar
→ acordar
→ aprovar
→ acompanhar
→ finalizar
```

É outro lifecycle presente apenas no tipo.

### Prioridade

**P1 alto**

---

# 30. Evidence ainda não fecha o loop

Ao criar evidência:

```ts
competencyIds: [];
```

O PDI possui:

```ts
evidenceIds: [];
```

mas a jornada não conecta os dois.

O loop continua quebrado:

```text
Gap
→ PDI
→ Atividade
  X
Evidência
```

### Prioridade

**P0**

---

# 31. Evidência não possui processo de validação suficiente

Faltam estados como:

```text
Pending
Accepted
Needs Improvement
Rejected
```

e dados como:

- reviewer;
- reviewedAt;
- competency;
- PDI item;
- ciclo;
- origem.

### Prioridade

**P0/P1**

---

# 32. Mentoria ainda é ata, não workflow

Sessão continua criada com:

```ts
competencyIds: [];
```

Ações e decisões continuam registradas como texto.

Não viram:

- PDI;
- tarefa;
- prazo;
- follow-up;
- evidência.

### Prioridade

**P1 alto**

---

# 33. Qualquer usuário autenticado pode iniciar mentoria na UI

`useCurrentUser()` é utilizado principalmente para preencher:

```ts
mentor: user.name;
```

Não há governança clara sobre:

- quem pode registrar sessão;
- para quem;
- em qual contexto.

### Prioridade

**P1/P0 conforme regra organizacional**

---

# 34. Training Needs continua sendo relatório sem consequência

A tela continua sugerindo genericamente:

> workshop prático + architecture review

para diferentes competências.

Não existe ciclo operacional de intervenção.

### Problema adicional

Com assessments oficiais, cobertura da amostra se torna obrigatória.

Exemplo:

```text
2 pessoas apresentam gap IAM
```

Pode significar:

```text
2 de 2 avaliadas
```

ou:

```text
2 de 50
```

São situações muito diferentes.

### Prioridade

**P1 alto**

---

# 35. 9 Box continua inadequada para uso real

`performance` e `potential` permanecem na entidade `Architect`.

Portanto, são estado permanente da pessoa, não avaliação por ciclo.

Arrastar o card sobrescreve a classificação atual sem:

- ciclo;
- justificativa;
- autoria;
- data;
- histórico;
- evidência;
- calibração.

Além disso, a cor é derivada da soma de ordinais, reduzindo a matriz bidimensional a escala quase linear.

### Decisão

**Suspender 9 Box para uso decisório até reconstruir governança.**

### Prioridade

**P0**

---

# 36. Capability Map confunde expert com mentor

O código usa:

```ts
mentors = [...experts, ...advanced];
```

`src/routes/capability-map.tsx:163-177`

Proficiência técnica não implica:

- disponibilidade;
- capacidade pedagógica;
- interesse;
- papel formal de mentor.

### Correção

Usar linguagem como:

> Potencial mentor técnico

até haver confirmação.

### Prioridade

**P1**

---

# 37. Capability Map pode declarar saúde sem nenhum expert

Lógica:

```ts
mentors.length === 0 ? noExpert : experts.length === 1 ? singlePerson : healthy;
```

Se existirem:

```text
0 experts
3 advanced
```

o resultado pode ser:

> healthy

mesmo sem expert.

### Prioridade

**P1 alto**

---

# 38. `category.short` pode causar colisão em gráficos

Na criação do domínio:

```ts
short: trimmed.split(" ")[0];
```

Exemplo:

```text
Cloud Security → Cloud
Cloud Platform → Cloud
```

Na tela Ciclos:

```ts
row[d.category.short] = d.avg;
```

`short` é utilizado como chave de série.

Uma série pode sobrescrever outra.

### Correção

Usar ID como chave.

`short` deve ser apenas label.

### Prioridade

**P1 alto**

---

# 39. Criação de competência inventa níveis esperados

Ao criar uma competência, níveis esperados por cargo recebem defaults.

### Problema

Nível esperado é uma regra organizacional.

Não deve ser inferido apenas porque o formulário precisa de um default.

### Correção

Exigir configuração explícita ou estado:

> Não definido

### Prioridade

**P1 alto**

---

# 40. Role Profiles possui múltiplas superfícies de edição

Targets aparecem em:

- Team / Role Profiles;
- Competency Matrix.

Isso cria duas portas para editar a mesma política.

### Regra

Definir uma única fonte administrativa principal.

Outras superfícies devem:

- mostrar;
- referenciar;
- deep-linkar.

### Prioridade

**P1**

---

# 41. Dashboard mistura métricas do ciclo e métricas globais

O shell possui seletor de ciclo global.

Mas:

- planos podem ser do ciclo;
- mentorias podem ser globais;
- trilhas são globais;
- evidências podem ser globais;
- score mistura períodos.

### Problema

Trocar:

```text
H1 → H2
```

não garante que todos os números passaram a representar H2.

### Prioridade

**P0/P1**

---

# 42. Dashboard não mostra cobertura dos assessments

Depois de adotar apenas `Completed` como fonte oficial, cobertura virou informação obrigatória.

Home deveria exibir:

```text
Assessment
7/10 concluídos
2 em revisão
1 não iniciado
```

Sem isso, o dashboard pode parecer representar todo o time quando representa apenas parte dele.

### Prioridade

**P0/P1**

---

# 43. Gap Analysis continua perdendo contexto no CTA

Ainda existe:

```tsx
<Link to="/development-plans">
```

`src/routes/gap-analysis.tsx:164-170`

O contexto de:

- pessoa;
- competência;
- gap;
- ciclo;

é descartado.

### Prioridade

**P0 para continuidade da jornada**

---

# 44. CTA agregado de Gap Analysis é semanticamente ambíguo

Uma prioridade pode dizer:

> Threat Modeling → 4 pessoas

Mas o CTA:

> Tratar no PDI

vai para uma experiência individual.

O produto ainda não decide se deve gerar:

- PDI individual;
- múltiplos PDIs;
- intervenção coletiva.

### Prioridade

**P1 alto**

---

# 45. IDs derivados de `slug(name)` são frágeis

Exemplo:

```ts
id: slug(form.name);
```

`src/routes/team.tsx:112-117`

Duas pessoas com mesmo nome produzem colisão.

IDs não deveriam depender de nome humano.

### Correção

Gerar UUID/ULID no backend.

### Prioridade

**P1 técnico**

---

# 46. IDs baseados em `Date.now()` não devem ser autoridade persistente

Aparecem em:

- PDI;
- trilha;
- item de trilha;
- mentoria;
- philosophy stage.

Para protótipo, pode funcionar.

Para produto multiusuário, backend deve ser autoridade.

### Prioridade

**P1/P2**

---

# 47. Ownership por email é frágil

Learning Paths usa:

```ts
createdBy: user.email;
```

e compara email para permitir edição.

### Problemas

Email:

- pode mudar;
- não é identificador imutável;
- não representa autorização.

### Correção

Utilizar `userId`.

### Prioridade

**P1**

---

# 48. Trilhas antigas sem autor ficam editáveis por qualquer pessoa

Regra:

```ts
!path.createdBy || ...
```

Trilha sem autor vira editável universalmente.

Migração de dados antigos não deveria significar:

> liberar escrita para todos.

### Correção

Fallback seguro:

> Admin only

até ownership ser migrado.

### Prioridade

**P1 alto**

---

# 49. Mutação otimista continua silenciosa em grande parte do produto

Padrão recorrente:

```text
atualiza UI local
→ chama API
→ console.error
→ refetch
```

O usuário pode interpretar sucesso e depois ver o estado voltar.

### Áreas impactadas

- Team;
- PDI;
- Matriz;
- Trilhas;
- 9 Box;
- Filosofia;
- Ciclos;
- outras mutações.

### Correção

Padronizar:

- saving;
- success;
- error;
- retry;
- rollback compreensível.

### Prioridade

**P1 alto**

---

# 50. PDI persiste texto durante digitação

`actionPlan` é salvo durante alterações do textarea.

### Riscos

- excesso de mutações;
- race conditions;
- rollback ruim;
- perda de texto;
- tráfego desnecessário.

### Alternativas

- estado local + Save;
- debounce robusto;
- indicador de sincronização.

### Prioridade

**P1 técnico/UX**

---

# 51. `/api/state` é risco arquitetural futuro

A aplicação inteira depende de um snapshot amplo:

```text
GET /api/state
```

Com crescimento do produto:

```text
competências
× pessoas
× ciclos
× assessments
× comentários
× PDIs
× evidências
× mentorias
× trilhas
```

o payload cresce continuamente.

### Riscos

#### Performance

Refetch amplo após mutações.

#### Privacidade

Precisa ser verificado se o backend filtra entidades por role.

### Prioridade

**Risco arquitetural obrigatório antes de escala real**

---

# 52. Nova classificação

| Dimensão                      | Avaliação |
| ----------------------------- | --------: |
| Proposta de valor             |       3/5 |
| Coerência das jornadas        |       2/5 |
| Assessment / governança       |       2/5 |
| Integridade dos dados         |       1/5 |
| Integridade temporal          |       1/5 |
| Modelo de permissões          |       1/5 |
| Continuidade entre telas      |       1/5 |
| Evidência / feedback loop     |       1/5 |
| Trilhas                       |       1/5 |
| Qualidade das métricas        |       1/5 |
| Testes de comportamento       |       2/5 |
| Automação / inteligência real |     1–2/5 |
| Maturidade geral              |   **2/5** |

---

# 53. Ordem rígida de atuação para os agentes

## 1. Fechar o lifecycle de Assessment

Corrigir:

- Draft → In Review → Completed;
- congelar `self` após submissão;
- impedir Draft → Completed;
- impedir Leader/Final durante Draft;
- remodelar comentários;
- proteger por role;
- testar componente real.

---

## 2. Corrigir semântica de ausência de dados

Eliminar zero fictício.

Corrigir:

- Capability Map;
- Gap Analysis;
- Team;
- Dashboard;
- médias;
- cobertura.

---

## 3. Corrigir o domínio de Learning Paths

Separar:

```text
catálogo da trilha
```

de:

```text
atribuição individual
```

e:

```text
progresso individual
```

---

## 4. Implantar autorização consistente

Validar:

- Member;
- Tech Lead;
- Admin;

no frontend e principalmente backend.

---

## 5. Bloquear destruição de histórico

Remover cascades destrutivos.

Introduzir:

- archive;
- inactive;
- versioning;
- snapshots.

---

## 6. Corrigir semântica temporal dos ciclos

Revisar:

- assessments;
- OKRs;
- trilhas;
- mentoring;
- evidence;
- dashboard;
- histórico.

---

## 7. Retirar ou suspender mecanismos não defensáveis

Principalmente:

- Development Score;
- 9 Box.

---

## 8. Fechar o loop operacional

```text
Gap
→ PDI
→ Activity
→ Evidence
→ Review
→ Future Assessment
```

---

## 9. Eliminar dados fabricados

Remover:

- domínio forte default;
- gap default;
- email inventado;
- Medium/Medium automático;
- SMART fictício;
- recomendações que não usam os sinais prometidos.

---

## 10. Só depois investir em expansão

Depois dos itens anteriores:

- Home;
- nova arquitetura da informação;
- automações;
- recomendação inteligente;
- dashboards avançados.

---

# 54. Gate recomendado

## Para considerar o core confiável

Itens **1–6** devem estar concluídos e testados.

## Para colocar diante de usuários reais

Também concluir:

- 7;
- 8.

## Somente depois

Investir em:

- IA;
- automações avançadas;
- expansão funcional;
- dashboards sofisticados.

---

# 55. Conclusão executiva

A segunda auditoria mostra que o principal risco do Synapse não é estética nem falta de funcionalidades.

O risco é:

> **transformar dados frágeis ou estados incompletos em decisões aparentemente confiáveis.**

O produto ainda confunde, em vários pontos:

> “existe um campo”

com:

> “essa informação é confiável para uma decisão”.

Isso aparece em:

- assessment final;
- Development Score;
- performance/potential;
- Learning Path progress;
- domains default;
- SMART;
- ausência de assessment;
- recomendações.

A próxima rodada dos agentes deveria ser tratada como:

# **Integridade de Domínio e Governança**

e não como:

> melhorias de UX.

Antes de sofisticar o Synapse, o produto precisa garantir que:

1. os dados significam o que a interface diz que significam;
2. estados preliminares não se tornam fatos oficiais;
3. ausência de informação não vira informação negativa;
4. histórico não é destruído;
5. permissões são reais;
6. métricas não misturam universos diferentes;
7. atividade individual realmente pertence à pessoa correta;
8. recomendações não inventam contexto.

A prioridade agora é **confiabilidade do produto**.
