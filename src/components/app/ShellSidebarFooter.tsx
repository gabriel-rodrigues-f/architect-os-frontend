import { LogOut } from "lucide-react";

import { ShellCycleSelector } from "@/components/app/ShellCycleSelector";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SessionUser } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/**
 * O RODAPÉ DA COLUNA — quem está logado, o ciclo em foco e a saída.
 *
 * O CICLO DESCEU PARA CÁ (dono, 2026-09-10, com captura): ele ficava no canto
 * superior direito e o dono mandou o canto superior enxugar. A captura mostra
 * o "2026 H2" na mesma linha do nome, e é assim que a linha é montada: o nome
 * ocupa o que sobra e trunca; o seletor não encolhe.
 *
 * A COLUNA RECOLHIDA fica só com a saída, como já ficava. Não é esquecimento:
 * no trilho não há linha para o nome nem largura para um seletor, e o ciclo
 * volta com um clique no botão que abre a coluna.
 *
 * O rodapé é um só para a coluna e para a gaveta móvel — eram dois blocos
 * quase iguais, e o segundo já nascia sem o `Tooltip` do primeiro.
 */
export function ShellSidebarFooter({
  user,
  collapsed = false,
  onLogout,
  cycleFieldId,
}: {
  user: SessionUser | null | undefined;
  collapsed?: boolean;
  onLogout: () => void;
  /** O id do campo de ciclo — os dois rodapés convivem no documento. */
  cycleFieldId?: string;
}) {
  const { t } = useI18n();

  if (collapsed) {
    return (
      <div
        data-shell-footer
        className="border-t border-sidebar-border px-2 py-4 text-xs text-sidebar-foreground/70"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onLogout}
              aria-label={t("shell.logout")}
              className="flex w-full justify-center rounded-md p-1.5 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {user?.name} · {t("shell.logout")}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div
      data-shell-footer
      className="border-t border-sidebar-border px-5 py-4 text-xs text-sidebar-foreground/70"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate font-medium text-sidebar-foreground">{user?.name}</p>
        <ShellCycleSelector {...(cycleFieldId === undefined ? {} : { id: cycleFieldId })} />
      </div>
      <p className="truncate">{user?.email}</p>
      <button
        type="button"
        onClick={onLogout}
        className="mt-2 flex items-center gap-1.5 text-sidebar-foreground/70 transition-colors hover:text-sidebar-accent-foreground"
      >
        <LogOut className="size-3.5" />
        {t("shell.logout")}
      </button>
    </div>
  );
}
