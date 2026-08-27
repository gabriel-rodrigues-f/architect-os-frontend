import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useObjectiveFromGap } from "@/lib/store";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * CFG-03 — `useTextTemplates`/`useObjectiveFromGap` (`store.tsx`) na
 * prática, pelo mesmo formato de `store-scoring-bands.test.tsx`:
 *
 * - fallback: sem `GET /api/v1/config/templates` respondendo, o objetivo é o
 *   default byte-idêntico ao literal pt antigo;
 * - locale ativo: com o app em en, o MESMO gap gera o objetivo em inglês
 *   (era o bug — texto persistido em pt com o app em inglês);
 * - carga: com o endpoint devolvendo um template recalibrado pelo admin
 *   (PUT), o objetivo gerado muda — sem deploy, só dado.
 */
const fetchMock = vi.fn();

const templatesRoute =
  (body: unknown): FetchRoute =>
  (href) =>
    href.endsWith(apiPath("/config/templates")) ? jsonResponse(body) : undefined;

function Probe() {
  const objectiveFromGap = useObjectiveFromGap();
  return <p>{objectiveFromGap({ competencia: "Kubernetes", atual: 1, alvo: 2 })}</p>;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  // `test-setup.ts` pina o app de teste em pt — restaura para os demais arquivos.
  window.localStorage.setItem("synapse:locale", "pt");
});

describe("useObjectiveFromGap (CFG-03)", () => {
  it("fallback em pt: sem templates carregados, objetivo byte-idêntico ao literal antigo", async () => {
    mockAppFetch(fetchMock, { routes: [templatesRoute({})] });
    renderWithApp(<Probe />);
    expect(await screen.findByText("Evoluir Kubernetes do nível 1 para o nível 2")).toBeTruthy();
  });

  it("app em en: o mesmo gap gera o objetivo em inglês (locale ativo decide)", async () => {
    window.localStorage.setItem("synapse:locale", "en");
    mockAppFetch(fetchMock, { routes: [templatesRoute({})] });
    renderWithApp(<Probe />);
    expect(await screen.findByText("Evolve Kubernetes from level 1 to level 2")).toBeTruthy();
  });

  it("template do servidor muda o objetivo gerado: recalibração do admin sem deploy", async () => {
    mockAppFetch(fetchMock, {
      routes: [
        templatesRoute({
          "pdi.objective.fromGap": {
            pt: "Levar {competencia} ao nível {alvo} (hoje {atual})",
          },
        }),
      ],
    });
    renderWithApp(<Probe />);
    expect(await screen.findByText("Levar Kubernetes ao nível 2 (hoje 1)")).toBeTruthy();
  });
});
