import { useRouter } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { DarkStage } from "@/components/app/DarkStage";
import { FirstAccessScreen } from "@/components/app/FirstAccessScreen";
import { LoginScreen } from "@/components/app/LoginScreen";
import { ServiceOutageScreen } from "@/components/app/ServiceOutageScreen";
import { useAuth } from "@/lib/auth";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, bootstrap, retrySession } = useAuth();
  const router = useRouter();

  /*
   * As guardas de rota (`beforeLoad`) rodam antes de a sessão existir: no
   * servidor (SSR) não há janela, e quem entra pela tela de login já está
   * na URL que pediu. Medido pelo dono (2026-09-06): o administrador abriu
   * /training-needs por URL e a tela desenhou a negativa em vez de voltar ao
   * Painel. Com a sessão conhecida, as guardas são reavaliadas — e quem não
   * alcança a rota é redirecionado, como se tivesse navegado até ela.
   */
  useEffect(() => {
    if (user) void router.invalidate();
  }, [router, user]);

  // Tudo o que vem antes da sessão aberta é palco escuro (dono, 2026-09-08).
  if (loading) {
    return (
      <DarkStage>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      </DarkStage>
    );
  }
  /*
   * SERVIÇO FORA NÃO É SESSÃO FORA. Dono (2026-09-07): "derrubei o backend
   * propositalmente… quando atualizei a tela fui deslogado. isso não pode
   * ocorrer, somente se o token do frontend expirar". Sem resposta do
   * `/auth/me`, a aplicação não sabe se há sessão — e o que não sabe não
   * decide: desenha a mesma tela de queda de toda a aplicação e o leitor
   * insiste até o serviço responder 200 (abre) ou 401 (login).
   */
  if (bootstrap.isServiceDown) {
    return (
      <DarkStage>
        <ServiceOutageScreen onRetry={retrySession} />
      </DarkStage>
    );
  }
  if (!user) {
    return (
      <DarkStage>
        <LoginScreen />
      </DarkStage>
    );
  }
  /*
   * A MARCA DE PÉ SEGURA A PORTA. Regra do dono (2026-09-03): "ao realizar o
   * primeiro acesso, o usuário (regra universal) precisa ter que alterar sua
   * senha". O backend já recusa toda rota com 403 PASSWORD_CHANGE_REQUIRED
   * enquanto `mustChangePassword` está de pé — quem entra tem sessão válida e
   * não vai a lugar nenhum.
   *
   * O bloqueio mora AQUI, e não numa rota, por duas razões: a pessoa chega à
   * troca logo depois do login em vez de tropeçar num 403, e o resto da
   * aplicação — menu, casca, `Outlet` — sequer é desenhado, então não existe
   * destino para onde navegar antes de trocar.
   */
  if (user.mustChangePassword) {
    return (
      <DarkStage>
        <FirstAccessScreen />
      </DarkStage>
    );
  }
  return <>{children}</>;
}
