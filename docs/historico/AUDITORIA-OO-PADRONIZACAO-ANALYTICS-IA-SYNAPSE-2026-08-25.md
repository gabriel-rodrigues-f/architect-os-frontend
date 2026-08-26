# AUDITORIA RIGOROSA — PADRONIZAÇÃO ENTERPRISE, ORIENTAÇÃO A OBJETOS, ANALYTICS E IA — SYNAPSE

**Data:** 25/08/2026
**Produto:** Synapse — Plataforma corporativa de avaliação, desenvolvimento e evolução de profissionais de tecnologia
**Escopo analisado:** frontend + backend anexados nesta rodada
**Referências arquiteturais indicadas pelo Product Owner:** `waldemarnt/forecast-node-api` e `FIAP-Squad/doctors-management-service`

---

# 1. Executive Summary

O Synapse atingiu um estágio de maturidade relevante.

O produto já não apresenta uma arquitetura puramente procedural. O backend contém uma migração clara para:

```text
Controller
→ Service
→ Repository
→ Domain Entity
→ Infrastructure
```

e o frontend já iniciou:

```text
UI
→ Gateway Interface
→ HttpGateway
→ ApiClient
```

Além disso, já existem:

- entidades ricas para Assessment e DevelopmentPlan;
- controllers orientados a classe;
- services orientados a classe;
- interfaces de repository;
- implementações Postgres;
- in-memory repositories para testes;
- composition root;
- gateways HTTP no frontend;
- classes de Design System;
- ApiClient encapsulado;
- modular monolith documentado;
- outbox;
- OpenAPI;
- ADRs;
- cookies HttpOnly;
- observabilidade;
- health/readiness;
- Docker multi-stage.

Portanto:

> **a aplicação não precisa ser reescrita. Ela precisa concluir uma transição arquitetural que já começou.**

O principal problema atual é a coexistência de dois paradigmas.

No backend não-testado foram identificados aproximadamente:

```text
66 classes
155 function declarations
59 arrow functions atribuídas a const
128 interfaces
```

No frontend não-testado:

```text
22 classes
205 function declarations
167 arrow functions atribuídas a const
86 interfaces
```

Esses números não significam, isoladamente, código ruim.

Eles demonstram que o objetivo solicitado nesta rodada — **orientação a objetos máxima e eliminação de funções soltas** — ainda está distante, principalmente no frontend.

O backend possui a estrutura correta, mas ainda mantém:

- mappers como funções exportadas;
- helpers privados como funções de módulo;
- factories/composition functions;
- singletons exportados;
- auth procedural;
- scope procedural;
- SQL helpers procedurais;
- outbox procedural;
- analytics com funções puras de módulo;
- scripts e bootstrap procedurais.

No frontend, a discrepância é maior:

- routes concentram regras;
- componentes compartilhados possuem dezenas de funções;
- `store.tsx` continua centralizador;
- `selectors.ts` é inteiramente funcional;
- `text.ts`, scope, i18n e relatórios possuem helpers soltos;
- container de gateways exporta instâncias globais por `const`;
- function components concentram estado de aplicação e orquestração;
- view logic, application logic e presentation logic ainda se misturam.

---

# 2. Veredito sobre o pedido "nenhuma function ou const solta"

O objetivo é possível **no backend e nas camadas de negócio do frontend**.

Entretanto, existe uma ressalva importante:

## Não recomendo converter React function components para React class components.

React moderno é construído em torno de:

```text
function components
hooks
composition
```

Forçar:

```text
class extends React.Component
```

em toda a UI apenas para afirmar que "tudo é classe":

- vai contra a arquitetura natural do React;
- piora integração com hooks;
- aumenta boilerplate;
- reduz reaproveitamento do ecossistema;
- torna TanStack Router/Query menos natural;
- não adiciona encapsulamento real ao domínio.

Portanto o target recomendado é:

> **OO estrito em Domain, Application, Infrastructure, Gateways, Presenters, ViewModels, Selectors, Policies, Mappers, Services e State Controllers.**

E:

> **React function components permanecem apenas como adapters declarativos extremamente finos.**

Regra proposta:

```text
React component pode ser função.
React component NÃO pode conter regra de negócio.
React component NÃO pode calcular regra de carreira.
React component NÃO pode implementar autorização.
React component NÃO pode montar payload complexo.
React component NÃO pode acessar fetch diretamente.
React component NÃO pode conhecer regra de persistência.
```

A função React passa a ser equivalente a um controller de framework:

```tsx
function DevelopmentPlansPage() {
  const viewModel = useDevelopmentPlansViewModel();
  return <DevelopmentPlansView viewModel={viewModel} />;
}
```

Todo o comportamento relevante passa a morar em objetos.

Este é o máximo de orientação a objetos que preserva excelência técnica no React.

---

# 3. Leitura das referências arquiteturais

## 3.1 `forecast-node-api`

A referência utiliza uma organização mais clássica:

```text
clients
controllers
middlewares
models
services
util
```

O ponto útil para o Synapse é a encapsulação de comportamento dentro de classes de serviço.

Exemplo conceitual observado:

```text
Forecast
  processForecastForBeaches()
  mapForecastByTime()
  enrichedBeachData()
```

Ou seja:

- estado/dependências no objeto;
- operações públicas explícitas;
- algoritmos auxiliares como métodos privados;
- consumidor não conhece os detalhes internos.

### O que aproveitar

- encapsulamento;
- serviços como objetos;
- dependência por construtor;
- métodos privados em vez de helpers dispersos.

### O que NÃO copiar literalmente

O Synapse já é muito maior e possui domínio significativamente mais complexo.

Uma organização apenas por:

```text
controllers/
services/
models/
```

seria insuficiente.

O Synapse deve permanecer organizado por **bounded context / módulo de negócio**.

---

# 3.2 `doctors-management-service`

Esta é a referência mais relevante para o objetivo pretendido.

A organização encontrada separa:

```text
domain
infrastructure
main
usecases
```

e utiliza:

- entidades;
- Value Objects;
- interfaces;
- use cases em classes;
- repositories/gateways;
- factories;
- controllers;
- dependency inversion.

Também existe um padrão como:

```text
Doctor
  ├─ Name
  ├─ Email
  ├─ CPF
  └─ CRM
```

com factory:

```text
Doctor.create(...)
```

e use case:

```text
CreateDoctor
```

dependendo de interfaces de repository/gateway.

### Esse é o padrão conceitual mais adequado ao Synapse.

Mas deve ser aplicado **por contexto**, não globalmente.

---

# 4. Arquitetura alvo recomendada

O Synapse deve evoluir para:

