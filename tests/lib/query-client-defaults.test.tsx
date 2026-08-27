import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";
import {
  CONFIG_QUERY_STALE_TIME,
  createAppQueryClient,
  DEFAULT_QUERY_STALE_TIME,
} from "@/lib/query-client";
import { useOperationalSettings } from "@/lib/store";
import { jsonResponse, mockAppFetch, type FetchRoute } from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * F2 (caminhos quentes) — o `QueryClient` do app subia sem `defaultOptions`,
 * então toda consulta nascia com `staleTime: 0`: as seis consultas de
 * configuração (níveis de carreira, faixas, templates, política de curadoria,
 * settings operacionais e vocabulários) refaziam a busca a cada navegação e a
 * cada foco de janela, para dados que mudam raramente e que já são
 * invalidados explicitamente por quem os altera (ver `store.tsx`).
 */

const fetchMock = vi.fn();

const settingsRoute: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/config/settings")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse({
        settings: [
          {
            key: "career.minimumQualifiedFloor",
            value: 4,
            valueType: "int",
            scope: "operational",
            description: null,
            updatedAt: "2026-08-26T00:00:00Z",
            updatedBy: null,
          },
        ],
      })
    : undefined;

const countSettingsFetches = () =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith(apiPath("/config/settings"))).length;

/** Consulta sem opção nenhuma: o que ela faz é exatamente o que o default manda. */
function SemOpcoesProbe() {
  const { data } = useQuery({ queryKey: ["consulta-sem-opcoes"], queryFn: api.settings });
  return <p>registros:{data?.settings.length ?? "…"}</p>;
}

function SettingsProbe() {
  const settings = useOperationalSettings();
  return <p>piso:{settings.careerMinimumQualifiedFloor}</p>;
}

const renderWith = (client: QueryClient, ui: ReactNode) =>
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);

describe("defaults do QueryClient do app (F2)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { routes: [settingsRoute] });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("declara staleTime e desliga o refetch ao recuperar o foco da janela", () => {
    const queries = createAppQueryClient().getDefaultOptions().queries;
    expect(DEFAULT_QUERY_STALE_TIME).toBeGreaterThan(0);
    expect(queries?.staleTime).toBe(DEFAULT_QUERY_STALE_TIME);
    expect(queries?.refetchOnWindowFocus).toBe(false);
  });

  it("dado de configuração fica fresco por mais tempo que o padrão do app", () => {
    expect(CONFIG_QUERY_STALE_TIME).toBeGreaterThan(DEFAULT_QUERY_STALE_TIME);
  });

  it("uma consulta sem opções não refaz a busca ao remontar", async () => {
    const client = createAppQueryClient();

    renderWith(client, <SemOpcoesProbe />);
    await screen.findByText("registros:1");
    await waitFor(() => expect(countSettingsFetches()).toBe(1));

    cleanup();
    renderWith(client, <SemOpcoesProbe />);
    await screen.findByText("registros:1");

    // tempo real para um refetch indevido (assíncrono) acontecer antes de afirmar que não houve
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(countSettingsFetches()).toBe(1);
  });

  /** O contraste que justifica o default: sem ele, a mesma remontagem refaz a busca. */
  it("sem os defaults, a mesma remontagem refaria a busca", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderWith(client, <SemOpcoesProbe />);
    await screen.findByText("registros:1");
    await waitFor(() => expect(countSettingsFetches()).toBe(1));

    cleanup();
    renderWith(client, <SemOpcoesProbe />);
    await waitFor(() => expect(countSettingsFetches()).toBe(2));
  });

  it("voltar para uma tela de configuração não refaz a busca das settings", async () => {
    const client = createAppQueryClient();

    renderWith(client, <SettingsProbe />);
    await screen.findByText("piso:4");
    await waitFor(() => expect(countSettingsFetches()).toBe(1));

    cleanup();
    renderWith(client, <SettingsProbe />);
    await screen.findByText("piso:4");

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(countSettingsFetches()).toBe(1);
  });
});
