import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useGapAnalysisData } from "@/components/app/gap-analysis-shared";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * F2 (caminhos quentes) — `useGapAnalysisData` recortava a população
 * (`Selection.explicit(selected).apply(store.architects)`) direto no corpo do
 * hook. O recorte devolve um array novo a cada render, e esse array é
 * dependência de três `useMemo` pesados (radar, consolidação de progressão e
 * consolidação de maestria, que varrem o time inteiro): identidade nova a cada
 * render significa que os três recalculavam sempre, mesmo sem nada ter mudado.
 *
 * Este teste prova a estabilidade pela identidade dos resultados entre dois
 * renders sem mudança de estado — que é exatamente o que um `useMemo` promete.
 */

const fetchMock = vi.fn();

type GapAnalysisData = ReturnType<typeof useGapAnalysisData>;

const snapshots: GapAnalysisData[] = [];

function Probe() {
  snapshots.push(useGapAnalysisData());
  return null;
}

function Host() {
  const [pass, setPass] = useState(0);
  return (
    <>
      <button onClick={() => setPass(pass + 1)}>renderizar de novo</button>
      <p>passo:{pass}</p>
      <Probe />
    </>
  );
}

describe("useGapAnalysisData — memo do recorte da população (F2)", () => {
  beforeEach(() => {
    snapshots.length = 0;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("um render sem mudança de estado não recalcula radar, lacunas nem maestria", async () => {
    renderWithApp(<Host />);
    await screen.findByText("passo:0");

    const rendersAntes = snapshots.length;
    const antes = snapshots[rendersAntes - 1]!;

    await userEvent.click(screen.getByRole("button", { name: "renderizar de novo" }));
    await screen.findByText("passo:1");

    expect(snapshots.length).toBeGreaterThan(rendersAntes);
    const depois = snapshots[snapshots.length - 1]!;

    // pré-condição: nada do estado global mudou entre os dois renders
    expect(depois.store).toBe(antes.store);
    expect(depois.selected).toBe(antes.selected);

    expect(depois.architects).toBe(antes.architects);
    expect(depois.radar).toBe(antes.radar);
    expect(depois.priorities).toBe(antes.priorities);
    expect(depois.mastery).toBe(antes.mastery);
  });

  it("o recorte continua sendo a população selecionada, na ordem do catálogo", async () => {
    renderWithApp(<Host />);
    await screen.findByText("passo:0");

    const atual = snapshots[snapshots.length - 1]!;
    expect(atual.architects.map((a) => a.id)).toEqual(atual.selected);
    expect(atual.architects.map((a) => a.id)).toEqual(["ana", "bruno"]);
    // Onda 36.1: o eixo do radar carrega o NOME da capacidade, não o `short`
    // (pedido do dono — "quero que apareça todo o texto"; o short é uma
    // palavra só e fazia "Clean Core" parecer duas capacidades).
    expect(atual.radar.map((linha) => linha.capability)).toEqual([
      "Cloud Architecture",
      "Security",
    ]);
  });
});
