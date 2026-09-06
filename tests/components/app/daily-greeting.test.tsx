import { act, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DailyGreeting } from "@/lib/greeting/daily-greeting";
import { DailyGreetingToast } from "@/components/app/DailyGreetingToast";
import {
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
  fixtureMemberUser,
} from "../../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

const fetchMock = vi.fn();

/**
 * Dono (2026-09-06): "mensagens de saudação para o primeiro acesso no dia;
 * somente uma vez no dia, canto superior direito, 3 segundos, com x".
 */
describe("saudação do primeiro acesso do dia", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("gerente: chama pelo primeiro nome e fala do time; some sozinha em 3 segundos", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockAppFetch(fetchMock, { user: { ...fixtureAssignedManagerUser, name: "Gabriela Souza" } });
    renderWithApp(<DailyGreetingToast />);
    const saudacao = await screen.findByTestId("daily-greeting");
    expect(saudacao.textContent).toContain("Olá, Gabriela!");
    expect(saudacao.textContent).toContain("Acompanhe o desenvolvimento do seu time");
    await act(async () => {
      vi.advanceTimersByTime(DailyGreeting.VISIBLE_MS + 50);
    });
    expect(screen.queryByTestId("daily-greeting")).toBeNull();
  });

  it("tech lead e profissional recebem a própria mensagem", async () => {
    mockAppFetch(fetchMock, { user: fixtureAssignedTechLeadUser });
    renderWithApp(<DailyGreetingToast />);
    expect((await screen.findByTestId("daily-greeting")).textContent).toContain(
      "Explore as competências do time",
    );
    cleanup();
    window.localStorage.removeItem(DailyGreeting.STORAGE_KEY);
    mockAppFetch(fetchMock, { user: fixtureMemberUser });
    renderWithApp(<DailyGreetingToast />);
    expect((await screen.findByTestId("daily-greeting")).textContent).toContain(
      "Conheça suas competências",
    );
  });

  it("o x fecha antes do tempo, e no mesmo dia ela não volta", async () => {
    mockAppFetch(fetchMock, { user: fixtureMemberUser });
    renderWithApp(<DailyGreetingToast />);
    await screen.findByTestId("daily-greeting");
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByTestId("daily-greeting")).toBeNull();
    cleanup();
    renderWithApp(<DailyGreetingToast />);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.queryByTestId("daily-greeting")).toBeNull();
    expect(DailyGreeting.isDueFor(fixtureMemberUser)).toBe(false);
  });

  it("no dia seguinte, a marca de ontem não vale", () => {
    const hoje = new Date(2026, 8, 6);
    const amanha = new Date(2026, 8, 7);
    DailyGreeting.markShown(fixtureMemberUser, hoje);
    expect(DailyGreeting.isDueFor(fixtureMemberUser, hoje)).toBe(false);
    expect(DailyGreeting.isDueFor(fixtureMemberUser, amanha)).toBe(true);
  });
});
