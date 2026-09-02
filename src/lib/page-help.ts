import type { PageHelpContent, SectionHelpContent } from "@/components/app";
import { useI18n } from "@/lib/i18n";

export const SECTION_HELP_KEYS = [
  "policy",
  "scale",
  "cycles",
  "bands",
  "bands.GAP_SEVERITY",
  "bands.PROFICIENCY",
  "bands.CONCENTRATION_RISK",
  "curation",
  "templates",
  "operational",
  "vocab",
  "vocab.EVIDENCE_TYPE",
  "vocab.LEARNING_ITEM_TYPE",
  "vocab.ACTION_TYPE",
] as const;
export type SectionHelpKey = (typeof SECTION_HELP_KEYS)[number];

export function useSectionHelp(section: SectionHelpKey): SectionHelpContent {
  const { t } = useI18n();
  return {
    title: t(`help.section.${section}.title`),
    purpose: t(`help.section.${section}.purpose`),
    how: t(`help.section.${section}.how`),
  };
}

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
  | "architectEvolution"
  | "teamRules"
  | "teams"
  | "calibration"
  | "notices"
  | "architectRoadmap"
  | "architectStatement";

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
