import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { fixtureMemberUser } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
} from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * CFG-07 (SPEC-OO3-13, §3.2) — "Importar catálogo" na matriz: admin-only,
 * colagem de JSON validada client-side (zod espelhando o backend), PREVIEW
 * do diff por nome ANTES do POST, 400 do backend em role="alert", sucesso →
 * toast + invalidação de /api/v1/state.
 */

const fetchMock = vi.fn();
const MatrixPage = MatrixRoute.options.component as () => ReactNode;

const payload = JSON.stringify({
  capabilities: [
    {
      name: "Cloud Architecture", // já existe na fixture → update
      short: "Cloud",
      competencies: [
        {
          name: "Kubernetes",
          requirementType: "NON_RESTRICTIVE",
          expected: { "arquiteto-de-solucoes-i": 3 },
        },
        {
          name: "FinOps",
          requirementType: "NON_RESTRICTIVE",
          expected: { "arquiteto-de-solucoes-i": 2 },
        },
      ],
    },
    {
      name: "Data Engineering", // nova
      short: "Data",
      competencies: [
        {
          name: "Pipelines",
          requirementType: "RESTRICTIVE",
          expected: { "arquiteto-de-solucoes-i": 2 },
        },
      ],
    },
  ],
});

const countGets = (suffix: string) =>
  fetchMock.mock.calls.filter((call) => {
    const [url, init] = call as [string, RequestInit | undefined];
    return String(url).endsWith(suffix) && ((init as RequestInit)?.method ?? "GET") === "GET";
  }).length;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Importar catálogo (CFG-07)", () => {
  it("não-admin não vê o botão", async () => {
    mockAppFetch(fetchMock, { user: fixtureMemberUser, routes: [careerLevelsRoute] });
    renderWithApp(<MatrixPage />);
    expect(await screen.findByText("Cloud Architecture")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Importar catálogo" })).toBeNull();
  });

  it("JSON inválido mostra o erro client-side e mantém o envio desabilitado", async () => {
    mockAppFetch(fetchMock, { routes: [careerLevelsRoute] });
    renderWithApp(<MatrixPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Importar catálogo" }));
    await userEvent.type(screen.getByLabelText("Ou cole o JSON"), "{{oops");

    expect((await screen.findByRole("alert")).textContent).toBe("O texto não é um JSON válido.");
    expect((screen.getByRole("button", { name: "Importar" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("payload válido mostra o preview do diff por nome ANTES de enviar", async () => {
    mockAppFetch(fetchMock, { routes: [careerLevelsRoute] });
    renderWithApp(<MatrixPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Importar catálogo" }));
    const textarea = screen.getByLabelText("Ou cole o JSON");
    await userEvent.click(textarea);
    await userEvent.paste(payload);

    // Kubernetes já existe em Cloud → atualizar; FinOps e Pipelines → criar;
    // Data Engineering → capacidade nova.
    expect(
      await screen.findByText(
        "Capacidades: 1 a criar, 1 a atualizar · Competências: 2 a criar, 1 a atualizar.",
      ),
    ).toBeTruthy();
    // Nenhum POST ainda — preview é client-side.
    expect(
      fetchMock.mock.calls.some((call) => String(call[0]).endsWith(apiPath("/catalog/import"))),
    ).toBe(false);
  });

  it("enviar faz o POST, mostra o resumo REAL no toast e invalida /api/v1/state; 400 vai para role=alert", async () => {
    mockAppFetch(fetchMock, {
      routes: [
        careerLevelsRoute,
        (href, init) =>
          href.endsWith(apiPath("/catalog/import")) && init?.method === "POST"
            ? jsonResponse({
                capabilitiesCreated: [{ id: "data", name: "Data Engineering" }],
                capabilitiesUpdated: [{ id: "cloud", name: "Cloud Architecture" }],
                competenciesCreated: [
                  { id: "finops", name: "FinOps", capabilityId: "cloud" },
                  { id: "pipelines", name: "Pipelines", capabilityId: "data" },
                ],
                competenciesUpdated: [
                  { id: "cloud-k8s", name: "Kubernetes", capabilityId: "cloud" },
                ],
              })
            : undefined,
      ],
    });
    renderWithApp(<MatrixPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Importar catálogo" }));
    const textarea = screen.getByLabelText("Ou cole o JSON");
    await userEvent.click(textarea);
    await userEvent.paste(payload);
    const stateGetsBefore = countGets(apiPath("/state"));
    await userEvent.click(screen.getByRole("button", { name: "Importar" }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find((call) => {
        const [url, init] = call as [string, RequestInit | undefined];
        return String(url).endsWith(apiPath("/catalog/import")) && init?.method === "POST";
      });
      expect(post).toBeTruthy();
      expect(JSON.parse(String((post![1] as RequestInit).body))).toEqual(JSON.parse(payload));
    });
    await waitFor(() => {
      expect(countGets(apiPath("/state"))).toBeGreaterThan(stateGetsBefore);
    });
  });

  it("400 do backend aparece em role=alert e o diálogo continua aberto", async () => {
    mockAppFetch(fetchMock, {
      routes: [
        careerLevelsRoute,
        (href, init) =>
          href.endsWith(apiPath("/catalog/import")) && init?.method === "POST"
            ? jsonResponse({ message: "Nível de carreira desconhecido em expected: n9" }, 400)
            : undefined,
      ],
    });
    renderWithApp(<MatrixPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Importar catálogo" }));
    const textarea = screen.getByLabelText("Ou cole o JSON");
    await userEvent.click(textarea);
    await userEvent.paste(payload);
    await userEvent.click(screen.getByRole("button", { name: "Importar" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Nível de carreira desconhecido");
    expect(screen.getByRole("button", { name: "Importar" })).toBeTruthy();
  });
});
