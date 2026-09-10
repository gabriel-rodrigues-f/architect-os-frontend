import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";

/**
 * A ENGRENAGEM DO CABEÇALHO, DEPOIS DE MINHA CONTA — o atalho, não a tela.
 *
 * O que ela tinha até aqui, medido antes de mexer: exatamente duas coisas, num
 * popover — as três escolhas de tema (Claro · Escuro · Sistema) e o seletor de
 * idioma. Nada mais. As duas passaram para **Minha Conta → Preferências**
 * (avaliação de 2026-09-09, seção 7: Minha Conta *"absorve o menu da
 * engrenagem do cabeçalho"*).
 *
 * Por que ela não some junto com o conteúdo: quem já se acostumou com o
 * cantinho superior direito clicaria no vazio, e o caminho novo — rolar a
 * coluna até o último grupo — é mais longo do que o que existia. Manter os
 * mesmos dois controles nos dois lugares era o outro extremo, e cria duas
 * telas para o mesmo estado, que é justamente o que "absorver" evita.
 *
 * Então ela vira PORTA: mesmo ícone, mesmo lugar, mesmo tamanho de alvo — e
 * agora leva a Minha Conta, onde tema e idioma moram. O nome acessível deixa
 * de ser "Preferências" e passa a ser "Minha Conta", porque é para onde o
 * clique vai: um atalho que anuncia o destino errado é pior que atalho
 * nenhum.
 *
 * A dica ao passar o mouse é o `Tooltip` da casa, e não o `title` nativo que o
 * popover usava: o `title` do navegador não é estilizável, demora a aparecer e
 * some sozinho, e a catraca `title-por-arquivo` só desce. O cabeçalho já vive
 * dentro do `TooltipProvider` do `AppShell` — a mesma peça que veste o "sair"
 * da coluna recolhida.
 */
export function AccountShortcut() {
  const { t } = useI18n();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to="/account"
          aria-label={t("shell.account")}
          className="rounded-md border border-input bg-card p-2 text-muted-foreground transition-base hover:text-foreground"
        >
          <Settings className="size-4" aria-hidden="true" />
        </Link>
      </TooltipTrigger>
      <TooltipContent>{t("shell.account")}</TooltipContent>
    </Tooltip>
  );
}
