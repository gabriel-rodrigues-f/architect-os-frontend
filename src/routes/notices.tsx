import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { NOTICES_QUERY_KEY } from "@/hooks";
import { NoticeList } from "@/components/app/NoticeList";
import {
  DataOriginCallout,
  EmptyState,
  PageAction,
  PageActions,
  PageHeader,
  QuerySection,
  ScrollPane,
  SingleSelectFilter,
} from "@/components/app";
import { noticesApi } from "@/lib/api";
import type { Notice, NoticeStatusFilter } from "@/lib/gateways/notices.gateway";
import { PaneHeight } from "@/lib/design";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { Selection } from "@/lib/selection";
import { NoticesViewModel } from "@/lib/view-models";

export const Route = createFileRoute("/notices")({
  head: () => ({
    meta: [
      { title: "Avisos — Synapse" },
      {
        name: "description",
        content: "Avisos: PDIs vencendo e avaliações paradas, no escopo de quem vê.",
      },
      { property: "og:title", content: "Avisos — Synapse" },
      {
        property: "og:description",
        content: "O que precisa da sua atenção, no seu escopo, com o destino de cada aviso.",
      },
    ],
  }),
  component: NoticesPage,
});

function useNoticesViewModel(): NoticesViewModel {
  return useMemo(() => new NoticesViewModel(), []);
}

function NoticesPage() {
  const { t } = useI18n();
  const help = usePageHelp("notices");
  const vm = useNoticesViewModel();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<NoticeStatusFilter>("all");
  /**
   * A SELEÇÃO da tela (dono, 2026-09-08): caixa por linha e uma ação que
   * marca SÓ o que está marcado — ao lado da que marca tudo, que continua.
   *
   * A caixa NASCE ESCONDIDA (dono, 2026-09-08, item 10): quem só lê os avisos
   * não vê caixa nenhuma. "Selecionar" revela as caixas; sair do modo esconde
   * tudo de novo E ESQUECE o que estava marcado — seleção que sobrevive
   * escondida volta a agir sem ninguém ver.
   */
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const selection = Selection.explicit(selectedIds);

  const toggleSelectionMode = () => {
    setSelecting((current) => !current);
    setSelectedIds([]);
  };

  const query = useQuery({
    queryKey: [...NOTICES_QUERY_KEY, "page", status],
    queryFn: () => noticesApi.notices({ status }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: NOTICES_QUERY_KEY });

  const markRead = useMutation({
    mutationFn: (noticeId: string) => noticesApi.markNoticeRead(noticeId),
    onSettled: invalidate,
  });
  const markAll = useMutation({
    mutationFn: () => noticesApi.markAllNoticesRead(),
    onSettled: invalidate,
  });
  const markSelected = useMutation({
    mutationFn: async (ids: readonly string[]) => {
      for (const id of ids) await noticesApi.markNoticeRead(id);
    },
    onSettled: () => {
      setSelectedIds([]);
      return invalidate();
    },
  });

  const markIfUnread = (notice: Notice) => {
    if (vm.isUnread(notice)) markRead.mutate(notice.id);
  };

  const goToNotice = (notice: Notice, destination: string) => {
    markIfUnread(notice);
    router.history.push(destination);
  };

  const toggleSelection = (notice: Notice) => {
    setSelectedIds((current) =>
      current.includes(notice.id)
        ? current.filter((id) => id !== notice.id)
        : [...current, notice.id],
    );
  };

  const unreadCount = query.data?.unreadCount ?? 0;

  return (
    <>
      <PageHeader
        help={help}
        title={t("notices.title")}
        description={t("notices.description")}
        actions={
          <PageActions>
            <PageAction
              icon={null}
              label={t(selecting ? "notices.selection.stop" : "notices.selection.start")}
              aria-pressed={selecting}
              onClick={toggleSelectionMode}
            />
            {selecting && (
              <PageAction
                icon={null}
                label={t("notices.markSelectedRead")}
                disabled={selectedIds.length === 0 || markSelected.isPending}
                onClick={() => markSelected.mutate(selectedIds)}
              />
            )}
            <PageAction
              icon={null}
              label={t("notices.markAllRead")}
              disabled={unreadCount === 0 || markAll.isPending}
              onClick={() => markAll.mutate()}
            />
          </PageActions>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <SingleSelectFilter
          id="notices-status"
          label={t("notices.filter.label")}
          value={status}
          onChange={(value) => setStatus(value as NoticeStatusFilter)}
          options={[
            { value: "all", label: t("notices.filter.all") },
            { value: "unread", label: t("notices.filter.unread") },
          ]}
        />
        {selecting && (
          <p role="status" className="text-label text-muted-foreground">
            {t("notices.selectedCount", { n: selectedIds.length })}
          </p>
        )}
      </div>

      <QuerySection
        query={query}
        skeleton={<div className="h-40 animate-pulse rounded-md bg-secondary" />}
        errorMessage={t("notices.error")}
      >
        {(data) => (
          <>
            <DataOriginCallout origin={data.dataOrigin} className="mb-6" />
            {data.notices.length === 0 ? (
              <EmptyState title={t("notices.empty")} hint={t("notices.emptyHint")} />
            ) : (
              <ScrollPane
                label={t("pane.notices.label")}
                height={PaneHeight.restOfPage()}
                className="surface-card p-2"
              >
                <NoticeList
                  notices={vm.newestFirst(data.notices)}
                  unreadOf={(notice) => vm.isUnread(notice)}
                  onOpen={markIfUnread}
                  onNavigate={goToNotice}
                  {...(selecting
                    ? {
                        selectedOf: (notice: Notice) => selection.contains(notice.id),
                        onToggleSelection: toggleSelection,
                      }
                    : {})}
                />
              </ScrollPane>
            )}
          </>
        )}
      </QuerySection>
    </>
  );
}
