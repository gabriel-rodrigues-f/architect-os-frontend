import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { NOTICES_QUERY_KEY } from "@/components/app/NoticeBell";
import { NoticeList } from "@/components/app/NoticeList";
import {
  DataOriginCallout,
  EmptyState,
  PageHeader,
  QuerySection,
  SectionGroup,
  SingleSelectFilter,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { noticesApi } from "@/lib/api";
import type { Notice, NoticeStatusFilter } from "@/lib/gateways/notices.gateway";
import { useI18n } from "@/lib/i18n";
import { defaultDateFormatter } from "@/lib/text";
import { NoticesViewModel } from "@/lib/view-models";

export const Route = createFileRoute("/notices")({
  head: () => ({
    meta: [
      { title: "Central de Avisos — Synapse" },
      {
        name: "description",
        content:
          "Central de avisos: PDIs vencendo, avaliações paradas e evidências esperando revisão, no escopo de quem vê.",
      },
    ],
  }),
  component: NoticesPage,
});

function useNoticesViewModel(): NoticesViewModel {
  return useMemo(() => new NoticesViewModel(), []);
}

function NoticesPage() {
  const { t, locale } = useI18n();
  const vm = useNoticesViewModel();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<NoticeStatusFilter>("all");

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

  const openNotice = (notice: Notice) => {
    if (vm.isUnread(notice)) markRead.mutate(notice.id);
    router.history.push(notice.link);
  };

  const unreadCount = query.data?.unreadCount ?? 0;

  return (
    <>
      <PageHeader
        title={t("notices.title")}
        description={t("notices.description")}
        actions={
          <Button
            size="sm"
            variant="secondary"
            disabled={unreadCount === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            {t("notices.markAllRead")}
          </Button>
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
              <div className="space-y-6">
                {vm.groupByDay(data.notices).map((group) => (
                  <SectionGroup
                    key={group.day}
                    title={defaultDateFormatter.formatDate(group.day, locale) ?? group.day}
                  >
                    <div className="surface-card p-2">
                      <NoticeList
                        notices={group.notices}
                        unreadOf={(notice) => vm.isUnread(notice)}
                        onOpen={openNotice}
                      />
                    </div>
                  </SectionGroup>
                ))}
              </div>
            )}
          </>
        )}
      </QuerySection>
    </>
  );
}
