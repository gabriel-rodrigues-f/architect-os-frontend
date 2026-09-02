import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArchitectFilter } from "@/components/app/ArchitectFilter";
import type { Architect } from "@/lib/domain";
import { I18nProvider } from "@/lib/i18n";

/**
 * Pedido do usuário revisando o app rodando, em duas rodadas:
 * (1) com "Todo o time" marcado, as caixinhas de cada pessoa apareciam
 * desmarcadas; (2) clicar em "Todo o time" já marcado não tinha efeito
 * nenhum visível. A resolução das duas juntas: `selected` passa a ser
 * sempre explícito (vazio = ninguém, nunca mais "todo o time" implícito), e
 * "Todo o time" vira um alternador de verdade — marca tudo, clique de novo
 * desmarca tudo. Mesmo componente usado em gap-analysis.tsx e compare.tsx
 * (mentoring.tsx passou a usar `MenteeFilterCombobox`, seleção única, a
 * partir de R2-UX-11 — mentoria é sempre 1:1).
 */

const architects: Architect[] = [
  {
    id: "ana",
    name: "Ana Martins",
    role: "Pleno",
    yearsAsArchitect: 4,
    specialization: "",
    email: "a@a.com",
    active: true,
    version: 1,
  },
  {
    id: "bruno",
    name: "Bruno Almeida",
    role: "Júnior",
    yearsAsArchitect: 2,
    specialization: "",
    email: "b@b.com",
    active: true,
    version: 1,
  },
];

const threeArchitects: Architect[] = [
  ...architects,
  {
    id: "carla",
    name: "Carla Souza",
    role: "Pleno",
    yearsAsArchitect: 3,
    specialization: "",
    email: "c@c.com",
    active: true,
    version: 1,
  },
];

const renderFilter = (selected: string[]) => {
  const onChange = vi.fn();
  render(
    <I18nProvider>
      <ArchitectFilter architects={architects} selected={selected} onChange={onChange} />
    </I18nProvider>,
  );
  return onChange;
};