# Modular Monolith + Clean Architecture + DDD + OO

Estrutura conceitual:

```text
src/
  modules/
    assessment/
      domain/
      application/
      infrastructure/
      presentation/

    development/
      domain/
      application/
      infrastructure/
      presentation/

    catalog/
    career/
    people/
    mentoring/
    evidence/
    learning/
    evolution/
    reporting/
    identity/
```

Cada módulo deve ser uma mini aplicação Clean Architecture.

---

# 5. Estrutura padrão por módulo

Exemplo:

```text
modules/
  assessment/
    domain/
      entities/
        Assessment.ts
        AssessmentItem.ts

      value-objects/
        AssessmentStatus.ts
        AssessmentTarget.ts
        ProficiencyLevel.ts

      events/
        AssessmentCompleted.ts
        AssessmentReopened.ts

      policies/
        AssessmentTransitionPolicy.ts

      repositories/
        AssessmentRepository.ts

    application/
      use-cases/
        OpenAssessment.ts
        SubmitAssessment.ts
        CompleteAssessment.ts
        ReopenAssessment.ts
        UpdateAssessmentItem.ts

      dto/
        CompleteAssessmentInput.ts
        CompleteAssessmentOutput.ts

      ports/
        EvolutionEventPublisher.ts

    infrastructure/
      persistence/
        postgres/
          PostgresAssessmentRepository.ts
          AssessmentRowMapper.ts
          AssessmentSql.ts

    presentation/
      http/
        AssessmentController.ts
        AssessmentRoutes.ts
        AssessmentPresenter.ts
```

Este deve ser o template replicado.

---

# 6. Regra de dependência

Obrigatória:

```text
Presentation
     ↓
Application
     ↓
Domain
```

Infrastructure implementa portas:

```text
Infrastructure
     ↓
Domain/Application interfaces
```

Nunca:

```text
Domain → Fastify
Domain → PostgreSQL
Domain → Redis
Domain → HTTP
```

---

# 7. Estado atual do backend

## Avaliação: 7,8/10 arquitetural

A base é forte.

Os principais módulos já possuem:

```text
Controller
Service
Repository interface
PostgresRepository
InMemoryRepository
```

Isso é uma excelente fundação.

Entretanto, ainda não existe padronização OO completa.

---

# 8. Problema backend — repository contém responsabilidades demais

Exemplo:

```text
modules/assessment/assessment.repository.ts
```

possui aproximadamente 950 linhas.

Dentro do mesmo arquivo existem:

- row interfaces;
- mappers;
- constants de SQL;
- helpers de materialização;
- query orchestration;
- repository interface;
- Postgres implementation;
- singleton da implementação.

Isso viola a separação desejada.

---

# 9. Refatoração alvo de repository

Em vez de:

```text
assessment.repository.ts
```

criar:

```text
domain/repositories/AssessmentRepository.ts

infrastructure/persistence/postgres/
  PostgresAssessmentRepository.ts
  AssessmentRow.ts
  AssessmentRowMapper.ts
  AssessmentSql.ts
  AssessmentMaterializer.ts
```

---

# 10. `RowMapper` como objeto

Hoje existem funções como:

```text
toAssessment
toAssessmentItem
toAssessmentCapability
toAssessmentDevelopmentSummary
```

Transformar em:

```ts
export interface Mapper<TRow, TDomain> {
  toDomain(row: TRow): TDomain;
}
```

Implementações:

```text
AssessmentRowMapper
AssessmentItemRowMapper
AssessmentCapabilityRowMapper
DevelopmentSummaryRowMapper
```

---

# 11. Generic mapper

Uso inteligente de generics:

```ts
export interface Mapper<TRow, TDomain> {
  toDomain(row: TRow): TDomain;
  toPersistence?(domain: TDomain): Partial<TRow>;
}
```

Não criar um mapper genérico mágico baseado em reflection.

Cada domínio continua possuindo implementação explícita.

---

# 12. Base repository

Não recomendo criar:

```text
GenericCrudRepository<T>
```

com:

```text
create
read
update
delete
```

para todos os agregados.

Isso destruiria DDD.

Os repositories precisam expressar o domínio.

Exemplo:

```ts
interface AssessmentRepository {
  findById(id: AssessmentId): Promise<Assessment | null>;
  lock(id: AssessmentId): Promise<Assessment | null>;
  save(assessment: Assessment): Promise<void>;
}
```

Não:

```ts
repository.update({ status: ... })
```

---

# 13. O reaproveitamento correto no repository

Criar uma classe infraestrutura base apenas para mecânica:

```ts
abstract class PostgresRepository {
  constructor(
    protected readonly executor: SqlExecutor,
    protected readonly transactionManager: TransactionManager,
  ) {}
}
```

Ela pode oferecer:

```text
queryOne
queryMany
exists
execute
```

Mas não deve definir CRUD de domínio.

---

# 14. SqlExecutor

Hoje existem helpers procedurais em:

```text
db/pool.ts
db/sql.ts
```

Transformar em objetos.

Exemplo:

```ts
interface SqlExecutor {
  query<T>(query: SqlQuery): Promise<T[]>;
  queryOne<T>(query: SqlQuery): Promise<T | null>;
}
```

Implementação:

```text
PostgresSqlExecutor
```

---

# 15. Transaction Manager

Atual:

```text
UnitOfWork
```

já é conceitualmente bom.

Padronizar como interface OO:

```ts
interface TransactionManager {
  execute<T>(operation: TransactionalOperation<T>): Promise<T>;
}
```

Onde:

```ts
interface TransactionalOperation<T> {
  execute(context: TransactionContext): Promise<T>;
}
```

Ou manter callback internamente se isso reduzir complexidade.

Não é necessário transformar absolutamente todo callback em classe se ele for detalhe privado de implementação.

---

# 16. Domain Entities

Hoje o melhor exemplo são:

```text
Assessment
DevelopmentPlan
```

Esse padrão deve ser expandido.

---

# 17. Entidades candidatas

## Capability

Hoje ainda é majoritariamente estrutura de dados.

Deve evoluir para:

```text
Capability
  addCompetency()
  archive()
  activate()
  canAcceptRequirementType()
  evaluateCurationStatus()
```

---

## Competency

```text
Competency
  rename()
  archive()
  changeRequirementType()
  setExpectation()
```

---

## MentoringSession

```text
MentoringSession
  recordObservation()
  scheduleFollowUp()
  close()
```

---

## Evidence

```text
Evidence
  submit()
  approve()
  reject()
  resubmit()
```

---

## CareerLevel

```text
CareerLevel
  next()
  isMastery()
```

---

# 18. Value Objects

