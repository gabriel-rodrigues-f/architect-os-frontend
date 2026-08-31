import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useMemo } from "react";

import { DataOriginCallout } from "@/components/app/DataOriginCallout";
import { NoticeList } from "@/components/app/NoticeList";
import { QuerySection } from "@/components/app/QuerySection";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { noticesApi } from "@/lib/api";
import type { Notice } from "@/lib/gateways/notices.gateway";
import { useI18n } from "@/lib/i18n";
import { NoticesViewModel } from "@/lib/view-models";

const BELL_LIMIT = 5;
const BELL_REFRESH_MS = 60_000;

export const NOTICES_QUERY_KEY = ["notices"] as const;

export function NoticeBell() {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const vm = useMemo(() => new NoticesViewModel(), []);

  const query = useQuery({
    queryKey: [...NOTICES_QUERY_KEY, "bell"],
    queryFn: () => noticesApi.notices({ status: "all", limit: BELL_LIMIT }),
    refetchInterval: BELL_REFRESH_MS,
  });

  const markRead = useMutation({
    mutationFn: (noticeId: string) => noticesApi.markNoticeRead(noticeId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTICES_QUERY_KEY }),
  });

  const openNotice = (notice: Notice) => {
    if (vm.isUnread(notice)) markRead.mutate(notice.id);
    router.history.push(notice.link);
  };

  const unreadCount = query.data?.unreadCount ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            unreadCount > 0
              ? `${t("notices.bell")} · ${t("notices.unreadCount", { n: unreadCount })}`
              : t("notices.bell")
          }
          title={t("notices.bell")}
          className="relative rounded-md border border-input bg-card p-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <p className="px-2 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("notices.title")}
        </p>
        <QuerySection
          query={query}
          skeleton={<div className="h-24 animate-pulse rounded-md bg-secondary" />}
          errorMessage={t("notices.error")}
        >
          {(data) => (
            <>
              <DataOriginCallout origin={data.dataOrigin} className="mx-2 mb-2" />
              {data.notices.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">{t("notices.empty")}</p>
              ) : (
                <NoticeList
                  notices={vm.latest(data.notices, BELL_LIMIT)}
                  unreadOf={(notice) => vm.isUnread(notice)}
                  onOpen={openNotice}
                  itemWrapper={(element) => <PopoverClose asChild>{element}</PopoverClose>}
                />
              )}
            </>
          )}
        </QuerySection>
        <div className="mt-1 border-t border-border px-2 pt-2">
          <PopoverClose asChild>
            <Link to="/notices" className="text-sm text-primary hover:underline">
              {t("notices.viewAll")}
            </Link>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}
