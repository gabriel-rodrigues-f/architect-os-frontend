import { createFileRoute } from "@tanstack/react-router";

import { SetPasswordScreen } from "@/components/app/SetPasswordScreen";
import { AccessInvitation } from "@/lib/access-recovery";

/**
 * A rota do link do convite: `<origem>/set-password?token=<token>`.
 *
 * É a PRIMEIRA rota pública do Synapse — alcançável sem sessão, declarada
 * como tal em `tests/architecture/alcance-por-rota.fixture.json` e listada em
 * `PublicReach`, que é o que faz o `__root` desenhá-la por fora do `AuthGate`.
 * Sem guarda de navegação, de propósito: quem autoriza é o token, e quem o
 * julga é o serviço.
 *
 * O token é lido pelo `validateSearch` do router — e não do `window` no
 * primeiro render — porque a página é servida por SSR: ler do navegador faria
 * o servidor desenhar "este link está incompleto" e a hidratação trocar a
 * tela na cara de quem acabou de clicar.
 */
export const Route = createFileRoute("/set-password")({
  validateSearch: (search: Record<string, unknown>): { token: string | undefined } => ({
    token: AccessInvitation.tokenIn(search),
  }),
  head: () => ({
    meta: [
      { title: "Criar a sua senha — Synapse" },
      {
        name: "description",
        content:
          "Crie a senha da sua conta a partir do link do convite. O link é só seu e vale uma vez.",
      },
      { property: "og:title", content: "Criar a sua senha — Synapse" },
    ],
  }),
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const { token } = Route.useSearch();
  return <SetPasswordScreen token={token} />;
}
