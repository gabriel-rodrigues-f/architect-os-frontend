import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CareerEventItem, EventTypeBadge } from "@/components/app/CareerEventTimeline";
import { Chip } from "@/components/app/Chip";
import { GapBadge, LevelBadge, StatusBadge } from "@/components/app/ui-bits";

import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * Revisão mestre 2026-09-08, [F-03] e [F-02]: seis famílias de badge com
 * raio, peso e padding diferentes — três chips distintos na mesma tabela —
 * e o nome do nível vivendo só no `title=`, que não abre no toque nem por
 * teclado. Toda família renderiza o MESMO `Chip` (`data-chip`), e o que o
 * `title` dizia agora é legível pelo leitor de tela e pelo `Tooltip`.
 */

const fetchMock = vi.fn();

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("synapse:locale", "pt");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const chipsDe = (container: HTMLElement) => container.querySelectorAll("[data-chip]");

describe("Chip — um só chip, com tom e tamanho", () => {
  it("tom semântico pinta pelo token; sem tom, quem pinta é a família", () => {
    const { container } = render(
      <>
        <Chip tone="danger">a</Chip>
        <Chip className="bg-level-3">b</Chip>
      </>,
    );
    const [danger, family] = Array.from(chipsDe(container));
    expect(danger?.className).toContain("bg-danger-subtle");
    expect(danger?.getAttribute("data-tone")).toBe("danger");
    expect(family?.className).toContain("bg-level-3");
    expect(family?.className).not.toContain("bg-secondary");
  });

  it("md é o padrão (rótulo 12 px); sm é a contagem (11 px); o raio é o mesmo", () => {
    const { container } = render(
      <>
        <Chip>md</Chip>
        <Chip size="sm">sm</Chip>
      </>,
    );
    const [md, sm] = Array.from(chipsDe(container));
    expect(md?.className).toContain("text-label");
    expect(sm?.className).toContain("text-meta");
    expect(md?.className).toContain("rounded-md");
    expect(sm?.className).toContain("rounded-md");
  });

  it("asChild veste o filho — o chip removível é um botão de verdade", () => {
    render(
      <Chip asChild tone="primary">
        <button type="button">remover</button>
      </Chip>,
    );
    const botao = screen.getByRole("button", { name: "remover" });
    expect(botao.getAttribute("data-chip")).not.toBeNull();
    expect(botao.className).toContain("bg-primary-subtle");
  });

  it("tooltip deixa uma cópia para o leitor de tela ao lado do chip, e nunca um title= nativo", () => {
    const { container } = render(<Chip tooltip="Nível 3 — Sênior">L3</Chip>);
    expect(screen.getByText("Nível 3 — Sênior").className).toContain("sr-only");
    expect(screen.getByText("L3").getAttribute("data-chip")).not.toBeNull();
    expect(container.querySelector("[title]")).toBeNull();
  });
});

describe("as famílias de badge renderizam o Chip", () => {
  it("nível, distância, status e tipo de evento", async () => {
    const { container } = renderWithApp(
      <>
        <LevelBadge level={3} />
        <GapBadge gap={2} />
        <StatusBadge tone="done" label="Concluída" />
        <EventTypeBadge kind="pdi" />
      </>,
    );
    await screen.findByText("L3");
    expect(chipsDe(container)).toHaveLength(4);
  });

  it("o nome do nível é acessível sem showName — e sem title", async () => {
    const { container } = renderWithApp(<LevelBadge level={3} />);
    await screen.findByText("L3");
    expect(container.querySelector("[title]")).toBeNull();
    expect(screen.getByText("L3").getAttribute("data-chip")).not.toBeNull();
    expect(container.querySelector(".sr-only")?.textContent).toMatch(/3/);
  });

  it("a ausência de nível e de distância explica-se sem title", async () => {
    const { container } = renderWithApp(
      <>
        <LevelBadge level={undefined} />
        <GapBadge gap={undefined} />
      </>,
    );
    await screen.findAllByText("—");
    expect(container.querySelector("[title]")).toBeNull();
    expect(container.querySelectorAll(".sr-only")).toHaveLength(2);
  });

  it("o item da linha do tempo leva o chip do tipo", async () => {
    const { container } = renderWithApp(
      <CareerEventItem
        entry={{
          id: "e1",
          kind: "pdi",
          date: "2026-01-10",
          title: "PDI aberto",
          detail: null,
          link: null,
        }}
      />,
    );
    await screen.findByText("PDI aberto");
    expect(chipsDe(container)).toHaveLength(1);
  });
});
