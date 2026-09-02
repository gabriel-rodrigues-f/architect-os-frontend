import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArchitectFilter } from "@/components/app/ArchitectFilter";
import type { Architect } from "@/lib/domain";
import { I18nProvider } from "@/lib/i18n";

/**
 * O dono, olhando a tela: "Em 'Comparativo de Profissionais' não deve haver o
 * botão 'Todo o time'. E deve ser possível selecionar no máximo 2
 * profissionais. Esse gráfico de comparação é para no máximo 2 profissionais."
 *
 * As duas metades são a mesma decisão: marcar o time inteiro contradiz um
 * teto de dois. Por isso a opção SOME quando o teto existe, em vez de ficar
 * lá recusando o clique — e o teto é do componente, não da tela, para a
 * próxima comparação que precisar de um não reescrever nada.
 *
 * HONESTIDADE SOBRE O QUE ESTA SUÍTE COBRE, medida por mutação:
 * matar o `disabled` derruba um teste; devolver "Todo o time" derruba outro.
 * Mas apagar a guarda do `toggle` NÃO derruba nada — o `disabled` impede o
 * clique de chegar ao handler, então a asserção passa pelo motivo errado.
 *
 * A guarda continua no código de propósito: `disabled` é apresentação e a
 * guarda é a regra. Quem mexer no estilo amanhã não pode reabrir o teto sem
 * perceber. Mas ela é defesa em profundidade que ESTA suíte não exercita, e
 * dizer isso vale mais do que uma asserção que finge cobri-la.
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
  render(
    <I18nProvider>
      <ArchitectFilter
        architects={architects}
        selected={selected}
        onChange={onChange}
        {...(max === undefined ? {} : { max })}
      />
    </I18nProvider>,
  );
  return onChange;
}

const abrir = () => userEvent.click(screen.getByRole("button", { expanded: false }));

describe("o teto do Comparativo", () => {
  afterEach(() => cleanup());

  it("com teto, a opção 'Todo o time' não existe", async () => {
    montar([], 2);
    await abrir();

    expect(screen.queryByRole("button", { name: "Todo o time" })).toBeNull();
    expect(screen.getByRole("option", { name: /Ana Martins/ })).toBeTruthy();
  });

  it("sem teto ela continua existindo — quem a remove é o teto, não a tela", async () => {
    montar([]);
    await abrir();

    expect(screen.getByRole("button", { name: "Todo o time" })).toBeTruthy();
  });

  it("batido o teto, quem não está escolhido fica desabilitado — e desabilitado barra o clique", async () => {
    const onChange = montar(["ana", "bruno"], 2);
    await abrir();

    const terceira = screen.getByRole("option", { name: /Carla Souza/ });
    expect(terceira.hasAttribute("disabled")).toBe(true);

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
