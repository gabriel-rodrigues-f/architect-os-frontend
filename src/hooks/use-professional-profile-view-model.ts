import { useMemo } from "react";

import { useStore } from "@/lib/store";
import { ProfessionalProfileViewModel } from "@/lib/view-models";

export function useProfessionalProfileViewModel(): ProfessionalProfileViewModel {
  const store = useStore();
  return useMemo(() => new ProfessionalProfileViewModel(store), [store]);
}
