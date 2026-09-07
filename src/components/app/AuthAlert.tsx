import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * O aviso de erro das telas de porta — login, primeiro acesso, senha nova e
 * pedido de acesso. Era o mesmo `<p role="alert">` copiado quatro vezes;
 * regra da casa: dois lugares, um componente.
 *
 * Refino do login (2026-09-07): mais suave — o destrutivo dessaturado no
 * texto, fundo quase transparente, borda fina e um ícone discreto. É uma
 * live region (`role="alert"`) para o leitor de tela anunciar na hora, e
 * NUNCA recebe foco: o foco fica no formulário, o aviso só fala. O texto é
 * filho direto do `<p>` (sem `<span>`): quem procura a frase encontra o
 * próprio alerta.
 */
export function AuthAlert({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p role="alert" className={cn("auth-alert", className)}>
      <CircleAlert className="auth-alert-icon" aria-hidden="true" />
      {children}
    </p>
  );
}
