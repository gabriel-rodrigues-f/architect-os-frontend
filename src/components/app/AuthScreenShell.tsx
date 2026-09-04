import type { ReactNode } from "react";

import { useI18n } from "@/lib/i18n";

/**
 * A CASCA DAS TELAS DE PORTA — a marca, o subtítulo e o cartão em volta do
 * formulário.
 *
 * Ela já existia três vezes copiada: `LoginScreen`, `FirstAccessScreen` e
 * agora `SetPasswordScreen`, a tela em que a pessoa cria a própria senha a
 * partir do link do convite. Regra da casa: o que serve a 2 lugares vira
 * componente — aqui já eram 3, e a terceira cópia teria nascido divergindo
 * (a do login não tinha a folga vertical das outras).
 *
 * Ela não sabe de sessão de propósito. `SetPasswordScreen` é alcançada SEM
 * sessão — escapa do `AuthGate` do `__root` —, então a casca não pode
 * depender de nada que só exista do lado autenticado.
 */
export function AuthScreenShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 leading-tight">
          <p className="font-display text-xl font-semibold">Synapse</p>
          <p className="text-xs text-muted-foreground">{t("login.subtitle")}</p>
        </div>

        <div className="surface-card p-6">{children}</div>
      </div>
    </div>
  );
}
