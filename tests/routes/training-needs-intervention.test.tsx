import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de team-deactivate.test.tsx: `<Link>` exige RouterProvider real. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to: _to, ...rest }: ComponentProps<"a"> & { to?: string }) => (
      <a {...rest}>{children}</a>
    ),
  };
});

import { Route as TrainingNeedsRoute } from "@/routes/training-needs";
import { type AppState, type SessionUser } from "@/lib/api";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import { configurationRoute, contextsOf, hrefOf, renderWithApp } from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * EPIC K — Collective Intervention: "Treinamentos Recomendados" era relatório
 * estático. A lacuna coletiva (3+ pessoas) agora vira uma trilha de verdade,
 * atribuída exatamente a quem tem a lacuna — não um número solto.
 */

const fetchMock = vi.fn();

/** Terceira pessoa com a mesma lacuna de segurança que ana e bruno já têm na fixture. */
const carla: AppState["architects"][number] = {
  id: "carla",
  name: "Carla Souza",
  role: "Pleno",
  yearsAsArchitect: 5,
  specialization: "Segurança",
  email: "carla@company.com",
  active: true,
  version: 1,
};

const state: AppState = {
  ...fixtureState,
  architects: [...fixtureState.architects, carla],
  // Sem trilha nenhuma de partida: a fixture padrão já tem uma para
  // security-iam, o que esconderia o botão de criação neste teste.
  learningPaths: [],
  assessments: [
    ...fixtureState.assessments,
    {
      id: "carla-h2",
      architectId: "carla",
      cycleId: "2026-h2",
      status: "Completed",
      modelVersion: 1,
      targetCareerLevelId: null,
      targetSemantics: null,
      version: 1,
      items: [
        { competencyId: "cloud-k8s", self: 4, leader: 4, target: 4, final: 4, comments: [] },
        { competencyId: "cloud-serverless", self: 4, leader: 4, target: 4, final: 4, comments: [] },
        { competencyId: "security-iam", self: 1, leader: 1, target: 3, final: 1, comments: [] },
      ],
    },
  ],
};

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const TrainingNeedsPage = TrainingNeedsRoute.options.component as () => ReactNode;

describe("Necessidades de Treinamento — criar intervenção coletiva", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockImplementation((input: string | URL | Request, init?: RequestInit) => {
      const url = hrefOf(input);
      const href = String(url);
      if (href.endsWith(apiPath("/auth/me"))) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureAdminUser satisfies SessionUser), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      const fatia = contextsOf(state)(href, init);
      if (fatia) return Promise.resolve(fatia);
      if (init?.method === "POST" && href.endsWith(apiPath("/learning-paths"))) {
        // O servidor gera o id de verdade e devolve o recurso completo — a
        // store não insere mais o objeto local otimista (ver AUDITORIA-
        // QUINTA-RODADA-360-SYNAPSE-2026-08-19.md, IDOR-001/EVD-001).
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...body,
              id: "lp-intervencao-criada",
              createdAt: new Date().toISOString(),
            }),
            { status: 201, headers: { "content-type": "application/json" } },
          ),
        );
      }
      const configuration = configurationRoute(href, init);
      if (configuration) return Promise.resolve(configuration);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("com 3 pessoas na mesma lacuna, cria trilha atribuída a elas — não a um número solto", async () => {
    renderWithApp(<TrainingNeedsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Criar trilha coletiva/ }));

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith(apiPath("/learning-paths")) && init?.method === "POST",
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse(String(postCall?.[1]?.body)) as {
      competencyIds: string[];
      assignedTo: string[];
    };
    expect(body.competencyIds).toEqual(["security-iam"]);
    expect(body.assignedTo.sort()).toEqual(["ana", "bruno", "carla"]);
  });

  it("depois de criada, mostra 'Ver trilha criada' em vez de oferecer criar de novo", async () => {
    renderWithApp(<TrainingNeedsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Criar trilha coletiva/ }));
    // Sem otimismo: a tela só reflete a trilha nova depois que o servidor confirma.
    expect(await screen.findByText("Ver trilha criada")).toBeTruthy();
  });
});