Esta é a principal lacuna de DDD do código atual.

Inspirado no padrão:

```text
Name
Email
CPF
CRM
```

da referência, o Synapse pode ter Value Objects reais.

---

# 19. `ProficiencyLevel`

Hoje nível é essencialmente:

```text
1 | 2 | 3 | 4 | 5
```

Criar:

```ts
class ProficiencyLevel {
  private constructor(private readonly value: number) {}

  static of(value: number): ProficiencyLevel

  isGreaterThan(other: ProficiencyLevel): boolean

  gapTo(target: ProficiencyLevel): Gap

  equals(other: ProficiencyLevel): boolean
}
```

Isso remove cálculos:

```text
target - final
```

espalhados.

---

# 20. `Gap`

```ts
class Gap {
  static between(current: ProficiencyLevel, target: ProficiencyLevel): Gap

  severity(): GapSeverity

  isClosed(): boolean

  priority(): DevelopmentPriority
}
```

Toda regra de prioridade fica encapsulada.

---

# 21. `Dedication`

```ts
class Dedication {
  static hoursPerWeek(value: number): Dedication
}
```

Protege:

- mínimo;
- máximo;
- unidade;
- formato.

---

# 22. `CareerRank`

```ts
class CareerRank {
  next(): CareerRank | Mastery
}
```

Evita:

```text
rank + 1
```

espalhado.

---

# 23. `DateRange`

Extremamente útil para:

- analytics;
- relatórios;
- evolução;
- filtros.

```ts
class DateRange {
  contains(date: LocalDate): boolean
  days(): number
}
```

---

# 24. `LocalDate`

O produto já enfrentou bugs de:

```text
UTC x data local
```

Transformar isso em Value Object elimina grande parte do risco.

---

# 25. IDs tipados

Atualmente muitos IDs são:

```text
string
```

Criar tipos/classes:

```text
ArchitectId
AssessmentId
CompetencyId
CapabilityId
PlanId
```

Não precisa ser objeto pesado em runtime.

Pode ser uma pequena classe imutável ou branded wrapper.

Como o objetivo solicitado é OO máximo:

```ts
class AssessmentId extends EntityId {}
```

---

# 26. Domain Policies

Muitas regras hoje estão em services/helpers.

Transformar regras reutilizáveis em objetos de política.

Exemplo:

```text
CareerEligibilityPolicy
CapabilityQualificationPolicy
AssessmentCompletionPolicy
PlanPriorityPolicy
PortfolioPolicy
```

---

# 27. Strategy Pattern

Exemplo particularmente adequado:

```text
AssessmentTargetStrategy
```

Implementações:

```text
NextCareerLevelTargetStrategy
MasteryTargetStrategy
```

Evita condicionais repetidos:

```text
if targetSemantics === ...
```

---

# 28. Specification Pattern

Útil para regras como:

```text
capacidade qualificada
profissional elegível
evidência aceitável
```

Exemplo:

```ts
interface Specification<T> {
  isSatisfiedBy(candidate: T): boolean;
}
```

Não usar Specification para filtros triviais de UI.

---

# 29. Domain Events

Já existe outbox.

A direção é correta.

Padronizar eventos como classes.

Hoje:

```text
AssessmentCompletedEvent interface
```

Alvo:

```ts
class AssessmentCompleted implements DomainEvent {
  readonly occurredAt: Date;
}
```

---

# 30. DomainEvent base

```ts
interface DomainEvent<TPayload> {
  readonly eventId: EventId;
  readonly occurredAt: Date;
  readonly aggregateId: EntityId;
  readonly payload: TPayload;
}
```

---

# 31. Event Publisher

Application layer depende de:

```text
DomainEventPublisher
```

Infrastructure implementa:

```text
OutboxDomainEventPublisher
```

Isso prepara o produto para microsserviços sem implementar broker.

---

# 32. Use Cases

Hoje os `Service` possuem múltiplos casos de uso.

Exemplo:

```text
CatalogService
```

tem dezenas de métodos.

No target OO extremo, separar:

```text
CreateCapability
UpdateCapability
ArchiveCapability
CreateCompetency
SwapCompetencyRequirement
```

Cada use case:

```ts
class CreateCompetency
  implements UseCase<CreateCompetencyInput, CompetencyOutput>
```

---

# 33. Generic UseCase

```ts
interface UseCase<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>;
}
```

Este é um generic adequado.

---

# 34. Services de domínio versus use cases

Não chamar tudo de:

```text
Service
```

Separar:

## Application Use Case

Orquestra:

- repository;
- transaction;
- event;
- authorization port.

## Domain Service

Executa regra que não pertence naturalmente a uma entidade.

Exemplo:

```text
CareerEligibilityEvaluator
```

---

# 35. Controllers

Os controllers atuais são classes.

Manter.

Padronizar:

```text
Controller
  → UseCase
  → Presenter
```

Controller não deve:

- calcular regra;
- montar SQL;
- calcular GAP;
- decidir prioridade;
- formatar resposta complexa.

---

# 36. Presenter

Criar presenters.

Exemplo:

```text
AssessmentPresenter
DevelopmentPlanPresenter
EvolutionPresenter
```

Responsável por:

```text
Domain/Application DTO
→ API response
```

Isso reduz acoplamento de API ao domínio.

---

# 37. Request Mapper

Para payloads complexos:

```text
AssessmentRequestMapper
MentoringRequestMapper
ReportFilterRequestMapper
```

Não espalhar:

```text
body.x ?? ...
```

por controllers.

---

# 38. Erros

Hoje existem muitas classes Error locais.

Padronizar hierarquia:

```text
DomainError
ApplicationError
InfrastructureError
```

Subclasses:

```text
InvalidTransitionError
EntityNotFoundError
VersionConflictError
AuthorizationError
```

---

# 39. ErrorCode

Toda exceção deve possuir:

```text
code
```

imutável.

Exemplo:

```ts
abstract class ApplicationError extends Error {
  abstract readonly code: string;
}
```

---

# 40. Composition Root backend

Hoje:

```text
buildContainer()
```

é uma função.

No target solicitado:

```text
ApplicationContainer
```

---

# 41. `ApplicationContainer`

```ts
class ApplicationContainer {
  readonly assessment: AssessmentModule;
  readonly catalog: CatalogModule;
  ...

  static create(config: ApplicationConfig): ApplicationContainer
}
```

---

# 42. Módulos como objetos

```ts
class AssessmentModule {
  readonly repository: AssessmentRepository;
  readonly completeAssessment: CompleteAssessment;
  readonly controller: AssessmentController;
}
```

Isso elimina dezenas de:

