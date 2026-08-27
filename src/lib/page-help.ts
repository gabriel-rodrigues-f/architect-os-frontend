import type { PageHelpContent } from "@/components/app/PageHelp";
import { useI18n } from "@/lib/i18n";

type PageHelpRouteKey =
  | "dash"
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
