import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mesmo motivo de app-shell-sidebar-toggle.test.tsx: `<Link>`/`useRouterState`
 * exigem `RouterProvider` real. `routerState` é `vi.hoisted` (não um `let`
 * comum) porque a fábrica de `vi.mock` é hoisted pro topo do módulo — sem
 * isto, o mock veria um valor `undefined` no momento em que é definido.
 * Existir como objeto mutável (não uma constante fixa como nos outros
 * testes deste arquivo antes desta correção) é o que permite simular
 * "navegar para outra rota" entre testes: o bug real corrigido aqui só
 * aparece quando o item ATIVO muda, não com a rota sempre fixa em "/".
 */
const routerState = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouterState: () => routerState.pathname,
    Link: ({
      children,
      to: _to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a {...rest}>{children}</a>
    ),
  };
});

import { AppShell } from "@/components/app/AppShell";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { ThemeProvider } from "../theme";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * R2-UX-14 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — seções do menu viram
 * colapsáveis: cabeçalho vira botão com `aria-expanded`, persiste em
 * `synapse:nav-collapsed-groups`.
 *
 * Feedback ao vivo do product owner (Bloco 7) corrigiu dois bugs reais em
 * sequência aqui, o segundo causado pela correção do primeiro:
 *
 * 1. O grupo da rota ativa não podia ser recolhido de verdade
 *    (`isGroupExpanded` forçava aberto).
 * 2. A primeira tentativa de corrigir (1) extraía o item ativo pra um
 *    "slot fixo" acima de um bloco animado com o resto — só que isso
 *    REORDENAVA a lista toda vez que o item ativo mudava, mesmo com o
 *    grupo EXPANDIDO (clicar em "Painel" fazia ele saltar pro topo de
 *    "Operação" e "Time" ocupar o lugar de onde "Painel" tinha saído).
 *    Reportado pelo usuário, nunca coberto por teste — o teste anterior só
 *    verificava o cenário de RECOLHER o grupo ativo, nunca "trocar de
 *    página dentro do grupo enquanto ele está expandido".
 *
 * A correção final (`isNavItemHiddenByCollapse`) nunca reordena: cada
 * item recolhe individualmente, no próprio lugar da lista declarada em
 * `NAV_GROUPS` — não existe mais nenhum "slot fixo" separado. O teste
 * "trocar a rota ativa não reordena o grupo expandido" abaixo é
 * exatamente o que teria pego o bug (2) antes de ele ser reportado como
 * concluído.
 */