```text
const service = new ...
const controller = new ...
```

soltos.

---

# 43. Repository singleton

Hoje existem:

```text
assessmentRepository
catalogRepository
developmentRepository
...
```

exportados como const.

Remover.

Somente o container deve instanciar implementações.

---

# 44. Auth backend

Arquivos como:

```text
auth/scope.ts
auth/users.ts
auth/plugin.ts
```

ainda possuem grande quantidade de funções.

Refatorar para:

```text
AuthorizationService
UserAccountService
SessionService
PasswordPolicy
AuthenticationPlugin
```

---

# 45. AuthorizationService

```ts
class AuthorizationService {
  canViewArchitect(user: User, architect: Architect): boolean
  canManagePlan(...)
  canReopenPlan(...)
  visibleArchitectIds(...)
}
```

Atenção:

> autorização continua obrigatoriamente no backend.

---

# 46. Policies de autorização

Para evitar `AuthorizationService` gigante:

```text
ArchitectAccessPolicy
PlanAccessPolicy
AssessmentAccessPolicy
MentoringAccessPolicy
```

---

# 47. Outbox

Hoje ainda possui funções soltas em:

```text
outbox/outbox.ts
```

Transformar em:

```text
Outbox
OutboxDispatcher
OutboxHandlerRegistry
OutboxPurger
```

---

# 48. Cache

Já existe:

```text
Cache
```

Boa direção.

Finalizar:

```text
CacheKeyFactory
CacheInvalidationPolicy
```

em vez de const/functions globais.

---

# 49. Configuração

Transformar:

```text
env.ts
```

em:

```text
ApplicationConfig
DatabaseConfig
SecurityConfig
CacheConfig
```

imutáveis.

---

# 50. Backend — priorização de migração OO

## P0

Não alterar regra de negócio durante refatoração.

## P1

1. repositories;
2. mappers;
3. domain Value Objects;
4. use cases;
5. composition root;
6. auth/scope;
7. outbox.

## P2

8. DB helpers;
9. scripts;
10. metrics;
11. bootstrap.

---

# 51. Frontend — estado atual

## Avaliação arquitetural: 6,4/10

O frontend está funcionalmente forte e visualmente consistente.

Arquiteturalmente, ainda é predominantemente funcional.

Há aproximadamente:

```text
22 classes
205 functions
167 const arrow functions
```

fora de testes.

Isso é natural para React.

Mas está distante do target solicitado.

---

# 52. Elementos frontend já orientados a objeto

Pontos positivos:

```text
ApiClient
HttpAssessmentGateway
HttpDevelopmentGateway
HttpEvolutionGateway
HttpCatalogGateway
...
```

e:

```text
Oklch
Scale
ChartPalette
Theme strategies
StylesheetBuilder
```

Há uma fundação muito útil.

---

# 53. Gateway pattern

Manter e expandir.

Cada bounded context:

```text
AssessmentGateway
CatalogGateway
CareerGateway
DevelopmentGateway
MentoringGateway
EvolutionGateway
```

está conceitualmente correto.

---

# 54. Problema — container frontend procedural

Hoje:

```text
defaultApiClient
cyclesGateway
architectsGateway
careerGateway
...
```

são exports globais.

Criar:

```text
FrontendContainer
```

---

# 55. `FrontendContainer`

```ts
class FrontendContainer {
  readonly apiClient: ApiClient;
  readonly assessmentGateway: AssessmentGateway;
  readonly developmentGateway: DevelopmentGateway;
  ...

  static create(config: FrontendConfig): FrontendContainer
}
```

---

# 56. Provider

O React recebe container por:

```text
DependencyProvider
```

Context apenas para DI.

Isso permite:

- testes;
- mock gateway;
- multi-environment;
- isolamento.

---

# 57. Application Services frontend

Hoje routes chamam store/gateway e controlam estados.

Criar classes:

```text
AssessmentApplicationService
DevelopmentPlanApplicationService
MentoringApplicationService
EvolutionApplicationService
```

---

# 58. ViewModels

Principal recomendação para alcançar OO sem destruir React.

Exemplo:

```text
DevelopmentPlansViewModel
```

Ela encapsula:

- item selecionado;
- permissões de apresentação;
- ações;
- loading;
- erro;
- filtros;
- ordenação.

---

# 59. Presenter/ViewModel pattern

Arquitetura:

```text
Route Adapter
↓
ViewModel
↓
Application Service
↓
Gateway
```

React:

```text
View
```

---

# 60. Exemplo de Page Object

```ts
class DevelopmentPlansViewModel {
  constructor(
    private readonly service: DevelopmentPlanApplicationService,
    private readonly authorization: UiAuthorizationPolicy,
  ) {}

  async approve(): Promise<void>
  async reopen(reason: string): Promise<void>
  get suggestions(): readonly GapViewData[]
}
```

---

# 61. Hooks

Hooks podem continuar existindo somente como adaptadores.

Exemplo:

```ts
function useDevelopmentPlansViewModel() {
  return useMemo(() => container.createDevelopmentPlansViewModel(), []);
}
```

Idealmente cada hook contém pouquíssima regra.

---

# 62. Selectors

Hoje:

```text
lib/selectors.ts
```

tem muitas funções.

Transformar em:

```text
ArchitectSelectors
AssessmentSelectors
DevelopmentSelectors
CapabilitySelectors
```

ou:

```text
ReadModel
```

---

# 63. Query Objects

Excelente candidato ao estilo OO.

Exemplo:

```text
ArchitectByIdQuery
ProgressionGapsQuery
CapabilityCoverageQuery
```

---

# 64. State

O atual `store.tsx` ainda é grande.

Recomendação:

não criar um mega `Store` class.

Separar por contexto:

```text
AssessmentState
DevelopmentState
CatalogState
CareerState
```

Mas utilizar React Query como mecanismo de cache.

O objeto deve encapsular **semântica**, não duplicar o cache.

---

# 65. Commands

Crie Commands como objetos em jornadas complexas.

Exemplo:

```text
CompleteAssessmentCommand
CreatePlanFromGapCommand
ReopenDevelopmentPlanCommand
RecordMentoringCommand
```

---

# 66. Frontend DTOs

Não usar diretamente tipos de Domain em toda a UI.

Criar:

```text
ViewData
```

Exemplos:

```text
GapRowViewData
CapabilityCardViewData
ArchitectSummaryViewData
```

---

# 67. Presenter frontend

```text
GapAnalysisPresenter
DashboardPresenter
EvolutionPresenter
```

Recebe read models e produz dados prontos para renderização.

Com isso, componentes deixam de fazer:

```text
filter
map
reduce
sort
```

complexos.

