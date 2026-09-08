import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PersonCombobox } from "@/components/app/PersonCombobox";
import type { Professional } from "@/lib/domain";
import { I18nProvider } from "@/lib/i18n";
import { PersonPicker } from "@/lib/person-selection";

/**
 * A combobox de pessoa única da aplicação (dono, 2026-09-06). Esta suíte
 * herda o que `professional-filter-select-all.test.tsx` garantia para o filtro
 * de várias pessoas — "Todo o time" como alternador de verdade, seleção
 * sempre explícita, roster que encolhe — e acrescenta o que motivou a troca:
 * com alcance vazio, "Todo o time" não existe e a única coisa na tela é
 * "Nenhum profissional cadastrado"; a busca que não acha ninguém diz
 * "Nenhum profissional encontrado." — as mesmas duas frases em todas as telas.
 */
const pessoa = (id: string, name: string): Professional => ({
  id,
  name,
  role: "Pleno",
  yearsAsProfessional: 3,
  specialization: "",
  email: `${id}@a.com`,
  active: true,
  version: 1,
});

const professionals: Professional[] = [
  pessoa("ana", "Ana Martins"),
  pessoa("bruno", "Bruno Almeida"),
];
const threeProfessionals: Professional[] = [...professionals, pessoa("carla", "Carla Souza")];

const renderMany = (selected: string[], reach: Professional[] = professionals) => {
  const onChange = vi.fn();
  render(
    <I18nProvider>
      <PersonCombobox
        picker={PersonPicker.many(reach, selected)}
        onChange={onChange}
        label="Profissionais"
      />
    </I18nProvider>,
  );
  return onChange;
};

const trigger = () => screen.getByRole("combobox", { name: "Profissionais" });
const abrir = () => userEvent.click(trigger());
const checkboxDe = (name: string) =>
  screen.getByRole("option", { name }).querySelector('[role="checkbox"]');

/**
 * Dono (2026-09-08), literal: *"Ao invés de aparecer como linha clicável no
 * filtro, vamos bloquear o filtro e disponibilizamos o botão de criação mais
 * abaixo, dentro do quadro principal e centralizado na tela."*
 *
 * Então o campo sem ninguém é moldura muda: a frase, o gatilho bloqueado e
 * nada mais — para todos. O botão de cadastro é provado em
 * `tests/components/app/vazio-no-centro.test.tsx`, no centro do quadro.
 */