const fetchMock = vi.fn();
const STORAGE_KEY = "synapse:nav-collapsed-groups";

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <AuthReady>
              <StoreProvider>{children}</StoreProvider>
            </AuthReady>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function AuthReady({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  if (loading) return null;
  return <>{children}</>;
}

describe("AppShell — seções colapsáveis do menu (R2-UX-14)", () => {
  beforeEach(() => {
    routerState.pathname = "/";
    window.localStorage.clear();
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((url: string) => {
      const href = String(url);
      if (href.endsWith("/api/auth/me")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureAdminUser), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (href.endsWith("/api/state")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureState), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const renderShell = () =>
    render(
      <Wrapper>
        <AppShell>
          <div>conteúdo</div>
        </AppShell>
      </Wrapper>,
    );

  it("clicar no cabeçalho de 'Desenvolvimento' colapsa o grupo e persiste no localStorage", async () => {
    renderShell();
    const user = userEvent.setup();

    const header = await screen.findByRole("button", { name: "Desenvolvimento" });
    expect(header.getAttribute("aria-expanded")).toBe("true");
    // `<Link>` mockado não define `href`, então não ganha role="link" implícito — verifica pelo texto.
    expect(screen.getByText("Mentoria")).toBeTruthy();

    await user.click(header);

    expect(header.getAttribute("aria-expanded")).toBe("false");
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as string[];
    expect(saved).toContain("nav.group.development");
  });

  /**
   * Este repo não tem `@testing-library/jest-dom` instalado (nenhum teste
   * da suíte usa `toBeVisible()`/`toBeInTheDocument()`), então a asserção
   * de "escondido" não pode se apoiar num matcher de visibilidade — lê-se
   * o `style.gridTemplateRows` do wrapper de CADA item (0fr = recolhido,
   * 1fr = aberto), o mesmo mecanismo que a animação usa em produção.
   */
  it("colapsar o grupo da rota ativa ('Operação') some com os irmãos e mantém só 'Painel' visível, sem reordenar", async () => {
    renderShell();
    const user = userEvent.setup();

    const header = await screen.findByRole("button", { name: "Operação" });
    expect(header.getAttribute("aria-expanded")).toBe("true");

    const panelId = header.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId!)!;
    const wrapperOf = (label: string) =>
      [...panel.children].find((el) => el.textContent?.includes(label)) as HTMLElement | undefined;

    expect(wrapperOf("Painel")?.style.gridTemplateRows).toBe("1fr");
    expect(wrapperOf("Time")?.style.gridTemplateRows).toBe("1fr");

    await user.click(header);

    expect(header.getAttribute("aria-expanded")).toBe("false");
    // Painel (rota ativa) continua no próprio lugar, nunca some.
    expect(wrapperOf("Painel")?.style.gridTemplateRows).toBe("1fr");
    // "Time"/"Avaliações" recolhem cada um no próprio wrapper — mesmos nós
    // DOM continuam montados (garante a animação suave), só a altura muda.
    expect(wrapperOf("Time")?.style.gridTemplateRows).toBe("0fr");
    // Ordem no DOM não muda: Painel continua antes de Time, como declarado
    // em NAV_GROUPS — nada foi extraído pra um slot separado.
    const order = [...panel.children].map((el) => el.textContent);
    expect(order.indexOf(wrapperOf("Painel")!.textContent!)).toBeLessThan(
      order.indexOf(wrapperOf("Time")!.textContent!),
    );
  });

  /**
   * Este é o teste que teria pego o bug reportado ao vivo: a primeira
   * correção do colapso reordenava a lista sempre que o item ativo mudava,
   * mesmo com o grupo EXPANDIDO (nunca recolhido) — "Painel" saltava pro
   * topo de "Operação" e "Time" ocupava o lugar de onde ele tinha saído.
   * Com a rota ativa em "/team" (Time, não Painel), o grupo "Operação"
   * continua expandido (nunca foi recolhido nesta suíte) — a ordem no DOM
   * tem que continuar EXATAMENTE a declarada em `NAV_GROUPS`
   * (Painel, Time, Avaliações), não reordenada por quem está ativo.
   */
  it("trocar a rota ativa não reordena o grupo expandido", async () => {
    routerState.pathname = "/team";
    renderShell();

    const header = await screen.findByRole("button", { name: "Operação" });
    expect(header.getAttribute("aria-expanded")).toBe("true");

    const panelId = header.getAttribute("aria-controls");
    const panel = document.getElementById(panelId!)!;
    const labels = [...panel.children].map((el) => {
      if (el.textContent?.includes("Painel")) return "Painel";
      if (el.textContent?.includes("Avaliações")) return "Avaliações";
      if (el.textContent?.includes("Time")) return "Time";
      return el.textContent;
    });

    expect(labels).toEqual(["Painel", "Time", "Avaliações"]);
  });

  it("nasce com a preferência salva: grupo previamente colapsado carrega já fechado", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(["nav.group.admin"]));
    renderShell();

    const header = await screen.findByRole("button", { name: "Administração" });
    expect(header.getAttribute("aria-expanded")).toBe("false");
  });

  it("mesmo comportamento no drawer mobile", async () => {
    renderShell();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Abrir menu de navegação" }));
    const drawer = await screen.findByRole("dialog");
    const header = within(drawer).getByRole("button", { name: "Desenvolvimento" });
    expect(header.getAttribute("aria-expanded")).toBe("true");

    await user.click(header);

    expect(header.getAttribute("aria-expanded")).toBe("false");
  });
});
