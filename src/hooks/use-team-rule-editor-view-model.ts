import { useMemo, type Dispatch, type SetStateAction } from "react";

import type { TeamRuleView } from "@/lib/gateways/career.gateway";
import { useSelectors } from "@/lib/store";
import { TeamRuleEditorViewModel } from "@/lib/view-models";
import { useServerDraft } from "./use-server-draft";

export function useTeamRuleEditorViewModel(rule: TeamRuleView | null): {
  editor: TeamRuleEditorViewModel;
  setEditor: Dispatch<SetStateAction<TeamRuleEditorViewModel>>;
} {
  const { competencyById } = useSelectors();
  const loaded = useMemo(
    () => TeamRuleEditorViewModel.from({ competencyById, rule }),
    [competencyById, rule],
  );
  const { draft, setDraft } = useServerDraft(loaded);
  return { editor: draft, setEditor: setDraft };
}
