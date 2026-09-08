import {
  Bell,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  FileSearch,
  GraduationCap,
} from "lucide-react";
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";

import { semanticTone } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Notice } from "@/lib/gateways/notices.gateway";
import { useI18n } from "@/lib/i18n";
import { defaultNoticeDestination } from "@/lib/notice-destination";
import {
  defaultNoticeRoutingPolicy,
  type NoticeIcon,
  type NoticeTone,
} from "@/lib/notice-routing-policy";
import { defaultDateFormatter } from "@/lib/text";
import { cn } from "@/lib/utils";

const ICON_BY_KIND: Record<NoticeIcon, typeof Bell> = {
  deadline: CalendarClock,
  stalled: CircleAlert,
  review: FileSearch,
  completed: CheckCircle2,
  mentoring: GraduationCap,
  generic: Bell,
};

/**
 * Lido em FUNÇÃO, e não numa constante de módulo.
 *
 * `semanticTone` mora em `ui-bits`, e o grafo de importação da casa tem ciclo:
 * na ordem de inicialização do pacote de SSR de produção, este módulo chegava a
 * rodar ANTES de `ui-bits` terminar, e o mapa nascia lendo `undefined.warning`.
 * O sintoma não aparecia em nenhum teste (jsdom importa noutra ordem) nem no
 * `build` — só no pod, como 500 na sonda de prontidão e canário abortado.
 *
 * Chamar na hora de desenhar tira a dependência de ORDEM: quando o componente
 * renderiza, todo módulo já terminou de carregar.
 */
class NoticeToneChips {
  static byTone(): Record<NoticeTone, string> {
    return {
      info: "bg-secondary text-secondary-foreground",
      warning: semanticTone.warning,
      success: semanticTone.success,
    };
  }
}

/**
 * A LINHA DE UM AVISO, compartilhada pelo sino e pela tela (regra 6).
 *
 * Dono (2026-09-08), duas decisões que moram aqui:
 *   1. o CLIQUE NA LINHA marca como lida — e só isso. Quem quer ir para a
 *      tela do aviso clica no hiperlink "Clique para visualizar", que
 *      NAVEGA E MARCA. Os dois atos são elementos irmãos, nunca aninhados:
 *      botão dentro de botão não existe em HTML, e é assim que a marcação
 *      não dispara duas vezes num clique só;
 *   2. a DATA saiu do cabeçalho de grupo e entrou na linha, ao lado do
 *      título; o "há {tanto tempo}" continua embaixo.
 */
export function NoticeList({
  notices,
  unreadOf,
  onOpen,
  onNavigate,
  itemWrapper = (element) => element,
  selectedOf,
  onToggleSelection,
}: {
  notices: readonly Notice[];
  unreadOf: (notice: Notice) => boolean;
  /** O clique na linha: marcar como lida. */
  onOpen: (notice: Notice) => void;
  /** O clique no hiperlink: ir para o destino daquele aviso — e marcar. */
  onNavigate: (notice: Notice, destination: string) => void;
  itemWrapper?: (element: ReactElement) => ReactNode;
  /** Com os dois, a linha ganha caixa de seleção; sem eles, não há seleção. */
  selectedOf?: (notice: Notice) => boolean;
  onToggleSelection?: (notice: Notice) => void;
}) {
  const { t } = useI18n();
  const selectable = selectedOf !== undefined && onToggleSelection !== undefined;
  return (
    <ul className="divide-y divide-border">
      {notices.map((notice) => (
        <li key={notice.id} className="flex items-center gap-2">
          {selectable && (
            <Checkbox
              className="ml-2"
              checked={selectedOf(notice)}
              onCheckedChange={() => onToggleSelection(notice)}
              aria-label={t("notices.select", { titulo: notice.title })}
            />
          )}
          {itemWrapper(
            <NoticeItem
              notice={notice}
              unread={unreadOf(notice)}
              onOpen={onOpen}
              className="min-w-0 flex-1"
            />,
          )}
          {itemWrapper(<NoticeDestinationLink notice={notice} onNavigate={onNavigate} />)}
        </li>
      ))}
    </ul>
  );
}

/**
 * O HIPERLINK DA LINHA. É um `<a>` de verdade — endereço visível na barra de
 * status, alcançável por Tab, abrível em aba nova pelo navegador —, e o
 * clique comum é interceptado para navegar dentro da aplicação sem recarregar
 * a página. A tinta vem da variante `link` do `Button`, o único lugar da casa
 * onde o sublinhado no ponteiro mora.
 */
function NoticeDestinationLink({
  notice,
  onNavigate,
  ...rest
}: {
  notice: Notice;
  onNavigate: (notice: Notice, destination: string) => void;
} & ComponentPropsWithoutRef<"button">) {
  const { t } = useI18n();
  const destination = defaultNoticeDestination.of(notice);
  return (
    <Button asChild variant="link" size="sm" {...rest} className={cn("shrink-0", rest.className)}>
      <a
        href={destination}
        onClick={(event) => {
          event.preventDefault();
          onNavigate(notice, destination);
        }}
      >
        {t("notices.open")}
      </a>
    </Button>
  );
}

export function NoticeItem({
  notice,
  unread,
  onOpen,
  ...buttonProps
}: {
  notice: Notice;
  unread: boolean;
  onOpen: (notice: Notice) => void;
} & ComponentPropsWithoutRef<"button">) {
  const { t, locale } = useI18n();
  const Icon = ICON_BY_KIND[defaultNoticeRoutingPolicy.iconOf(notice.eventType)];
  const chip = NoticeToneChips.byTone()[defaultNoticeRoutingPolicy.toneOf(notice.eventType)];
  const day = defaultDateFormatter.formatDate(notice.occurredAt, locale);
  return (
    <button
      type="button"
      {...buttonProps}
      onClick={(event) => {
        buttonProps.onClick?.(event);
        onOpen(notice);
      }}
      className={cn(
        "flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-secondary/60",
        buttonProps.className,
      )}
    >
      <span className={cn("mt-0.5 rounded-md p-1.5", chip)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm", unread && "font-medium")}>
          <span>{notice.title}</span>
          {day !== null && <span className="text-muted-foreground">{` - ${day}`}</span>}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {defaultDateFormatter.formatRelative(notice.occurredAt, locale)}
        </span>
      </span>
      {unread && (
        <span
          aria-label={t("notices.unread")}
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
        />
      )}
    </button>
  );
}
