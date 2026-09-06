import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PersonCombobox } from "@/components/app/PersonCombobox";
import type { Architect } from "@/lib/domain";
import { I18nProvider } from "@/lib/i18n";
import { PersonPicker } from "@/lib/person-selection";

/**
 * O dono, olhando a tela: "Em 'Comparativo de Profissionais' não deve haver o
 * botão 'Todo o time'. E deve ser possível selecionar no máximo 2
 * profissionais. Esse gráfico de comparação é para no máximo 2 profissionais."
 *
 * As duas metades são a mesma decisão: marcar o time inteiro contradiz um
 * teto de dois. Por isso a opção SOME quando o teto existe, em vez de ficar
 * lá recusando o clique — e o teto é da forma `PersonPicker.upTo` (Strategy,
 * 2026-09-06), não da tela, para a próxima comparação que precisar de um não
 * reescrever nada. A guarda de regra (`pick` recusa acima do teto) é coberta
 * em `tests/lib/person-selection.test.ts`; aqui fica a apresentação.
 */
const pessoa = (id: string, name: string): Architect => ({
  id,
  name,
  role: "Pleno",
  yearsAsArchitect: 3,
  specialization: "",
  email: `${id}@a.com`,
  active: true,
  version: 1,
});

const architects: Architect[] = [
  pessoa("ana", "Ana Martins"),
  pessoa("bruno", "Bruno Almeida"),
  pessoa("carla", "Carla Souza"),
];

function montar(selected: string[], max?: number) {
  const onChange = vi.fn();
  const picker =
    max === undefined
      ? PersonPicker.many(architects, selected)
      : PersonPicker.upTo(max, architects, selected);
  render(
    <I18nProvider>
      <PersonCombobox picker={picker} onChange={onChange} label="Pessoas para comparar" />
    </I18nProvider>,
  );
  return onChange;
}

const abrir = () =>
  userEvent.click(screen.getByRole("combobox", { name: "Pessoas para comparar" }));

describe("o teto do Comparativo", () => {
  afterEach(() => cleanup());

  it("com teto, a opção 'Todo o time' não existe", async () => {
    montar([], 2);
    await abrir();

    expect(screen.queryByRole("option", { name: "Todo o time" })).toBeNull();
    expect(screen.getByRole("option", { name: /Ana Martins/ })).toBeTruthy();
  });

  it("sem teto ela continua existindo — quem a remove é o teto, não a tela", async () => {
    montar([]);
    await abrir();

    expect(screen.getByRole("option", { name: "Todo o time" })).toBeTruthy();
  });

  it("batido o teto, quem não está escolhido fica desabilitado — e desabilitado barra o clique", async () => {
    const onChange = montar(["ana", "bruno"], 2);
    await abrir();

    const terceira = screen.getByRole("option", { name: /Carla Souza/ });
    expect(terceira.getAttribute("aria-disabled")).toBe("true");

    await userEvent.click(terceira);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("desmarcar continua funcionando com o teto batido — senão a pessoa fica presa", async () => {
    const onChange = montar(["ana", "bruno"], 2);
    await abrir();
    await userEvent.click(screen.getByRole("option", { name: /Ana Martins/ }));

    expect(onChange).toHaveBeenCalledWith(["bruno"]);
  });
});
