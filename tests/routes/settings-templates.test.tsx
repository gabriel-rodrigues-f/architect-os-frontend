import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as SettingsRoute } from "@/routes/settings";
import { fixtureMemberUser } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * CFG-03 (SPEC-OO3-13, §3.2) — aba "Textos" de /settings: admin-only,
 * variáveis da key exibidas, preview vivo pelo interpolador do app,
 * PUT /api/v1/config/templates/:key/:locale com invalidação ao sucesso e 400
 * INVALID_TEXT_TEMPLATE do backend exibido no formulário (role="alert").
 */

const fetchMock = vi.fn();
const SettingsPage = SettingsRoute.options.component as () => ReactNode;

/** GET /api/v1/config/templates vazio (a UI completa com o default do seed pt/en). */
const emptyTemplatesGetRoute: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/config/templates")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse({})
    : undefined;

const countTemplatesGets = () =>
  fetchMock.mock.calls.filter((call) => {
    const [url, init] = call as [string, RequestInit | undefined];
    return String(url).endsWith(apiPath("/config/templates")) && (init?.method ?? "GET") === "GET";
  }).length;

/** O bloco do locale `pt` dentro da seção "Textos". */
async function ptLocaleBlock(): Promise<HTMLElement> {
  const section = (await screen.findByText("Objetivo de item de PDI a partir de gap")).closest(
    "div.surface-inset",
  ) as HTMLElement;
  const badge = within(section)
    .getAllByText("pt")
    .find((el) => el.tagName === "SPAN")!;
  return badge.closest("div.rounded-md.border") as HTMLElement;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Textos (CFG-03 admin UI)", () => {
  it("não-admin não vê a seção", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureMemberUser,
      routes: [careerLevelsRoute, emptyTemplatesGetRoute],
    });
    renderWithApp(<SettingsPage />);
    expect(await screen.findByText("Referência do modelo")).toBeTruthy();
    expect(screen.queryByText("Objetivo de item de PDI a partir de gap")).toBeNull();
    expect(screen.queryByText("Variáveis disponíveis")).toBeNull();
  });

  it("mostra as variáveis da key e o preview interpolado com valores de exemplo", async () => {
    mockAppFetch(fetchMock, { routes: [careerLevelsRoute, emptyTemplatesGetRoute] });
    renderWithApp(<SettingsPage />);

    expect(await screen.findByText("{competencia}")).toBeTruthy();
    expect(screen.getByText("{atual}")).toBeTruthy();
    expect(screen.getByText("{alvo}")).toBeTruthy();

    const block = await ptLocaleBlock();
    expect(
      within(block).getByText("Evoluir Arquitetura de Integração do nível 2 para o nível 4"),
    ).toBeTruthy();
  });

  it("o preview reage à edição do template (mesmo interpolador, valores de exemplo)", async () => {
    mockAppFetch(fetchMock, { routes: [careerLevelsRoute, emptyTemplatesGetRoute] });
    renderWithApp(<SettingsPage />);

    const block = await ptLocaleBlock();
    await userEvent.click(within(block).getByRole("button", { name: "Editar" }));

    const textarea = within(block).getByLabelText("Template (pt)");
    await userEvent.clear(textarea);
    // `{{` é o escape de `{` no user-event; `}` é literal.
    await userEvent.type(textarea, "Levar {{competencia} de {{atual} a {{alvo}");

    expect(within(block).getByText("Levar Arquitetura de Integração de 2 a 4")).toBeTruthy();
  });

  it("salvar envia o PUT do key/locale com o texto novo e invalida a query de templates", async () => {
    mockAppFetch(fetchMock, {
      routes: [
        careerLevelsRoute,
        (href, init) =>
          href.endsWith(apiPath("/config/templates/pdi.objective.fromGap/pt")) &&
          init?.method === "PUT"
            ? jsonResponse({
                key: "pdi.objective.fromGap",
                locale: "pt",
                template: (JSON.parse(String(init.body)) as { template: string }).template,
              })
            : undefined,
        emptyTemplatesGetRoute,
      ],
    });
    renderWithApp(<SettingsPage />);

    const block = await ptLocaleBlock();
    const getsBefore = countTemplatesGets();
    await userEvent.click(within(block).getByRole("button", { name: "Editar" }));

    const textarea = within(block).getByLabelText("Template (pt)");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Subir {{competencia} para o nível {{alvo}");
    await userEvent.click(within(block).getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const put = fetchMock.mock.calls.find((call) => {
        const [url, init] = call as [string, RequestInit | undefined];
        return (
          String(url).endsWith(apiPath("/config/templates/pdi.objective.fromGap/pt")) &&
          init?.method === "PUT"
        );
      });
      expect(put).toBeTruthy();
      expect(JSON.parse(String((put![1] as RequestInit).body))).toEqual({
        template: "Subir {competencia} para o nível {alvo}",
      });
    });

    // Invalidação ao sucesso: a query ativa de templates refaz o GET.
    await waitFor(() => {
      expect(countTemplatesGets()).toBeGreaterThan(getsBefore);
    });
  });

  it("400 INVALID_TEXT_TEMPLATE do backend aparece no formulário (role=alert)", async () => {
    mockAppFetch(fetchMock, {
      routes: [
        careerLevelsRoute,
        (href, init) =>
          href.endsWith(apiPath("/config/templates/pdi.objective.fromGap/pt")) &&
          init?.method === "PUT"
            ? jsonResponse(
                { code: "INVALID_TEXT_TEMPLATE", message: "Template não pode ser vazio." },
                400,
              )
            : undefined,
        emptyTemplatesGetRoute,
      ],
    });
    renderWithApp(<SettingsPage />);

    const block = await ptLocaleBlock();
    await userEvent.click(within(block).getByRole("button", { name: "Editar" }));
    await userEvent.click(within(block).getByRole("button", { name: "Salvar" }));

    const alert = await within(block).findByRole("alert");
    expect(alert.textContent).toBe("Template não pode ser vazio.");
  });
});
