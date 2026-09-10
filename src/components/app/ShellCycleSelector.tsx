import { useSelectionEmptyState } from "@/components/app/EmptySelection";
import { SingleSelectFilter } from "@/components/app/SingleSelectFilter";
import { useAuth } from "@/lib/auth";
import { useCycleSelection } from "@/lib/context-scope";
import { useI18n } from "@/lib/i18n";
import { Registration } from "@/lib/registration";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";

/**
 * O SELETOR DE CICLO, agora no RODAPÉ DA COLUNA (dono, 2026-09-10, com
 * captura): *"os demais botões — ciclo, notificações e configuração — vamos
 * jogar para o canto inferior"*, e a captura mostra o "2026 H2" ao lado do
 * nome de quem está logado.
 *
 * Nada do que ele faz mudou de regra: quem opera o sistema ESCOLHE o ciclo;
 * os demais LEEM o ciclo em foco, porque o recorte deles é do servidor. Sem
 * ciclo cadastrado, o seletor diz que não há e leva a quem pode cadastrar — a
 * frase, o destino e a pergunta de alcance vêm do `Registration`, e esta peça
 * não repete nenhuma das três.
 *
 * Ele vive nos DOIS rodapés — o da coluna e o da gaveta móvel —, e por isso é
 * um componente e não dois blocos parecidos. Os dois podem estar no documento
 * ao mesmo tempo (a coluna some por CSS, não por desmontagem), e por isso o
 * `id` é PARÂMETRO: dois campos com o mesmo id fariam o rótulo de um apontar
 * para o outro.
 */
export function ShellCycleSelector({ id = "cycle" }: { id?: string }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { cycles, activeCycleId, setActiveCycle } = useCycleSelection();
  const cicloVazio = useSelectionEmptyState(Registration.CYCLE);

  if (user && defaultUiAuthorizationPolicy.operatesTheSystem(user)) {
    return (
      <SingleSelectFilter
        id={id}
        ariaLabel={t("shell.cycle")}
        value={activeCycleId}
        onChange={setActiveCycle}
        options={cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))}
        empty={cicloVazio}
        triggerClassName="h-8 w-auto min-w-0 border-sidebar-border bg-transparent px-2 py-1 text-meta shadow-none"
      />
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-1.5 text-meta">
      <span className="sr-only">{t("shell.cycle")}</span>
      <span className="font-medium text-sidebar-foreground">
        {cycles.find((cycle) => cycle.id === activeCycleId)?.name ?? "—"}
      </span>
    </span>
  );
}