describe("ArchitectFilter — 'Todo o time' como alternador de verdade", () => {
  afterEach(() => cleanup());

  it("com todo mundo explicitamente selecionado, o mestre e cada pessoa aparecem marcados", async () => {
    renderFilter(["ana", "bruno"]);
    await userEvent.click(screen.getByRole("button", { expanded: false }));

    const master = screen
      .getByRole("button", { name: "Todo o time" })
      .querySelector('[role="checkbox"]');
    expect(master?.getAttribute("aria-checked")).toBe("true");

    for (const option of screen.getAllByRole("option")) {
      expect(option.querySelector('[role="checkbox"]')?.getAttribute("aria-checked")).toBe("true");
    }
  });

  it("com seleção vazia, o mestre e cada pessoa aparecem desmarcados", async () => {
    renderFilter([]);
    await userEvent.click(screen.getByRole("button", { expanded: false }));

    const master = screen
      .getByRole("button", { name: "Todo o time" })
      .querySelector('[role="checkbox"]');
    expect(master?.getAttribute("aria-checked")).toBe("false");

    for (const option of screen.getAllByRole("option")) {
      expect(option.querySelector('[role="checkbox"]')?.getAttribute("aria-checked")).toBe("false");
    }
    expect(screen.getByText("Nenhum profissional selecionado")).toBeTruthy();
  });

  it("clicar em 'Todo o time' já marcado (todos selecionados) desmarca tudo", async () => {
    const onChange = renderFilter(["ana", "bruno"]);
    await userEvent.click(screen.getByRole("button", { expanded: false }));
    await userEvent.click(screen.getByRole("button", { name: "Todo o time" }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("clicar em 'Todo o time' com seleção vazia ou parcial marca todo mundo", async () => {
    const onChange = renderFilter(["ana"]);
    await userEvent.click(screen.getByRole("button", { expanded: false }));
    await userEvent.click(screen.getByRole("button", { name: "Todo o time" }));

    expect(onChange).toHaveBeenCalledWith(["ana", "bruno"]);
  });

  it("clicar numa pessoa específica alterna só ela, sem depender do estado do mestre", async () => {
    const onChange = renderFilter([]);
    await userEvent.click(screen.getByRole("button", { expanded: false }));
    await userEvent.click(screen.getByRole("option", { name: "Bruno Almeida" }));

    expect(onChange).toHaveBeenCalledWith(["bruno"]);
  });

  /** ORIENTACAO-NONA-RODADA-FECHAMENTO, Seção 36 (A1) — individual → parcial. */
  it("com uma pessoa já selecionada, marcar outra amplia para parcial (mestre indeterminado)", async () => {
    const onChange = vi.fn();
    render(
      <I18nProvider>
        <ArchitectFilter architects={threeArchitects} selected={["ana"]} onChange={onChange} />
      </I18nProvider>,
    );
    await userEvent.click(screen.getByRole("button", { expanded: false }));

    const master = screen
      .getByRole("button", { name: "Todo o time" })
      .querySelector('[role="checkbox"]');
    expect(master?.getAttribute("data-state")).toBe("indeterminate");

    await userEvent.click(screen.getByRole("option", { name: "Bruno Almeida" }));
    expect(onChange).toHaveBeenCalledWith(["ana", "bruno"]);
  });

  /**
   * ORIENTACAO-NONA-RODADA-FECHAMENTO, Seção 28/36 (A1) — roster alterado
   * com seleção stale: `selected` guarda um id de alguém que já saiu da
   * lista (desativado, por exemplo). Sem filtrar por quem está visível,
   * `selected.length === architects.length` podia coincidir por acidente
   * (um id de gente real a menos, um id fantasma a mais) e mostrar "Todo o
   * time" marcado quando não estava todo mundo real selecionado.
   */
  it("com um id de seleção que não está mais no roster, o mestre não aparece marcado por engano", async () => {
    const onChange = vi.fn();
    render(
      <I18nProvider>
        {/* "ninguem-mais" não existe em `architects` (só 2 pessoas) — mesma
            contagem que "todos selecionados" (2), mas não é o caso. */}
        <ArchitectFilter
          architects={architects}
          selected={["ana", "ninguem-mais"]}
          onChange={onChange}
        />
      </I18nProvider>,
    );
    await userEvent.click(screen.getByRole("button", { expanded: false }));

    const master = screen
      .getByRole("button", { name: "Todo o time" })
      .querySelector('[role="checkbox"]');
    // "mixed" (não "true") é o que importa: com só 1 de 2 pessoas reais
    // selecionada, o mestre nunca deveria aparecer como totalmente marcado.
    expect(master?.getAttribute("aria-checked")).toBe("mixed");
    expect(master?.getAttribute("data-state")).toBe("indeterminate");

    // O resumo também conta só quem está de fato visível (1), não os 2 ids brutos.
    expect(screen.getByRole("button", { expanded: true }).textContent).toContain("Ana Martins");
  });

  /**
   * O mesmo roster-stale, mas visto como transição: a lista de arquitetos
   * encolhe (alguém saiu) enquanto a seleção do componente pai continua
   * intacta — o componente precisa se recompor sozinho a partir das novas
   * props, sem exigir que o pai limpe o id órfão primeiro.
   */
  it("quando o roster encolhe e deixa a seleção com um id órfão, o resumo se recalcula sozinho", async () => {
    function Harness() {
      const [roster, setRoster] = useState(threeArchitects);
      const [selected, setSelected] = useState(["ana", "bruno", "carla"]);
      return (
        <div>
          <button type="button" onClick={() => setRoster(architects)}>
            Remover Carla do roster
          </button>
          <ArchitectFilter architects={roster} selected={selected} onChange={setSelected} />
        </div>
      );
    }
    render(
      <I18nProvider>
        <Harness />
      </I18nProvider>,
    );

    expect(screen.getByRole("button", { name: /Todo o time \(3\)/ })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Remover Carla do roster" }));
    // 2 ids visíveis de 2 arquitetos reais — ainda é "todo o time", só que (2), não (3).
    expect(screen.getByRole("button", { name: /Todo o time \(2\)/ })).toBeTruthy();
  });
});

/**
 * REVISAO-360-FRONTEND, Seção 80 — o listbox só respondia a mouse: sem
 * seta/Home/End pra navegar entre opções, sem Escape pra fechar, sem o
 * foco entrar na lista ao abrir nem voltar pro botão ao fechar. Como
 * cada opção já é um `<button>` de verdade, Enter/Espaço para
 * marcar/desmarcar já funcionavam nativamente — só a navegação e o
 * ciclo de foco precisavam de tratamento explícito.
 */
describe("ArchitectFilter — navegação por teclado", () => {
  afterEach(() => cleanup());

  it("abrir move o foco para 'Todo o time', a primeira opção", async () => {
    renderFilter(["ana"]);
    await userEvent.click(screen.getByRole("button", { expanded: false }));

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Todo o time" }));
  });

  it("seta para baixo/cima navega entre as opções, com wrap nas pontas", async () => {
    renderFilter(["ana"]);
    await userEvent.click(screen.getByRole("button", { expanded: false }));

    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("option", { name: "Ana Martins" }));

    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("option", { name: "Bruno Almeida" }));

    // Última opção → seta para baixo de novo dá a volta pro topo.
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Todo o time" }));

    // Do topo, seta para cima dá a volta pro fim.
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(screen.getByRole("option", { name: "Bruno Almeida" }));
  });

  it("Home e End pulam para a primeira e a última opção", async () => {
    renderFilter(["ana"]);
    await userEvent.click(screen.getByRole("button", { expanded: false }));

    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(screen.getByRole("option", { name: "Bruno Almeida" }));

    await userEvent.keyboard("{Home}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Todo o time" }));
  });

  it("Enter/Espaço em uma opção focada marca/desmarca — funciona nativo, sem handler extra", async () => {
    const onChange = renderFilter([]);
    await userEvent.click(screen.getByRole("button", { expanded: false }));
    await userEvent.keyboard("{ArrowDown}{ArrowDown}"); // Todo o time → Ana → Bruno
    await userEvent.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith(["bruno"]);
  });

  it("Escape fecha o menu e devolve o foco para o botão que abriu", async () => {
    renderFilter(["ana"]);
    const trigger = screen.getByRole("button", { expanded: false });
    await userEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeTruthy();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("seta para baixo no botão fechado abre o menu", async () => {
    renderFilter(["ana"]);
    screen.getByRole("button", { expanded: false }).focus();

    await userEvent.keyboard("{ArrowDown}");

    expect(screen.getByRole("listbox")).toBeTruthy();
  });
});
