import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { CommandWithReasonDialog } from "@/components/app/CommandWithReasonDialog";
import { NOTICES_QUERY_KEY } from "@/components/app/NoticeBell";
import { SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { usePendingTeamTransfers, useSuccessToast, useToastSubmit } from "@/hooks";
import { teamTransfersApi } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import type { TeamTransferRequest, TeamTransferRequestView } from "@/lib/domain";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { stateContextCatalog } from "@/lib/state-contexts";
import { defaultDateFormatter } from "@/lib/text";

/**
 * Dono (2026-09-06): as pendências ficam VISÍVEIS na tela Time — o que é a
 * aprovar por mim (sou gerente do destino, ou admin) e o que eu solicitei.
 * Aprovar e Recusar (com nota) são de quem decide; Cancelar, de quem pediu.
 * Sem pendência, o bloco não existe.
 */
export function TeamTransferRequestsSection() {
  const { t } = useI18n();
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const { requests, viewModel, invalidate } = usePendingTeamTransfers(user);
  const notifySuccess = useSuccessToast();
  const { run } = useToastSubmit(t("team.transfers.error"));
  const [refusing, setRefusing] = useState<TeamTransferRequestView | null>(null);

  const inbox = viewModel.inbox(user, requests);
  if (inbox.toDecide.length === 0 && inbox.requestedByMe.length === 0) return null;

  /**
   * Toda decisão muda o que a tela mostra: a lista de pendências, o roster
   * (a pessoa aprovada migra de time) e a caixa de avisos.
   */
  const settled = (
    decided: TeamTransferRequest,
    request: TeamTransferRequestView,
    fallback: MessageKey,
  ) => {
    notifySuccess(fallback, { nome: request.architectName }, decided);
    void invalidate();
    void stateContextCatalog.invalidateAll(queryClient);
    void queryClient.invalidateQueries({ queryKey: NOTICES_QUERY_KEY });
  };

  const approve = (request: TeamTransferRequestView) =>
    run(() => teamTransfersApi.approveTeamTransfer(request.id)).then((result) => {
      if (result.ok) settled(result.value, request, "team.transfers.approve.toast");
    });

  const cancel = (request: TeamTransferRequestView) =>
    run(() => teamTransfersApi.cancelTeamTransfer(request.id)).then((result) => {
      if (result.ok) settled(result.value, request, "team.transfers.cancel.toast");
    });

  const refuse = (request: TeamTransferRequestView, note: string) =>
    teamTransfersApi.refuseTeamTransfer(request.id, note).then((refused) => {
      settled(refused, request, "team.transfers.refuse.toast");
    });

  return (
    <SectionCard
      title={t("team.transfers.title")}
      description={t("team.transfers.description")}
      className="mb-6"
    >
      <div className="grid gap-5 md:grid-cols-2">
        {inbox.toDecide.length > 0 && (
          <TeamTransferRequestList
            heading={t("team.transfers.toDecide")}
            requests={inbox.toDecide}
            actionsOf={(request) => (
              <>
                <Button size="sm" onClick={() => void approve(request)}>
                  {t("team.transfers.approve")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRefusing(request)}>
                  {t("team.transfers.refuse")}
                </Button>
                {viewModel.mayCancel(user, request) && (
                  <Button size="sm" variant="ghost" onClick={() => void cancel(request)}>
                    {t("team.transfers.cancel")}
                  </Button>
                )}
              </>
            )}
          />
        )}
        {inbox.requestedByMe.length > 0 && (
          <TeamTransferRequestList
            heading={t("team.transfers.requestedByMe")}
            requests={inbox.requestedByMe}
            actionsOf={(request) => (
              <Button size="sm" variant="outline" onClick={() => void cancel(request)}>
                {t("team.transfers.cancel")}
              </Button>
            )}
          />
        )}
      </div>

      {refusing && (
        <CommandWithReasonDialog
          title={t("team.transfers.refuse.title", { nome: refusing.architectName })}
          body={t("team.transfers.refuse.body", {
            nome: refusing.architectName,
            origem: refusing.fromTeamName,
          })}
          reasonInputId="transfer-refusal-note"
          reasonLabel={t("team.transfers.refuse.noteLabel")}
          reasonPlaceholder={t("team.transfers.refuse.notePlaceholder")}
          confirmLabel={t("team.transfers.refuse.confirm")}
          submittingLabel={t("team.transfers.refuse.submitting")}
          confirmVariant="destructive"
          fallbackError={t("team.transfers.error")}
          onSubmit={(note) => refuse(refusing, note)}
          onClose={() => setRefusing(null)}
        />
      )}
    </SectionCard>
  );
}

function TeamTransferRequestList({
  heading,
  requests,
  actionsOf,
}: {
  heading: string;
  requests: readonly TeamTransferRequestView[];
  actionsOf: (request: TeamTransferRequestView) => React.ReactNode;
}) {
  const { t, locale } = useI18n();
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {heading}
      </p>
      <ul aria-label={heading} className="divide-y divide-border rounded-md border border-border">
        {requests.map((request) => (
          <li key={request.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">{request.architectName}</p>
              <p className="text-muted-foreground">
                {t("team.transfers.route", {
                  origem: request.fromTeamName,
                  destino: request.toTeamName,
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("team.transfers.requestedBy", {
                  nome: request.requestedByName,
                  quando: defaultDateFormatter.formatRelative(request.requestedAt, locale) ?? "",
                })}
              </p>
              <p className="mt-1 text-xs">
                {t("team.transfers.reason", { motivo: request.reason })}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">{actionsOf(request)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