---

# 68. Funções de formatação

Hoje:

```text
text.ts
labels.ts
```

possuem helpers.

No target solicitado:

```text
DateFormatter
PercentageFormatter
ProficiencyFormatter
NameFormatter
```

---

# 69. `LocalDateFormatter`

Centraliza pt-BR e elimina bugs UTC.

---

# 70. Scope frontend

Hoje:

```text
scope.ts
```

possui funções.

Transformar em:

```text
UiAuthorizationPolicy
```

Mas lembrar:

> isso é apenas apresentação.

Nunca é segurança real.

---

# 71. i18n

Não transformar cada tradução em objeto.

Mas o registry pode ser encapsulado em:

```text
TranslationRegistry
```

e o acesso:

```text
Translator
```

---

# 72. React components

O código contém componentes muito grandes.

Prioridade:

```text
assessments-shared.tsx ~1.289 linhas
development-plans.tsx ~1.193
team-shared.tsx ~998
competency-matrix.tsx ~964
AppShell.tsx ~911
learning-paths.tsx ~885
mentoring-shared.tsx ~834
```

Esse é um problema maior que "function vs class".

---

# 73. Componentes devem virar Views pequenas

Meta recomendada:

```text
page adapter < 120 linhas
feature view < 250 linhas
primitive < 150 linhas
```

Não aplicar como regra cega.

Mas arquivos com 800–1.300 linhas devem ser decompostos.

---

# 74. Estrutura frontend alvo

```text
src/
  modules/
    assessment/
      domain/
      application/
      infrastructure/
      presentation/
        view-models/
        presenters/
        components/
        pages/

    development/
    mentoring/
    catalog/
    evolution/

  shared/
    domain/
    application/
    infrastructure/
    design-system/
```

---

# 75. Frontend e DDD

Não duplicar todo o domínio backend.

Frontend precisa de:

```text
Domain Model de interação
```

não uma réplica integral.

Exemplo:

backend:

```text
Assessment aggregate completo
```

frontend:

```text
AssessmentReadModel
AssessmentEditModel
```

---

# 76. Generic classes frontend

Bom uso:

```text
PagedCollection<T>
FilterState<TFilter>
SortState<TField>
AsyncState<T>
Selection<TId>
```

---

# 77. `PagedCollection<T>`

```ts
class PagedCollection<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly total: number;

  hasNext(): boolean
  hasPrevious(): boolean
}
```

---

# 78. `Selection<TId>`

Elimina novamente o problema:

```text
[] = todos
```

Exemplo:

```ts
abstract class Selection<TId> {}

class AllSelection<TId> extends Selection<TId> {}

class ExplicitSelection<TId> extends Selection<TId> {
  constructor(readonly ids: ReadonlySet<TId>) { ... }
}
```

---

# 79. Visual Standardization — diagnóstico

Visualmente o produto já possui identidade enterprise.

Pontos fortes:

- azul-marinho consistente;
- fundo neutro;
- cards discretos;
- hierarquia de títulos boa;
- tipografia sóbria;
- badges coerentes;
- heatmaps úteis;
- navegação lateral clara;
- paleta de proficiência estável.

Não recomendo redesign.

---

# 80. Padrão visual oficial

Criar uma specification:

```text
SYNAPSE DESIGN STANDARD 1.0
```

---

# 81. Grid

Utilizar baseline:

```text
4px
```

Escala principal:

```text
4
8
12
16
24
32
48
64
```

Já está muito próximo do código atual.

Congelar como padrão.

---

# 82. Container

Definir:

```text
Data pages: 1600–1800px
Standard pages: 1440px
Forms: 960px
```

---

# 83. PageHeader

Todas as páginas:

```text
Título
Descrição de 1 linha
Contexto
Ação primária à direita
```

Máximo:

```text
1 ação primária
2 secundárias visíveis
restante em menu
```

---

# 84. Cards

Padronizar 4 tipos:

```text
KpiCard
SummaryCard
ActionCard
DetailCard
```

Não usar um único card genérico para tudo.

---

# 85. KPIs

Layout:

```text
label 11–12px uppercase
valor 28–32px
delta/contexto 12px
```

Máximo recomendado no dashboard principal:

```text
4 KPIs primários
4 secundários
```

---

# 86. Tables

Criar:

```text
EnterpriseDataTable
```

Características:

- sticky header;
- sticky identity column;
- sort;
- filter;
- pagination;
- loading;
- empty;
- error;
- keyboard;
- column alignment;
- column visibility.

---

# 87. Filter bar

Criar padrão único:

```text
[Busca] [Período] [Capacidade] [Filtros]        [Ordenar] [X resultados]
```

Chips abaixo.

---

# 88. Dialogs

Padrão:

```text
sm = 480px
md = 640px
lg = 768px
xl = 960px
```

Não escolher largura individual em cada tela.

---

# 89. Modal body

```text
max-height: 85vh
```

Header e footer estáveis.

Body scrollável.

---

# 90. Form grid

```text
mobile = 1 coluna
tablet = 2
desktop = no máximo 3
```

---

# 91. Visualização de proficiência

Criar um único componente:

```text
ProficiencyBadge
```

Não repetir:

```text
L1
L2
L3
```

com estilos locais.

---

# 92. GAP

Criar:

```text
GapBadge
GapSeverityIndicator
```

com significado único.

---

# 93. Cores

Nunca reutilizar cores de nível para status operacional.

Exemplo:

```text
verde L4/L5
```

não significa automaticamente:

```text
Approved
```

Semânticas devem ser separadas.

---

# 94. Chart Standard

Criar:

```text
ChartCard
ChartLegend
ChartEmptyState
ChartTooltip
```

---

# 95. Paleta de gráficos

Usar tokens.

Nunca:

```text
hex hardcoded no componente
```

---

# 96. Regras de charts

Máximo:

```text
6 séries
```

por gráfico default.

Se houver mais:

- seleção;
- drill-down;
- small multiples;
- heatmap.

---

# 97. Dados de chart

Todo chart deve fornecer tabela acessível equivalente.

---

# 98. Padronização de scroll

## Página

Usar scroll normal para narrativa.

## Data table

Scroll interno horizontal.

## Side insight panel

Pode ter scroll vertical.

## Timeline

Nunca colocar scroll interno por default.

## Modal

Body rolável.

---

# 99. Intelligence Layer — oportunidade estratégica

O produto agora possui uma base de dados extremamente valiosa:

```text
Assessment
GAP
PDI
Mentoria
Evidence
Career progression
Historical observations
Snapshots
Capability
Competency
```

Isso permite analytics e IA com valor real.

---

# 100. Regra de IA

