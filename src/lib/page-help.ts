import type { PageHelpContent } from "@/components/app/PageHelp";
import { useI18n } from "@/lib/i18n";

/**
 * R2-UX-01 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md, Anexo A) — as 17 telas com
 * ajuda contextual. Chave só; o texto em si mora nos locales
 * (`help.<rota>.<persona>.<campo>`, pt/en) — nada hardcoded aqui, e a
 * checagem de tipo do `t()` já garante (na compilação) que as 4 chaves de
 * cada combinação rota×persona existem nos dois idiomas.
 */
export type PageHelpRouteKey =
  | "dash"
  /** `/` renderiza 3 componentes por papel (Admin/Lead/Member); Lead tem fila própria, conteúdo diferente do "dash" de admin. */
  | "dashLead"
  | "team"
  | "capabilityMap"
  | "gapAnalysis"
  | "progression"
  | "trainingNeeds"
  | "compare"
  | "assessments"
  | "developmentPlans"
  | "learningPaths"
  | "mentoring"
  | "competencyMatrix"
  | "cycles"
  | "settings"
  | "users"
  | "architectProfile"
  | "architectEvolution";

export function usePageHelp(route: PageHelpRouteKey): {
  lead: PageHelpContent;
  member: PageHelpContent;
} {
  const { t } = useI18n();
  const persona = (p: "lead" | "member"): PageHelpContent => ({
    title: t(`help.${route}.${p}.title`),
    what: t(`help.${route}.${p}.what`),
    comesFrom: t(`help.${route}.${p}.comesFrom`),
    nextStep: t(`help.${route}.${p}.nextStep`),
  });
  return { lead: persona("lead"), member: persona("member") };
}
