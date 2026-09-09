import {
  Bell,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  FileSearch,
  GraduationCap,
  HandHeart,
} from "lucide-react";
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";

import { TextLink } from "@/components/app/TextLink";
import { semanticTone } from "@/components/app/ui-bits";
import { Checkbox } from "@/components/ui/checkbox";
import type { Notice } from "@/lib/gateways/notices.gateway";
import { useI18n } from "@/lib/i18n";
import { defaultNoticeDestination } from "@/lib/notice-destination";
import { defaultNoticePhrase } from "@/lib/notice-phrase";
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
  welcome: HandHeart,
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
 * O TEXTO DO AVISO É O LINK (dono, 2026-09-08): *"ao invés de mantermos um
 * texto 'Clique para visualizar', vamos inserir um hiperlink no próprio texto
 * descritivo da notificação. Se o usuário clicar na linha, apenas seta como
 * lido; se clicar no texto, seta como lida e navega."*
 *
 * Os dois gestos convivem numa linha só, e a forma é o que os separa:
 *
 *   - a LINHA é uma caixa clicável que só marca como lida. Ela deixou de ser
 *     um `<button>` porque link dentro de botão não existe em HTML — conteúdo
 *     interativo dentro de conteúdo interativo é DOM inválido, e o navegador
 *     desmonta a árvore de um jeito imprevisível;
 *   - o TÍTULO é um `<a>` de verdade: endereço na barra de status, alcançável
 *     por Tab, abrível em aba nova. O clique dele PARA A PROPAGAÇÃO, senão os
 *     dois gestos disparariam no mesmo clique e a marcação sairia duas vezes.
 *
 * O que o teclado perde e onde ele recupera, dito sem arredondar: marcar como
 * lida SEM navegar deixou de ter alvo próprio de foco — é gesto de ponteiro.
 * Quem navega por teclado marca junto ao abrir (o link), ou usa a seleção da
 * tela de Avisos e o "Marcar todos como lidos", que continuam.
 *
 * A DATA fica na linha, ao lado do título (dono, 2026-09-08); o "há {tanto
 * tempo}" continua embaixo.
 */
export function NoticeList({
  notices,
  unreadOf,
  onOpen,
  onNavigate,
  linkWrapper = (element) => element,
  selectedOf,
  onToggleSelection,
}: {
  notices: readonly Notice[];
  unreadOf: (notice: Notice) => boolean;
  /** O clique na linha: marcar como lida. */
  onOpen: (notice: Notice) => void;
  /** O clique no título: ir para o destino daquele aviso — e marcar. */
  onNavigate: (notice: Notice, destination: string) => void;
  /**
   * Embrulha o LINK do título, não a linha (dono, 2026-09-09). O sino usa isto
   * para fechar a caixa ao NAVEGAR; embrulhar a linha fechava a caixa também
   * quando a pessoa só marcava como lida, que são gestos diferentes.
   */
  linkWrapper?: (element: ReactElement) => ReactNode;
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
              aria-label={t("notices.select", { titulo: defaultNoticePhrase.of(notice, t) })}
            />
          )}
          <NoticeItem
            notice={notice}
            unread={unreadOf(notice)}
            onOpen={onOpen}
            onNavigate={onNavigate}
            linkWrapper={linkWrapper}
            className="min-w-0 flex-1"
          />
        </li>
      ))}
    </ul>
  );
}

export function NoticeItem({
  notice,
  unread,
  onOpen,
  onNavigate,
  linkWrapper = (element) => element,
  ...rowProps
}: {
  notice: Notice;
  unread: boolean;
  onOpen: (notice: Notice) => void;
  onNavigate: (notice: Notice, destination: string) => void;
  linkWrapper?: (element: ReactElement) => ReactNode;
} & ComponentPropsWithoutRef<"div">) {
  const { t, locale } = useI18n();
  const Icon = ICON_BY_KIND[defaultNoticeRoutingPolicy.iconOf(notice.eventType)];
  const chip = NoticeToneChips.byTone()[defaultNoticeRoutingPolicy.toneOf(notice.eventType)];
  const day = defaultDateFormatter.formatDate(notice.occurredAt, locale);
  const destination = defaultNoticeDestination.of(notice);
  return (
    <div
      {...rowProps}
      onClick={(event) => {
        rowProps.onClick?.(event);
        onOpen(notice);
      }}
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-secondary/60",
        rowProps.className,
      )}
    >
      <span className={cn("mt-0.5 rounded-md p-1.5", chip)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm", unread && "font-medium")}>
          {linkWrapper(
            <TextLink
              href={destination}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onNavigate(notice, destination);
              }}
            >
              {defaultNoticePhrase.of(notice, t)}
            </TextLink>,
          )}
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
    </div>
  );
}