IA nunca deve:

- promover automaticamente;
- definir nível final sem humano;
- reprovar profissional;
- escolher competência restritiva;
- alterar PDI sozinha;
- calcular um "score secreto".

IA deve:

> **explicar, resumir, recomendar, detectar padrões e apoiar decisão humana.**

---

# 101. Dashboard Tech Lead — gráficos recomendados

## 101.1 Capability Risk Matrix

Eixo X:

```text
cobertura do time
```

Eixo Y:

```text
gap médio
```

Tamanho da bolha:

```text
quantidade de profissionais
```

Cor:

```text
proporção de competências restritivas não atendidas
```

Permite identificar:

```text
capacidade crítica
+
muita gente afetada
```

---

# 102. Capability Coverage Trend

Linha:

```text
% do time qualificado na capacidade
```

ao longo do tempo.

Excelente para medir se o programa de desenvolvimento está funcionando.

---

# 103. Progression Funnel

```text
Profissionais
→ portfólio completo
→ Assessment concluído
→ capacidades mínimas atingidas
→ elegíveis ao próximo nível
```

Ajuda a localizar gargalo de carreira.

---

# 104. GAP Closure Velocity

Métrica:

```text
GAP inicial
vs
GAP atual
```

ao longo do tempo.

---

# 105. Development Investment vs Evolution

Scatter:

X:

```text
dedicação média
```

Y:

```text
evolução observada
```

Não declarar causalidade.

Usar como sinal exploratório.

---

# 106. Dashboard Arquiteto — gráficos

## 106.1 Current vs Target Radar

Radar pequeno:

```text
nível atual por capacidade
vs
target
```

Limitar a capacidades do portfólio.

---

# 107. Gap Closure Waterfall

Mostrar:

```text
gap inicial
- evolução competência A
- evolução competência B
= gap atual
```

Excelente narrativa de progresso.

---

# 108. Competency Trajectory

Linha/degrau:

```text
L1 → L2 → L3
```

com marcadores:

- Assessment;
- Mentoria;
- evidência.

---

# 109. PDI Progress Burndown

Não como Scrum.

Mostrar:

```text
ações abertas
ações concluídas
ações bloqueadas
```

ao longo do tempo.

---

# 110. Evidence Strength

Gráfico por competência:

```text
quantidade
+
qualidade/review status
```

Evitar score subjetivo automático.

---

# 111. Painel executivo — gráficos

## Capability Portfolio Health

Heatmap:

```text
capacidade × time
```

já existente.

Complementar com:

```text
coverage
gap
trend
```

---

# 112. Concentration Risk

Identificar capacidades dominadas por poucas pessoas.

Exemplo:

```text
Cloud avançado:
80% do nível avançado concentrado em 1 profissional
```

Isso é risco organizacional real.

---

# 113. Bus Factor de competência

Sem chamar literalmente "bus factor" na UI se soar negativo.

Nome:

```text
Concentração de conhecimento
```

---

# 114. Capability Readiness

Para cada capacidade:

```text
quantos profissionais atendem mínimo
quantos estão 1 nível abaixo
quantos possuem gap crítico
```

---

# 115. IA — Copilot de preparação para 1:1

Local:

```text
Mentoria
```

Botão:

```text
Preparar 1:1
```

IA produz:

- principais mudanças desde última conversa;
- PDIs atrasados;
- evidências recentes;
- competências que evoluíram;
- GAPs persistentes;
- pontos de Start/Stop/Continue;
- perguntas sugeridas.

---

# 116. Guardrail do Copilot

Toda afirmação deve apontar para a fonte:

```text
Assessment 2026 H1
Mentoria 01/08
Evidence #123
PDI item X
```

Sem fonte:

```text
não apresentar como fato.
```

---

# 117. IA — PDI Recommendation Assistant

Ao selecionar GAP:

IA sugere:

```text
objetivo SMART
ação
evidência esperada
dedicação estimada
```

Mas usuário aprova/edita.

---

# 118. IA — Evidence Reviewer Assistant

Não aprovar automaticamente.

A IA pode indicar:

```text
relevância para competência
clareza
resultado demonstrado
nível de autonomia
lacunas de evidência
```

Tech Lead decide.

---

# 119. IA — Assessment Calibration Assistant

Comparar:

```text
self
vs
leader
vs
histórico
vs
evidências
```

Sinalizar:

```text
diferença relevante
```

Exemplo:

```text
Autoavaliação L4
Tech Lead L2
Histórico L2
```

Não dizer automaticamente qual é correto.

---

# 120. IA — Stagnation Detector

Detectar padrões:

```text
mesmo GAP por 3 ciclos
PDI continuamente bloqueado
sem evidência
sem evolução
```

Apresentar:

```text
Requer atenção
```

Não:

```text
baixo desempenho
```

---

# 121. IA — Catalog Quality Assistant

Para administradores.

Detectar:

- competências duplicadas semanticamente;
- nomes sobrepostos;
- descrição vaga;
- competência excessivamente ampla;
- expectativa inconsistente entre níveis.

Excelente uso de IA porque não avalia pessoa diretamente.

---

# 122. IA — Natural Language Analytics

Exemplo:

```text
"Quais arquitetos evoluíram em Arquitetura Corporativa nos últimos 90 dias?"
```

IA traduz para filtros e consulta estruturada.

Resposta deve ser produzida a partir do analytics determinístico.

Modelo não deve inventar dados.

---

# 123. IA — Career Readiness Explanation

O motor determinístico calcula:

```text
eligible = true/false
```

A IA apenas explica:

```text
Você atende 4 de 5 capacidades exigidas.
A capacidade que ainda bloqueia é Segurança.
As competências restritivas abaixo do alvo são...
```

Essa é uma excelente aplicação de IA explicativa.

---

# 124. IA — Executive Narrative

Para relatório PDF:

```text
Resumo executivo gerado
```

baseado em dataset calculado.

Exemplo:

```text
"No período, a cobertura média de Arquitetura Corporativa subiu de X para Y..."
```

Toda frase deve nascer de métricas estruturadas.

---

# 125. IA proibida

Não implementar:

```text
"score de talento"
"risco de demissão"
"probabilidade de promoção"
"ranking automático de arquitetos"
"potencial humano"
```

sem uma governança muito mais profunda.

São recursos de alto risco e baixo ganho neste estágio.

---

# 126. AI architecture

Criar bounded context futuro:

```text
Decision Support
```

Não deixar:

```text
OpenAIClient
```

espalhado pelos módulos.

---

# 127. `AiDecisionSupportService`

Interface:

