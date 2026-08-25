import { Link } from "@tanstack/react-router";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * FASE 2 (quinta rodada) — Capability Map, Gap Analysis e Training Needs
 * eram três itens de primeiro nível para o mesmo momento de decisão
 * ("onde o time tem risco e o que priorizar"); a auditoria chamava
 * Training Needs de "redundante como tela standalone" e recomendava
 * consolidar as três em "Capacidades", com "Prioridades" e "Prioridades
 * coletivas" como sub-telas. Em vez de reescrever os três selectors e
 * telas (risco alto para o valor do momento), as rotas e a lógica de cada
 * uma continuam as mesmas — só a navegação vira uma unidade só: um item
 * na barra lateral, três abas aqui. Ver AUDITORIA-QUINTA-RODADA-360-
 * SYNAPSE-2026-08-19.md, Seção 6 e 33.
 */
const TABS = [
  { to: "/capability-map", labelKey: "cap.tabs.coverage" as const },
  { to: "/gap-analysis", labelKey: "cap.tabs.priorities" as const },
  { to: "/progression", labelKey: "cap.tabs.progression" as const },
  { to: "/training-needs", labelKey: "cap.tabs.collective" as const },
  { to: "/compare", labelKey: "cap.tabs.comparison" as const },
];

export function CapabilitiesTabs() {
  /**
   * Cada uma das três rotas é um componente de página distinto — navegar
   * entre elas remonta `CapabilitiesTabs` do zero, então ler
   * `window.location.pathname` direto no render (em vez de `useRouterState`,
   * que exige o contexto do Router e quebra os testes de página que montam
   * o componente isolado, sem `RouterProvider`) já reflete a rota atual
   * sem precisar reagir a mudanças dentro do próprio componente.
   */
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;
  const { t } = useI18n();

  /**
   * B-30 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, §10 achado #4)
   * — `role="tablist"`/`role="tab"` era semântica incorreta: cada item aqui
   * é um link para uma ROTA diferente (o conteúdo não troca dentro da
   * mesma página), não um painel que aparece/desaparece sob o mesmo
   * `tabpanel`. Um leitor de tela anunciava "aba" e esperava navegação por
   * setas, que nunca existiu. `<nav>` + `aria-current="page"` é a
   * semântica correta pra navegação entre páginas.
   */
  return (
    <nav
      className="mb-6 flex gap-1 overflow-x-auto whitespace-nowrap border-b border-border"
      aria-label={t("nav.capabilities")}
    >
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.to);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t(tab.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
