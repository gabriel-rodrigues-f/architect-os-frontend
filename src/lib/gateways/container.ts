import { ApiClient } from "../api-client";
import { HttpArchitectsGateway } from "./architects.gateway";
import { HttpAssessmentGateway } from "./assessment.gateway";
import { HttpAuthGateway } from "./auth.gateway";
import { HttpCareerGateway } from "./career.gateway";
import { HttpCatalogGateway } from "./catalog.gateway";
import { HttpCyclesGateway } from "./cycles.gateway";
import { HttpDevelopmentGateway } from "./development.gateway";
import { HttpEvidenceGateway } from "./evidence.gateway";
import { HttpEvolutionGateway } from "./evolution.gateway";
import { HttpLearningGateway } from "./learning.gateway";
import { HttpMentoringGateway } from "./mentoring.gateway";
import { HttpReportsGateway } from "./reports.gateway";

/**
 * OO-FE-02 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md, Anexo F.6) — composition
 * root: único lugar (fora de teste) que dá `new` no `ApiClient` e nos
 * gateways, mesma regra do `container.ts` do backend (F.3, "DI manual,
 * explícita no container"). Construído uma vez, na carga deste módulo —
 * não é um componente/Provider React.
 *
 * Por que não `GatewaysProvider` (React context) nesta leva, mesmo o
 * backlog citando esse nome como exemplo: nenhuma tela desta PR consome
 * gateway nenhum diretamente ainda — só a fachada `api.ts` consome (ver seu
 * topo) — e o app já tem, de propósito, UM `ApiClient` para o processo
 * inteiro: o mesmo modelo do `API_URL` de módulo que existia antes desta
 * migração, e do próprio `queryClient` (construído uma vez em `router.tsx`,
 * sem Context React, passado adiante por `RouteContext` do TanStack
 * Router). Adicionar `<GatewaysProvider>` a `__root.tsx` sem nenhum
 * consumidor real seria prover algo morto só para bater com o texto do
 * ticket ao pé da letra — o próprio F.7 já avisa para não tratar isto como
 * projeto separado da tela a tela.
 *
 * Quando R1-P04 migrar a primeira tela para `gateway + useQuery/
 * useMutation` (F.7), essa tela pode importar os gateways daqui direto —
 * `useQuery`/`useMutation` não precisam de Context React para achar o
 * gateway, do mesmo jeito que uma `queryFn` de hoje não precisa de Context
 * pra achar `api.ts`. Se uma necessidade real de escopo por instância
 * aparecer depois (ex.: trocar `ApiClient` por teste de componente
 * montado), essa é a hora de promover isto a um Provider de verdade — não
 * antes.
 */
export const defaultApiClient = new ApiClient();

export const cyclesGateway = new HttpCyclesGateway(defaultApiClient);
export const architectsGateway = new HttpArchitectsGateway(defaultApiClient);
export const careerGateway = new HttpCareerGateway(defaultApiClient);
export const catalogGateway = new HttpCatalogGateway(defaultApiClient);
export const assessmentGateway = new HttpAssessmentGateway(defaultApiClient);
export const developmentGateway = new HttpDevelopmentGateway(defaultApiClient);
export const learningGateway = new HttpLearningGateway(defaultApiClient);
export const mentoringGateway = new HttpMentoringGateway(defaultApiClient);
export const evidenceGateway = new HttpEvidenceGateway(defaultApiClient);
export const authGateway = new HttpAuthGateway(defaultApiClient);
export const evolutionGateway = new HttpEvolutionGateway(defaultApiClient);
export const reportsGateway = new HttpReportsGateway(defaultApiClient);