```ts
interface DecisionSupport {
  prepareMentoring(...)
  suggestDevelopmentPlan(...)
  explainCareerReadiness(...)
  summarizeEvolution(...)
}
```

Infrastructure:

```text
LLMDecisionSupportAdapter
```

---

# 128. Prompt templates

Não armazenar prompt solto em controller.

Criar:

```text
MentoringPreparationPrompt
DevelopmentPlanPrompt
EvidenceReviewPrompt
```

como objetos/versionados.

---

# 129. AI audit

Registrar:

```text
prompt_version
model
input_source_ids
output
actor
timestamp
```

Especialmente quando resultado é exibido na jornada de avaliação.

---

# 130. Data minimization

Enviar ao modelo apenas dados necessários.

Não enviar:

- e-mail;
- senha;
- token;
- dados administrativos irrelevantes;
- notas privadas fora do contexto.

---

# 131. Human in the loop

Todo AI output deve possuir:

```text
Sugestão de IA
```

e ação:

```text
Aplicar
Editar
Ignorar
```

Nunca salvar automaticamente.

---

# 132. Padronização de nomes arquiteturais

## Backend

Sempre:

```text
<Entity>
<ValueObject>
<UseCase>
<Repository>
<PostgresRepository>
<Controller>
<Presenter>
<Mapper>
<Policy>
<Specification>
<DomainEvent>
```

---

# 133. Frontend

Sempre:

```text
<Feature>Gateway
Http<Feature>Gateway
<Feature>ApplicationService
<Feature>ViewModel
<Feature>Presenter
<Feature>Page
<Feature>View
```

---

# 134. Evitar nomes genéricos

Eliminar progressivamente:

```text
utils.ts
helpers.ts
common.ts
misc.ts
service.ts sem contexto
manager.ts genérico
```

Cada objeto deve dizer o que faz.

---

# 135. Arquivos `types.ts`

O backend já começou a quebrar tipos por contexto.

Continuar.

Não ter:

```text
domain/types.ts
```

como catálogo central eterno.

---

# 136. Interfaces

Não prefixar obrigatoriamente com `I`.

O padrão moderno:

```text
AssessmentRepository
```

e:

```text
PostgresAssessmentRepository
```

já funciona bem.

---

# 137. Private fields

Quando possível:

```ts
private readonly
```

para dependências.

Entidades:

```text
estado privado
métodos públicos
```

Evitar objeto anêmico com propriedades públicas mutáveis.

---

# 138. Imutabilidade

Value Objects:

```text
100% imutáveis
```

Domain Entities:

mudam apenas por métodos de negócio.

Não:

```text
assessment.status = ...
```

fora da entidade.

---

# 139. Factories

Usar:

```text
static create()
static restore()
```

para entidade.

Diferença:

```text
create = novo agregado + valida invariantes
restore = reidrata persistência
```

---

# 140. Mappers

Repository chama:

```text
mapper.restore(row)
```

não constrói entidade manualmente.

---

# 141. Generics — onde usar

## UseCase

```text
UseCase<TInput,TOutput>
```

## Mapper

```text
Mapper<TPersistence,TDomain>
```

## Repository infrastructure

```text
SqlExecutor
PagedResult<T>
```

## Frontend

```text
AsyncState<T>
PagedCollection<T>
Selection<TId>
DataViewModel<TItem,TFilter,TSort>
```

---

# 142. Generics — onde NÃO usar

Não criar:

```text
BaseService<T>
BaseController<T>
BaseEntity<T>
GenericCrudUseCase<T>
```

somente para reduzir linhas.

Isso esconderia o domínio.

---

# 143. SOLID — avaliação atual

## SRP

Parcial.

Controllers/services estão melhores.

Repositories e frontend routes ainda concentram demais.

## OCP

Moderado.

Gateways/interfaces ajudam.

Muitas branches por string ainda dificultam extensão.

## LSP

Sem grandes violações evidentes.

## ISP

Boa direção nos ports, mas algumas interfaces podem ser divididas.

## DIP

Backend já avançou bastante.

Frontend gateway layer também.

---

# 144. Clean Architecture — avaliação atual

Backend:

```text
7,5/10
```

Frontend:

```text
5,8/10
```

Meta após migração:

```text
9+/10
```

---

# 145. Plano de migração — não Big Bang

Não refatorar tudo em uma branch gigante.

Ordem:

---

## Fase OO-1 — Foundation

Criar:

```text
EntityId
ValueObject
UseCase
Mapper
DomainEvent
ApplicationError
```

Sem migrar tudo ainda.

---

## Fase OO-2 — Assessment piloto

Transformar Assessment em template perfeito.

Ele já é o módulo mais maduro.

Finalizar:

- Value Objects;
- use cases;
- mapper;
- SQL separation;
- remove free functions.

---

## Fase OO-3 — Development

Segundo módulo.

---

## Fase OO-4 — Catalog/Career

Maior ganho em DDD.

Criar:

- Capability;
- Competency;
- CareerLevel;
- policies.

---

## Fase OO-5 — Mentoring/Evolution

Aplicar:

- Session;
- Observation;
- Snapshot;
- analytics objects.

---

## Fase OO-6 — Infrastructure

- auth;
- outbox;
- cache;
- config;
- metrics.

---

## Fase OO-7 — Frontend Infrastructure

- FrontendContainer;
- gateways;
- formatters;
- selectors objects.

---

## Fase OO-8 — Frontend ViewModels

Migrar telas:

1. Assessment;
2. PDI;
3. Mentoring;
4. Evolution;
5. Dashboard;
6. restante.

---

## Fase OO-9 — Visual Standard

Aplicar:

- EnterpriseDataTable;
- FilterBar;
- ChartCard;
- DialogSize;
- PageLayout.

---

## Fase OO-10 — Intelligence

Somente após contratos estabilizados.

---

# 146. Definition of Done OO backend

- [ ] nenhum repository exporta singleton;
- [ ] nenhum mapper é função solta;
- [ ] nenhuma regra de domínio é função solta;
- [ ] nenhum service mistura múltiplos use cases grandes;
- [ ] composição feita por `ApplicationContainer`;
- [ ] entities encapsulam estado;
- [ ] Value Objects protegem primitives importantes;
- [ ] infrastructure implementa interfaces;
- [ ] domain não importa infraestrutura;
- [ ] controllers não calculam domínio;
- [ ] outbox é objeto;
- [ ] auth policies são objetos;
- [ ] tests usam fakes/in-memory objects;
- [ ] OpenAPI permanece íntegra.

---

# 147. Definition of Done OO frontend

