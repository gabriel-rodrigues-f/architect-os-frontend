import { cleanup, fireEvent, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouterState: () => "/teams",
    Link: ({
      children,
      to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  };
});

import { AppShell } from "@/components/app/AppShell";
import type { SessionUser } from "@/lib/api";
import { defaultContainer } from "@/lib/gateways/container";
import { NAV_GROUPS, filterNavGroups } from "@/lib/navigation-catalog";
import { ThemeProvider } from "@/lib/theme";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
  fixtureMemberUser,
  fixtureSupportUser,
  fixtureUnassignedTechLeadUser,
} from "../../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * MÉTRICAS DA PLATAFORMA NO MENU — o item que deixou de ser âncora externa.
 *
 * Onda 36 nasceu com um pedido do dono ("para o administrador, quero um menu
 * em administração, entre Times e Usuários, me levando ao grafana") e a
 * resposta de então foi um `<a target="_blank">` para fora do SPA. Em
 * 2026-09-08 o dono mediu o preço disso: "quando estou em Estrutura de Times
 * e clico em Métricas, a seleção continua em Estrutura de Times e vejo os
 * dois selecionados". Âncora externa não muda rota, e sem rota o menu mente
 * sobre onde a pessoa está.
 *
 * Agora o item é ROTA (`/platform-metrics`), como todos os outros — e a aba
 * nova continua existindo, só que reservada NO CLIQUE, porque o navegador só
 * deixa abrir aba durante o gesto.
 */
const destinos = (user: SessionUser | undefined): string[] =>
  filterNavGroups(NAV_GROUPS, user).flatMap((grupo) => grupo.items.map((item) => item.to));

const METRICAS = "/platform-metrics";

describe("menu — as Métricas ficam entre Times e Usuários, para todos menos o member", () => {
  it("o administrador vê as Métricas exatamente entre /teams e /users", () => {
    const caminhos = destinos(fixtureAdminUser);
    const posicao = caminhos.indexOf(METRICAS);
    expect(posicao).toBeGreaterThan(-1);
    expect(caminhos[posicao - 1]).toBe("/teams");
    expect(caminhos[posicao + 1]).toBe("/users");
  });

  /**
   * Adendo do dono (2026-09-08, item 5): "vamos disponibilizar as métricas
   * para os perfis de gerente e tech lead também. O único que não enxerga
   * as métricas passa a ser o membro."
   */
  it("suporte, gerente e tech lead (com ou sem vínculo) também veem; member e sessão nenhuma não", () => {
    expect(destinos(fixtureSupportUser)).toContain(METRICAS);
    expect(destinos(fixtureAssignedManagerUser)).toContain(METRICAS);
    expect(destinos(fixtureAssignedTechLeadUser)).toContain(METRICAS);
    expect(destinos(fixtureUnassignedTechLeadUser)).toContain(METRICAS);
    expect(destinos(fixtureMemberUser)).not.toContain(METRICAS);
    expect(destinos(undefined)).not.toContain(METRICAS);
  });

  it("nenhum item do catálogo abre fora do SPA — a âncora externa morreu", () => {
    const itens = NAV_GROUPS.flatMap((grupo) => grupo.items);
    expect(itens.filter((item) => !item.to.startsWith("/"))).toEqual([]);
    expect(itens.filter((item) => item.opensInNewTab).map((item) => item.to)).toEqual([METRICAS]);
  });
});

describe("menu — as Métricas abrem como rota, e a aba nasce no clique", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { user: fixtureAdminUser });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    defaultContainer.platformMetricsTab.release();
  });

  const abrirACasca = async () => {
    renderWithApp(
      <ThemeProvider>
        <AppShell>
          <div>conteúdo</div>
        </AppShell>
      </ThemeProvider>,
    );
    // Todos os grupos nascem abertos (dono, 2026-09-06): o link já está ao alcance.
    return screen.findAllByRole("link", { name: "Métricas da Plataforma" });
  };

  it("o link aponta para a rota interna, sem `target`, e explica que abre em aba nova", async () => {
    for (const link of await abrirACasca()) {
      expect(link.getAttribute("href")).toBe(METRICAS);
      expect(link.getAttribute("target")).toBeNull();
      expect(link.getAttribute("title")).toMatch(/aba nova/i);
    }
  });

  /**
   * A metade que só o CLIQUE prova: a aba em branco é pedida durante o gesto.
   * Pedida depois — quando a porta responde — ela seria bloqueada como pop-up,
   * e a pessoa ficaria olhando uma tela de transição que nunca entrega nada.
   */
  it("o clique reserva a aba em branco na hora, antes de qualquer resposta da porta", async () => {
    const abrir = vi.fn().mockReturnValue({ closed: false, location: { replace: vi.fn() } });
    vi.stubGlobal("open", abrir);
    const [link] = await abrirACasca();

    expect(abrir).not.toHaveBeenCalled();
    fireEvent.click(link!);

    expect(abrir).toHaveBeenCalledTimes(1);
    expect(abrir.mock.calls[0]?.[0]).toBe("about:blank");
    expect(defaultContainer.platformMetricsTab.isReserved).toBe(true);
  });

  it("clicar em outro item do menu não reserva aba nenhuma", async () => {
    const abrir = vi.fn().mockReturnValue({ closed: false, location: { replace: vi.fn() } });
    vi.stubGlobal("open", abrir);
    await abrirACasca();
    const [times] = await screen.findAllByRole("link", { name: "Estrutura de Times" });

    fireEvent.click(times!);

    expect(abrir).not.toHaveBeenCalled();
  });
});
