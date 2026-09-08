import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useMemo } from "react";

import { DataOriginCallout } from "@/components/app/DataOriginCallout";
import { NoticeList } from "@/components/app/NoticeList";
import { QuerySection } from "@/components/app/QuerySection";
import { Button } from "@/components/ui/button";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { noticesApi } from "@/lib/api";
import type { Notice, NoticesPage } from "@/lib/gateways/notices.gateway";
import { useI18n } from "@/lib/i18n";
import { ObservedQuery } from "@/lib/observed-query";
import { NoticesViewModel } from "@/lib/view-models";

const BELL_REFRESH_MS = 60_000;

export const NOTICES_QUERY_KEY = ["notices"] as const;

/**
 * O TAMANHO DE CADA PÁGINA DO SINO (dono, 2026-09-08): cinco na abertura,
 * +10 a cada "Ver mais". Quem sabe qual é qual é o cursor — sem cursor é a
 * primeira página.
 */
class BellPaging {
  static readonly FIRST = 5;
  static readonly MORE = 10;

  static limitFor(cursor: string | undefined): number {
    return cursor === undefined ? BellPaging.FIRST : BellPaging.MORE;
  }
}

export function NoticeBell() {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const vm = useMemo(() => new NoticesViewModel(), []);

  /**
   * "Ver mais" carrega +10 pelo CURSOR (`before`) — nunca recarrega o que já
   * veio. A consulta infinita guarda as páginas já recebidas; a próxima pede
   * só o que falta, a partir do aviso mais antigo da tela.
   */
  const query = useInfiniteQuery({
    queryKey: [...NOTICES_QUERY_KEY, "bell"],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      noticesApi.notices({
        status: "all",
        limit: BellPaging.limitFor(pageParam),
        ...(pageParam === undefined ? {} : { before: pageParam }),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (
      lastPage: NoticesPage,
      _pages: NoticesPage[],
      lastParam: string | undefined,
    ) => vm.cursorAfter(lastPage.notices, BellPaging.limitFor(lastParam)),
    refetchInterval: BELL_REFRESH_MS,
  });

  const markRead = useMutation({
    mutationFn: (noticeId: string) => noticesApi.markNoticeRead(noticeId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTICES_QUERY_KEY }),
  });

  const markIfUnread = (notice: Notice) => {
    if (vm.isUnread(notice)) markRead.mutate(notice.id);
  };

  const goToNotice = (notice: Notice, destination: string) => {
    markIfUnread(notice);
    router.history.push(destination);
  };

  const pages = query.data?.pages;
  const first = pages?.[0];
  const inbox =
    first === undefined
      ? undefined
      : {
          dataOrigin: first.dataOrigin,
          unreadCount: first.unreadCount,
          notices: vm.merge(pages?.map((page) => page.notices) ?? []),
        };

  const reading = new ObservedQuery({
    data: inbox,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  });
  const unreadCount = reading.data?.unreadCount ?? 0;

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
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-meta font-semibold tabular-nums text-primary-foreground"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      {/*
       * A caixa CRESCE ATÉ O FIM DA TELA, com respiro (dono, 2026-09-08): a
       * altura máxima é a que o navegador mede a cada abertura
       * (`--radix-popover-content-available-height`), já descontado o
       * `collisionPadding` — nunca uma altura fixa em pixel. O que passa
       * disso rola POR DENTRO, com a barra sempre visível.
       */}
      <PopoverContent
        align="end"
        collisionPadding={16}
        className="flex max-h-(--radix-popover-content-available-height) w-80 flex-col p-2"
      >
        <p className="px-2 pb-1 pt-1 text-meta font-medium uppercase tracking-wide text-muted-foreground">
          {t("notices.title")}
        </p>
        <div className="scroll-visible min-h-0 flex-1 overflow-y-auto">
          <QuerySection
            query={reading}
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
                    notices={data.notices}
                    unreadOf={(notice) => vm.isUnread(notice)}
                    onOpen={markIfUnread}
                    onNavigate={goToNotice}
                    itemWrapper={(element) => <PopoverClose asChild>{element}</PopoverClose>}
                  />
                )}
              </>
            )}
          </QuerySection>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 border-t border-border px-2 pt-2">
          <PopoverClose asChild>
            <Link to="/notices" className="text-sm text-primary hover:underline">
              {t("notices.viewAll")}
            </Link>
          </PopoverClose>
          {query.hasNextPage && (
            <Button
              variant="link"
              size="sm"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {t("notices.loadMore")}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
