import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { teamTransfersApi, type SessionUser } from "@/lib/api";
import type { TeamTransferRequestView } from "@/lib/domain";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { TeamTransfersViewModel } from "@/lib/view-models";

export const TEAM_TRANSFER_REQUESTS_QUERY_KEY = ["team-transfer-requests"] as const;

const PENDING_REFRESH_MS = 60_000;

export function useTeamTransfersViewModel(): TeamTransfersViewModel {
  return useMemo(() => new TeamTransfersViewModel(defaultUiAuthorizationPolicy), []);
}

/**
 * As transferências PENDENTES de quem está logado — as que chegam para ele
 * decidir e as que ele pediu. Só admin e gerente com vínculo consultam: para
 * os demais a caixa não existe, e a consulta nem sai.
 */
export function usePendingTeamTransfers(user: SessionUser | null | undefined): {
  requests: TeamTransferRequestView[];
  viewModel: TeamTransfersViewModel;
  invalidate: () => Promise<void>;
} {
  const viewModel = useTeamTransfersViewModel();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [...TEAM_TRANSFER_REQUESTS_QUERY_KEY, "pending"],
    queryFn: () => teamTransfersApi.teamTransferRequests("pending"),
    enabled: user != null && viewModel.mayHavePending(user),
    refetchInterval: PENDING_REFRESH_MS,
  });
  return {
    requests: query.data ?? [],
    viewModel,
    invalidate: () => queryClient.invalidateQueries({ queryKey: TEAM_TRANSFER_REQUESTS_QUERY_KEY }),
  };
}