describe("PersonCombobox — alcance vazio (dono, 2026-09-06; item 2, 2026-09-08)", () => {
  afterEach(() => cleanup());

  const vazio = () => screen.getByRole("button", { name: "Profissionais" });

  it.each([
    ["uma pessoa", PersonPicker.one([], null)],
    ["várias com 'Todo o time'", PersonPicker.many([], [])],
    ["várias com teto", PersonPicker.upTo(2, [], [])],
  ])(
    "na forma %s a tela diz que não há profissional cadastrado e nada abre",
    async (_f, picker) => {
      render(
        <I18nProvider>
          <PersonCombobox picker={picker} onChange={vi.fn()} label="Profissionais" />
        </I18nProvider>,
      );

      expect(vazio().textContent).toContain("Nenhum profissional cadastrado");
      expect(screen.queryByText("Todo o time")).toBeNull();

      await userEvent.click(vazio());
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(screen.queryByText("Todo o time")).toBeNull();
    },
  );

  it("o campo fica bloqueado e não oferece porta nenhuma — nem para quem cadastra", () => {
    render(
      <I18nProvider>
        <PersonCombobox
          picker={PersonPicker.many([], [])}
          onChange={vi.fn()}
          label="Profissionais"
        />
      </I18nProvider>,
    );

    expect(vazio().hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("PersonCombobox — busca", () => {
  afterEach(() => cleanup());

  it("quando a busca não acha ninguém, diz 'Nenhum profissional encontrado.'", async () => {
    renderMany([]);
    await abrir();
    await userEvent.type(screen.getByPlaceholderText("Buscar profissional…"), "zzz");

    expect(await screen.findByText("Nenhum profissional encontrado.")).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Ana Martins" })).toBeNull();
  });
});

describe("PersonCombobox — 'Todo o time' como alternador de verdade", () => {
  afterEach(() => cleanup());

  it("com todo mundo explicitamente selecionado, o mestre e cada pessoa aparecem marcados", async () => {
    renderMany(["ana", "bruno"]);
    await abrir();

    expect(checkboxDe("Todo o time")?.getAttribute("aria-checked")).toBe("true");
    for (const name of ["Ana Martins", "Bruno Almeida"]) {
      expect(checkboxDe(name)?.getAttribute("aria-checked")).toBe("true");
    }
    expect(trigger().textContent).toContain("Todo o time (2)");
  });

  it("com seleção vazia, o mestre e cada pessoa aparecem desmarcados", async () => {
    renderMany([]);
    await abrir();

    expect(checkboxDe("Todo o time")?.getAttribute("aria-checked")).toBe("false");
    for (const name of ["Ana Martins", "Bruno Almeida"]) {
      expect(checkboxDe(name)?.getAttribute("aria-checked")).toBe("false");
    }
    expect(trigger().textContent).toContain("Nenhum profissional selecionado");
  });

  it("clicar em 'Todo o time' já marcado desmarca tudo; com seleção parcial marca todo mundo", async () => {
    const onChange = renderMany(["ana", "bruno"]);
    await abrir();
    await userEvent.click(screen.getByRole("option", { name: "Todo o time" }));
    expect(onChange).toHaveBeenCalledWith([]);
    cleanup();

    const onChange2 = renderMany(["ana"]);
    await abrir();
    await userEvent.click(screen.getByRole("option", { name: "Todo o time" }));
    expect(onChange2).toHaveBeenCalledWith(["ana", "bruno"]);
  });

  it("clicar numa pessoa específica alterna só ela, e a lista continua aberta", async () => {
    const onChange = renderMany([]);
    await abrir();
    await userEvent.click(screen.getByRole("option", { name: "Bruno Almeida" }));

    expect(onChange).toHaveBeenCalledWith(["bruno"]);
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("com uma pessoa já selecionada, o mestre fica indeterminado e marcar outra amplia", async () => {
    const onChange = renderMany(["ana"], threeProfessionals);
    await abrir();

    expect(checkboxDe("Todo o time")?.getAttribute("data-state")).toBe("indeterminate");
    await userEvent.click(screen.getByRole("option", { name: "Bruno Almeida" }));
    expect(onChange).toHaveBeenCalledWith(["ana", "bruno"]);
  });

  it("com um id de seleção que não está mais no alcance, o mestre não aparece marcado por engano", async () => {
    renderMany(["ana", "ninguem-mais"]);
    await abrir();

    expect(checkboxDe("Todo o time")?.getAttribute("aria-checked")).toBe("mixed");
    expect(trigger().textContent).toContain("Ana Martins");
  });

  it("quando o alcance encolhe e deixa a seleção com um id órfão, o resumo se recalcula sozinho", async () => {
    function Harness() {
      const [reach, setReach] = useState(threeProfessionals);
      const [selected, setSelected] = useState(["ana", "bruno", "carla"]);
      return (
        <div>
          <button type="button" onClick={() => setReach(professionals)}>
            Remover Carla do alcance
          </button>
          <PersonCombobox
            picker={PersonPicker.many(reach, selected)}
            onChange={setSelected}
            label="Profissionais"
          />
        </div>
      );
    }
    render(
      <I18nProvider>
        <Harness />
      </I18nProvider>,
    );

    expect(trigger().textContent).toContain("Todo o time (3)");
    await userEvent.click(screen.getByRole("button", { name: "Remover Carla do alcance" }));
    expect(trigger().textContent).toContain("Todo o time (2)");
  });
});

describe("PersonCombobox — uma pessoa", () => {
  afterEach(() => cleanup());

  it("escolher fecha a lista e entrega só o id escolhido; sem ninguém, mostra o convite", async () => {
    const onChange = vi.fn();
    render(
      <I18nProvider>
        <PersonCombobox
          picker={PersonPicker.one(professionals, null)}
          onChange={onChange}
          label="Profissionais"
        />
      </I18nProvider>,
    );
    expect(trigger().textContent).toContain("Selecionar profissional…");

    await abrir();
    expect(screen.queryByRole("option", { name: "Todo o time" })).toBeNull();
    await userEvent.click(screen.getByRole("option", { name: "Bruno Almeida" }));

    expect(onChange).toHaveBeenCalledWith(["bruno"]);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("PersonCombobox — mouse e teclado (herdado de filter-popover-toggle)", () => {
  afterEach(() => cleanup());

  it("clicar no gatilho abre, clicar de novo fecha, clicar de novo abre", async () => {
    renderMany(["ana"]);

    await userEvent.click(trigger());
    expect(screen.queryByRole("listbox"), "1º clique deveria abrir").not.toBeNull();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");

    await userEvent.click(trigger());
    expect(screen.queryByRole("listbox"), "2º clique deveria fechar").toBeNull();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");

    await userEvent.click(trigger());
    expect(screen.queryByRole("listbox"), "3º clique deveria abrir").not.toBeNull();
  });

  it("abrir destaca 'Todo o time'; seta navega; Enter marca a destacada", async () => {
    const onChange = renderMany([]);
    await abrir();

    expect(screen.getByRole("option", { name: "Todo o time" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(
      screen.getByRole("option", { name: "Bruno Almeida" }).getAttribute("aria-selected"),
    ).toBe("true");

    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(["bruno"]);
  });

  it("Escape fecha e devolve o foco para o gatilho", async () => {
    renderMany(["ana"]);
    await abrir();
    expect(screen.queryByRole("listbox")).not.toBeNull();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });
});
