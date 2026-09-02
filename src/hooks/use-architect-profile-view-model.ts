import { useMemo } from "react";

import { useStore } from "@/lib/store";
import { ArchitectProfileViewModel } from "@/lib/view-models";

export function useArchitectProfileViewModel(): ArchitectProfileViewModel {
  const store = useStore();
  return useMemo(() => new ArchitectProfileViewModel(store), [store]);
}