- [ ] gateways via container;
- [ ] nenhum fetch direto;
- [ ] selectors agrupados em objetos;
- [ ] formatters como serviços/objetos;
- [ ] view logic em presenters/viewmodels;
- [ ] route function extremamente fina;
- [ ] nenhuma regra de negócio dentro de JSX;
- [ ] nenhum cálculo de carreira no componente;
- [ ] nenhuma regra de autorização real no frontend;
- [ ] componentes grandes decompostos;
- [ ] Design System centralizado.

---

# 148. Regra de exceção React

É permitida function solta apenas quando ela é:

```text
React Function Component
React Hook adapter
TanStack route adapter
framework bootstrap adapter
```

E deve ser:

```text
fina
sem domínio
sem regra
sem acesso direto a infraestrutura
```

Essa é a única exceção recomendada ao "nenhuma function solta".

---

# 149. Matriz de prioridade dos principais arquivos

| Arquivo/área | Problema | Prioridade |
|---|---|---|
| `assessment.repository.ts` | mapper/helper/repository no mesmo arquivo | P1 |
| `development.repository.ts` | mesma concentração | P1 |
| `evolution.repository.ts` | infra + mapping + regras adjacentes | P1 |
| `auth/*` | procedural | P1 |
| `outbox/outbox.ts` | procedural | P2 |
| `container.ts` | composition function + globals | P1 |
| frontend `store.tsx` | grande e centralizador | P1 |
| `selectors.ts` | functions soltas | P1 |
| routes grandes | lógica + view | P1 |
| components shared >800 linhas | alta complexidade | P1 |
| gateway container | singleton consts | P2 |
| `text.ts` | helpers soltos | P2 |
| report helpers | procedural | P2 |

---

# 150. Segurança durante refatoração

OO não pode alterar:

- RBAC;
- resource scope;
- Tech Lead ownership;
- optimistic locking;
- session security;
- PDI authority;
- Assessment history;
- event idempotency.

Criar characterization tests antes de migrar cada módulo.

---

# 151. Characterization tests

Antes de mover:

```text
AssessmentRepository
```

congelar:

- inputs;
- outputs;
- errors;
- SQL semantics;
- event behavior.

Refatoração:

```text
green before
green after
```

---

# 152. Performance durante OO

Mais objetos não deve significar:

- mais queries;
- mais allocations massivas;
- N+1;
- mais requests.

Cada refatoração deve comparar:

```text
query count
payload
latency
```

---

# 153. Padronização visual — roadmap

## Visual-1

Design primitives.

## Visual-2

Data tables.

## Visual-3

Filters.

## Visual-4

Charts.

## Visual-5

Dialogs/forms.

## Visual-6

Responsive.

---

# 154. Analytics roadmap

## Analytics-1

Determinístico primeiro.

Criar todos os gráficos com cálculos transparentes.

## Analytics-2

IA explicativa.

## Analytics-3

IA recomendativa.

Nunca começar por IA preditiva de pessoas.

---

# 155. Intelligence Roadmap

### Fase 1

```text
Natural Language Analytics
Mentoring Preparation
Career Readiness Explanation
```

Maior benefício, menor risco.

### Fase 2

```text
PDI Suggestions
Evidence Review Assistant
Assessment Calibration Assistant
```

### Fase 3

```text
Stagnation Detection
Catalog Quality
Executive Narrative
```

---

# 156. Recomendação final

O alvo proposto pelo Product Owner é factível, com uma correção conceitual:

> **não medir orientação a objetos pela ausência absoluta da palavra `function`.**

Medir por:

```text
estado encapsulado
comportamento dentro do objeto correto
dependências por contrato
alta coesão
baixo acoplamento
domínio rico
infraestrutura substituível
views finas
```

Para o backend, é razoável chegar muito próximo de:

```text
zero funções de negócio soltas.
```

Para o frontend, o padrão correto é:

```text
zero lógica de negócio solta
```

e não:

```text
zero function components.
```

---

# 157. Veredito final

## Backend atual

**Muito bom ponto de partida para OO completo.**

Nota atual:

```text
7,8/10
```

Meta:

```text
9,5/10
```

Principal trabalho:

```text
finalizar encapsulamento de repositories,
Value Objects,
use cases,
composition root e infrastructure services.
```

---

## Frontend atual

**Bom produto, arquitetura intermediária.**

Nota atual:

```text
6,4/10
```

Meta:

```text
9,0/10
```

Principal trabalho:

```text
tirar comportamento das routes/components
e migrar para ViewModels, Presenters,
Application Services e objetos de domínio de interação.
```

---

## Visual

Atual:

```text
8/10
```

Não precisa redesign.

Precisa:

```text
padronização oficial de tables,
filters,
dialogs,
charts,
layout e responsive.
```

---

## Analytics

Potencial:

```text
muito alto
```

A base histórica criada pelo produto é suficientemente rica para produzir:

- acompanhamento de evolução;
- risco de cobertura;
- prontidão;
- concentração de conhecimento;
- fechamento de GAP;
- efetividade do PDI;
- analytics de capacidade.

---

## IA

A IA deve ser posicionada como:

> **Decision Support Copilot**

e não como avaliador autônomo.

Os três primeiros casos de uso recomendados são:

1. **Preparação automática de 1:1;**
2. **Explicação de prontidão para carreira;**
3. **Consulta analítica em linguagem natural.**

Esses três entregam valor alto sem transformar o modelo em autoridade sobre pessoas.

---

# 158. Ordem executiva sugerida ao agente

```text
1. congelar testes de caracterização;
2. criar Foundation OO;
3. transformar Assessment no módulo de referência;
4. transformar Development;
5. transformar Catalog/Career;
6. transformar Mentoring/Evolution;
7. eliminar repositories/helpers soltos;
8. criar ApplicationContainer;
9. migrar auth/outbox/config;
10. criar FrontendContainer;
11. migrar selectors/formatters;
12. introduzir ViewModels;
13. decompor páginas grandes;
14. aplicar Design Standard;
15. consolidar Analytics;
16. introduzir IA somente depois.
```

---

# 159. Critério final de sucesso

O projeto estará no padrão pretendido quando uma nova funcionalidade, por exemplo:

```text
"recomendar próxima ação de desenvolvimento"
```

puder ser adicionada criando:

```text
Domain concept
→ UseCase
→ Port
→ Adapter
→ Presenter/ViewModel
→ View
```

sem:

- editar cinco arquivos utilitários;
- copiar regra;
- criar conditionals espalhados;
- importar repository diretamente;
- duplicar cálculo frontend/backend;
- acoplar framework ao domínio.

Esse é o verdadeiro sinal de uma aplicação:

> **enterprise, orientada a objetos, extensível e preparada para crescer.**
