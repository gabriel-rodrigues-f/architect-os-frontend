import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PasswordChoiceFields } from "@/components/app/PasswordChoiceFields";
import { usePasswordChoice } from "@/hooks";
import { I18nProvider } from "@/lib/i18n";

/**
 * Dono (2026-09-08, com captura de "Defina sua senha"): *"os forms de criação
 * e recuperação de senha precisam ter o olhinho para poder visualizar/esconder
 * a senha, assim como o form de login."*
 *
 * `PasswordChoiceFields` é o desenho compartilhado pelo primeiro acesso, pelo
 * convite por link e pela recuperação — um componente, três telas. Provar
 * aqui prova nas três; provar em uma tela só deixaria as outras duas soltas.
 */
function Formulario({ email }: { email: string | null }) {
  const choice = usePasswordChoice(email);
  return <PasswordChoiceFields choice={choice} />;
}

const renderizar = (email: string | null = "pessoa@synapse.com") =>
  render(
    <I18nProvider>
      <Formulario email={email} />
    </I18nProvider>,
  );

describe("PasswordChoiceFields — o olhinho nos dois campos de senha nova", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("synapse:locale", "pt");
  });

  afterEach(cleanup);

  it("os dois campos nascem escondidos e cada um tem o seu botão de mostrar", () => {
    renderizar();

    const nova = document.getElementById("new-password") as HTMLInputElement;
    const repita = document.getElementById("confirm-password") as HTMLInputElement;
    expect(nova.type).toBe("password");
    expect(repita.type).toBe("password");
    expect(screen.getAllByRole("button", { name: "Mostrar senha" })).toHaveLength(2);
  });

  it("mostrar um campo não mostra o outro, e o botão anuncia o estado", async () => {
    renderizar();
    const user = userEvent.setup();

    const nova = document.getElementById("new-password") as HTMLInputElement;
    const repita = document.getElementById("confirm-password") as HTMLInputElement;
    const [botaoDaNova] = screen.getAllByRole("button", { name: "Mostrar senha" });

    await user.click(botaoDaNova!);

    expect(nova.type).toBe("text");
    expect(repita.type).toBe("password");
    const ocultar = screen.getByRole("button", { name: "Ocultar senha" });
    expect(ocultar.getAttribute("aria-pressed")).toBe("true");

    await user.click(ocultar);
    expect(nova.type).toBe("password");
  });

  it("o campo continua sendo o campo: rótulo, autocomplete e a lista de exigências ainda apontam para ele", () => {
    renderizar();

    const nova = document.getElementById("new-password") as HTMLInputElement;
    expect(nova.getAttribute("autocomplete")).toBe("new-password");
    expect(nova.required).toBe(true);
    expect(nova.getAttribute("aria-describedby")).toBe("password-requirements");
    expect(screen.getByText("Senha nova").getAttribute("for")).toBe("new-password");
    expect(screen.getByText("Repita a senha nova").getAttribute("for")).toBe("confirm-password");
  });
});
