import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `architect-profile-fora-do-escopo.test.tsx`: `Route.useParams()` exige árvore montada. */
vi.mock("@tanstack/react-router", () =>
  import("../helpers/ficha-router").then((mod) => mod.reactRouterOfCareerFile()),
);

import { Route as ProfileRoute } from "@/routes/architects.$architectId.index";
import type { AppState } from "@/lib/api";
import { fixtureAssignedManagerUser, fixtureState } from "../helpers/fixtures";
import { mockAppFetch } from "../helpers/render-app";
import { renderCareerFile } from "../helpers/ficha";

/**
 * QA-UX gate 1 (2026-08-29), achado 2 — no card Evidências, quando a mesma
 * pessoa pode revisar E o dono pode corrigir (admin vê os dois), os gatilhos
 * "Revisar" e "Corrigir e reenviar" renderizavam colados, lendo
 * "RevisarCorrigir e reenviar". O invariante: as ações da evidência dividem
 * um contêiner de linha com espaçamento (flex + gap), nunca dois inline
 * soltos no `<li>`. Nasceu VERMELHO contra o layout antigo.
 */
const fetchMock = vi.fn();

const ProfilePage = ProfileRoute.options.component as () => ReactNode;

const stateComEvidenciaDevolvida: AppState = {
  ...fixtureState,
  evidences: [
    {
      ...fixtureState.evidences[0]!,
      status: "Needs Improvement",
      leaderComment: "Falta o contexto da decisão.",
    },
  ],
};

describe("card Evidências — ações lado a lado com espaçamento", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAssignedManagerUser,
      state: stateComEvidenciaDevolvida,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("'Revisar' e 'Corrigir e reenviar' dividem um contêiner flex com gap", async () => {
    renderCareerFile(<ProfilePage />);

    const revisar = await screen.findByRole("button", { name: "Revisar" });
    const corrigir = await screen.findByRole("button", { name: "Corrigir e reenviar" });

    expect(revisar.parentElement).toBe(corrigir.parentElement);
    const wrapper = revisar.parentElement!;
    expect(wrapper.className).toMatch(/\bflex\b/);
    expect(wrapper.className).toMatch(/\bgap-/);
  });
});
