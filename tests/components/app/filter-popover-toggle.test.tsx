import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArchitectFilter } from "@/components/app/ArchitectFilter";
import { MultiSelectFilter } from "@/components/app/MultiSelectFilter";
import { SingleSelectFilter } from "@/components/app/SingleSelectFilter";
import type { Architect } from "@/lib/domain";
import { I18nProvider } from "@/lib/i18n";

/**
 * Achado do dono usando o app: o combobox "alterna errado no terceiro clique".
 * Abrir e fechar no mouse é o gesto mais banal que existe e estava quebrado nos
 * três filtros ao mesmo tempo (Time, Prioridades, Progressão), porque a fatia de
 * acessibilidade de 22/08 deu a cada um deles um segundo dono do estado
 * aberto/fechado: um `onBlur` na lista que fechava o popover assim que o foco
 * saía dela. Apertar o mouse sobre o gatilho tira o foco da lista — então a
 * lista já fechava no apertar, e o clique que vinha em seguida encontrava um
 * popover fechado e o reabria.
 *
 * O gesto inteiro (apertar e soltar) às vezes acaba no estado certo por
 * coincidência de ordem de eventos, e foi por isso que a suíte ficou verde e o
 * defeito sobreviveu 6 dias. Por isso o teste desce ao nível do gesto: apertar
 * o botão do mouse sobre o gatilho não pode, sozinho, mudar o estado da lista —
 * quem alterna é o clique, e só ele. O Radix já trata esse caso (ignora de
 * propósito a interação de fora quando o alvo é o próprio gatilho); o `onBlur`
 * manual atropelava esse tratamento.
 *
 * Os testes de mouse e os de teclado moram juntos de propósito: o ciclo que nos
 * custou 6 dias foi consertar um e quebrar o outro em silêncio.
 */

const architects: Architect[] = [
  {
    id: "ana",
    name: "Ana Martins",
    role: "Arquiteto de Soluções II",
    yearsAsArchitect: 4,
    specialization: "",
    email: "a@a.com",
    active: true,
    version: 1,
  },
  {
    id: "bruno",
    name: "Bruno Almeida",
    role: "Arquiteto de Soluções I",
    yearsAsArchitect: 2,
    specialization: "",
    email: "b@b.com",
    active: true,
    version: 1,
  },
];

const renderTeamFilter = () => {
  render(
    <I18nProvider>
      <ArchitectFilter architects={architects} selected={["ana"]} onChange={vi.fn()} />
    </I18nProvider>,
  );
  return screen.getByRole("button", { expanded: false });
};

const renderPrioritiesFilter = () => {
  render(
    <I18nProvider>
      <MultiSelectFilter
        id="prioridades"
        label="Prioridades"
        options={[
          { id: "alta", label: "Alta" },
          { id: "media", label: "Média" },
          { id: "baixa", label: "Baixa" },
        ]}
        selected={["alta"]}
        onChange={vi.fn()}
        selectAllLabel="Todas"
        allSummaryLabel="Todas as prioridades"
        noneSummaryLabel="Nenhuma prioridade"
      />
    </I18nProvider>,
  );
  return screen.getByRole("button", { name: "Prioridades" });
};

const renderProgressionFilter = () => {
  render(
    <I18nProvider>
      <SingleSelectFilter
        id="progressao"
        label="Progressão"
        options={[
          { value: "estagnado", label: "Estagnado" },
          { value: "evoluindo", label: "Evoluindo" },
          { value: "acelerado", label: "Acelerado" },
        ]}
        value="evoluindo"
        onChange={vi.fn()}
      />
    </I18nProvider>,
  );
  return screen.getByRole("button", { name: "Progressão" });
};

/**
 * `entryOption` é a opção que deve receber o foco quando a lista abre: a
 * primeira nos filtros de marcar vários, a já escolhida no de escolha única —
 * é o que a lista precisa oferecer a quem chega pelo teclado.
 */
const filters = [
  {
    name: "Time (ArchitectFilter)",
    renderFilter: renderTeamFilter,
    firstOption: "Todo o time",
    lastOption: "Bruno Almeida",
    entryOption: "Todo o time",
  },
  {
    name: "Prioridades (MultiSelectFilter)",
    renderFilter: renderPrioritiesFilter,
    firstOption: "Todas",
    lastOption: "Baixa",
    entryOption: "Todas",
  },
  {
    name: "Progressão (SingleSelectFilter)",
    renderFilter: renderProgressionFilter,
    firstOption: "Estagnado",
    lastOption: "Acelerado",
    entryOption: "Evoluindo",
  },
];

