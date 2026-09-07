import type { ReactNode } from "react";

import { Callout } from "@/components/app/ui-bits";
import { cn } from "@/lib/utils";

/**
 * O aviso de erro das telas de porta — login, primeiro acesso, senha nova e
 * pedido de acesso. É o compacto do tom `danger` do `Callout` ([D-02]):
 * mesmo ícone, mesma live region (`role="alert"`, o leitor de tela anuncia
 * na hora), e NUNCA recebe foco — o foco fica no formulário, o aviso só
 * fala. A classe `auth-alert` (destrutivo dessaturado, fundo quase
 * transparente, borda fina) é a pele das portas sobre a mesma peça.
 */
export function AuthAlert({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Callout tone="danger" compact className={cn("auth-alert", className)}>
      {children}
    </Callout>
  );
}
