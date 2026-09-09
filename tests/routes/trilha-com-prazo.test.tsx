import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as LearningRoute } from "@/routes/learning-paths";
import type { AppState } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { fixtureAssignedManagerUser, fixtureMemberUser, fixtureState } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * FATIA PRAZOS, item 2 — a trilha com prazo, na tela.
 *
 * Três coisas que só a tela pode provar:
 *
 *  1. o prazo aparece, e ele é de CADA inscrito (conta do ingresso dela);
 *  2. quem estourou o prazo lê "inscrição expirada" e recebe o convite de se
 *     inscrever de novo — e nesse estado o controle de avanço SOME, porque o
 *     backend recusaria a escrita e oferecer o controle seria prometer o que
 *     o servidor nega;
 *  3. quem lidera vê o mesmo estado e pode inscrever a pessoa de novo, mas
 *     continua sem o controle de avanço (item 1 da mesma fatia).
 */
const fetchMock = vi.fn();

const LearningPage = LearningRoute.options.component as () => ReactNode;

/** Ingresso bem no passado: com 30 dias de prazo, a inscrição venceu há anos. */
const INGRESSO_ANTIGO = "2020-01-01T00:00:00.000Z";

const state: AppState = {
  ...fixtureState,
  learningPaths: [
    {
      id: "lp-vencida",
      name: "Trilha vencida",
      description: "",
      competencyIds: [],
      assignedTo: ["ana"],
      enrollments: [{ professionalId: "ana", enrolledAt: INGRESSO_ANTIGO }],
      completionDeadlineDays: 30,
      items: [{ id: "item-1", title: "Curso vencido", type: "Curso", hours: 4 }],
      progress: [{ professionalId: "ana", itemId: "item-1", status: "In Progress", progress: 40 }],
      createdBy: null,
    },
    {
      id: "lp-em-dia",
      name: "Trilha em dia",
      description: "",
      competencyIds: [],
      assignedTo: ["ana"],
      enrollments: [{ professionalId: "ana", enrolledAt: INGRESSO_ANTIGO }],
      completionDeadlineDays: 3650,
      items: [{ id: "item-2", title: "Curso em dia", type: "Curso", hours: 4 }],
      progress: [],
      createdBy: null,
    },
  ],
};

function mockSession(user: typeof fixtureMemberUser | typeof fixtureAssignedManagerUser) {
  mockAppFetch(fetchMock, { user, state });
}

function urlsDeInscricao(): string[] {
  return fetchMock.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === "POST")
    .map(([url]) => String(url))
    .filter((url) => url.includes("/enrollments/"));
}

describe("Trilhas com prazo — o prazo é de cada inscrito", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("a trilha diz o prazo que dá, em dias", async () => {
    mockSession(fixtureMemberUser);
    renderWithApp(<LearningPage />);

    await screen.findByText("Trilha vencida");
    expect(screen.getByText(/prazo de 30 dias/)).toBeTruthy();
    expect(screen.getByText(/prazo de 3650 dias/)).toBeTruthy();
  });

  it("dentro do prazo, a etiqueta da pessoa diz quanto falta", async () => {
    mockSession(fixtureMemberUser);
    renderWithApp(<LearningPage />);

    await screen.findByText("Trilha em dia");
    expect(screen.getByText(/Ana Martins · faltam \d+ dias/)).toBeTruthy();
  });

  it("vencida, a etiqueta diz que a inscrição expirou e convida a pessoa a se inscrever de novo", async () => {
    mockSession(fixtureMemberUser);
    renderWithApp(<LearningPage />);

    await screen.findByText("Trilha vencida");
    expect(screen.getByText(/Ana Martins · inscrição expirada/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Inscrever-se de novo" })).toBeTruthy();
  });

  it("vencida, a pessoa PERDE o controle de avanço — e o mantém na trilha em dia", async () => {
    mockSession(fixtureMemberUser);
    renderWithApp(<LearningPage />);

    await screen.findByText("Trilha vencida");
    fireEvent.click(screen.getByLabelText("Expandir Trilha vencida"));
    await screen.findByText("Curso vencido");
    expect(screen.queryByLabelText("Progresso de Ana Martins em Curso vencido")).toBeNull();

    fireEvent.click(screen.getByLabelText("Expandir Trilha em dia"));
    await screen.findByText("Curso em dia");
    expect(screen.getByLabelText("Progresso de Ana Martins em Curso em dia")).toBeTruthy();
  });

  it("inscrever-se de novo chama a rota de inscrição da própria pessoa", async () => {
    mockSession(fixtureMemberUser);
    renderWithApp(<LearningPage />);

    await screen.findByText("Trilha vencida");
    fireEvent.click(screen.getByRole("button", { name: "Inscrever-se de novo" }));

    await waitFor(() => expect(urlsDeInscricao()).toHaveLength(1));
    expect(urlsDeInscricao()[0]).toContain(apiPath("/learning-paths/lp-vencida/enrollments/ana"));
  });

  it("quem lidera vê o vencimento e inscreve a pessoa de novo — mas não avança por ela", async () => {
    mockSession(fixtureAssignedManagerUser);
    renderWithApp(<LearningPage />);

    await screen.findByText("Trilha vencida");
    expect(screen.getByText(/Ana Martins · inscrição expirada/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Inscrever de novo" })).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Expandir Trilha em dia"));
    await screen.findByText("Curso em dia");
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
  });
});