const listOptions = () =>
  Array.from(screen.getByRole("listbox").querySelectorAll<HTMLButtonElement>(":scope > button"));

const option = (name: string) => {
  const found = listOptions().find((button) => button.textContent?.includes(name));
  if (!found) throw new Error(`Opção "${name}" não está na lista`);
  return found;
};

describe.each(filters)("$name — alternar no mouse", ({ renderFilter }) => {
  afterEach(() => cleanup());

  it("apertar o botão do mouse sobre o gatilho não fecha a lista — quem alterna é o clique", async () => {
    const user = userEvent.setup();
    const trigger = renderFilter();
    await user.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeNull();

    await user.pointer({ keys: "[MouseLeft>]", target: trigger });
    expect(screen.queryByRole("listbox"), "apertar o mouse não pode fechar a lista").not.toBeNull();

    await user.pointer({ keys: "[/MouseLeft]", target: trigger });
    expect(screen.queryByRole("listbox"), "soltar completa o clique e fecha").toBeNull();
  });

  it("clicar no gatilho abre, clicar de novo fecha, clicar de novo abre", async () => {
    const trigger = renderFilter();

    await userEvent.click(trigger);
    expect(screen.queryByRole("listbox"), "1º clique deveria abrir").not.toBeNull();

    await userEvent.click(trigger);
    expect(screen.queryByRole("listbox"), "2º clique deveria fechar").toBeNull();

    await userEvent.click(trigger);
    expect(screen.queryByRole("listbox"), "3º clique deveria abrir").not.toBeNull();
  });

  it("o gatilho anuncia o mesmo estado que a lista mostra, clique a clique", async () => {
    const trigger = renderFilter();

    await userEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    await userEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await userEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("clicar fora fecha a lista", async () => {
    const trigger = renderFilter();

    await userEvent.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeNull();

    await userEvent.click(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

/**
 * O que a fatia de 22/08 (REVISAO-360-FRONTEND, Seção 80) buscava e que segue
 * valendo: seta abre, o foco entra na lista, seta navega com volta nas pontas,
 * Home/End vão às pontas, Escape fecha e devolve o foco ao gatilho. Estava
 * coberto só no ArchitectFilter — os outros dois carregavam o mesmo código sem
 * rede nenhuma.
 */
describe.each(filters)(
  "$name — navegação por teclado",
  ({ renderFilter, firstOption, lastOption, entryOption }) => {
    afterEach(() => cleanup());

    it("seta para baixo no gatilho fechado abre a lista", async () => {
      const trigger = renderFilter();
      trigger.focus();

      await userEvent.keyboard("{ArrowDown}");

      expect(screen.queryByRole("listbox")).not.toBeNull();
    });

    it("abrir leva o foco para a opção de entrada da lista", async () => {
      const trigger = renderFilter();

      await userEvent.click(trigger);

      expect(document.activeElement).toBe(option(entryOption));
    });

    it("seta para baixo e para cima navegam com volta nas pontas", async () => {
      const trigger = renderFilter();
      await userEvent.click(trigger);
      option(firstOption).focus();

      await userEvent.keyboard("{ArrowUp}");
      expect(document.activeElement).toBe(option(lastOption));

      await userEvent.keyboard("{ArrowDown}");
      expect(document.activeElement).toBe(option(firstOption));
    });

    it("Home e End vão para a primeira e a última opção", async () => {
      const trigger = renderFilter();
      await userEvent.click(trigger);

      await userEvent.keyboard("{End}");
      expect(document.activeElement).toBe(option(lastOption));

      await userEvent.keyboard("{Home}");
      expect(document.activeElement).toBe(option(firstOption));
    });

    it("Escape fecha e devolve o foco para o gatilho", async () => {
      const trigger = renderFilter();
      await userEvent.click(trigger);
      expect(screen.queryByRole("listbox")).not.toBeNull();

      await userEvent.keyboard("{Escape}");

      expect(screen.queryByRole("listbox")).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
  },
);
