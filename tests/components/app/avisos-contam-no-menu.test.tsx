import { cleanup, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `app-shell-sidebar-toggle.test.tsx`: `<Link>` e `useRouterState` exigem router real. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouterState: () => "/",
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
import { apiPath } from "@/lib/api-path";
import { ThemeProvider } from "@/lib/theme";
import { fixtureAdminUser } from "../../helpers/fixtures";
import {
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../../helpers/render-app";

/**
 * O NÚMERO DOS AVISOS MUDOU DE CASA (dono, 2026-09-10, com captura): *"Vamos
 * remover também o ícone de notificações. Agora o próprio Central do Usuário →
 * Avisos deve contabilizar, com um número bem ao lado, conforme o print."*
 *
 * A contagem NÃO é nova e não nasce na tela: é o `unreadCount` que o servidor
 * devolve com a caixa, o mesmo que o sino lia. E o selo não é novo tampouco —
 * é o mesmo do item Talentos do Time, que já carrega as transferências a
 * aprovar (dono, 2026-09-06). Um segundo caminho para qualquer uma das duas
 * coisas seria uma segunda verdade.
 */
const fetchMock = vi.fn();

const caixaDoServidor =
  (unreadCount: number): FetchRoute =>
  (href, init) =>
    href.includes(apiPath("/notices")) && (init?.method ?? "GET").toUpperCase() === "GET"
      ? jsonResponse({ notices: [], unreadCount })
      : undefined;

const caixaQueFalha: FetchRoute = (href) =>
  href.includes(apiPath("/notices"))
    ? jsonResponse({ code: "INTERNAL", message: "x" }, 500)
    : undefined;

const montaColuna = (rota: FetchRoute) => {
  window.localStorage.clear();
  window.localStorage.setItem("synapse:locale", "pt");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, { user: fixtureAdminUser, routes: [rota] });
  renderWithApp(
    <ThemeProvider>
      <AppShell>
        <div>conteúdo</div>
      </AppShell>
    </ThemeProvider>,
  );
};

/**
 * O item do menu pelo NOME ACESSÍVEL, e DENTRO da coluna: neste arquivo o
 * `Link` do roteador é trocado por um `<a>` sem `href` (o mesmo mock dos
 * outros testes de casca), e âncora sem destino não tem papel de link. O
 * recorte pela coluna importa porque "Avisos" também nomeia o aviso de
 * boas-vindas que aparece por cima — sem ele o teste vira uma corrida.
 */
const itemDeAvisos = async () => {
  const coluna = await waitFor(
    () => {
      const aside = document.querySelector("aside");
      expect(aside).toBeTruthy();
      return aside as HTMLElement;
    },
    { timeout: 2000 },
  );
  return await within(coluna).findByLabelText("Avisos", {}, { timeout: 1500 });
};

/**
 * A leitura da caixa já ACONTECEU — sem isto, "o item não tem selo" passaria
 * verde só porque a resposta ainda não chegou, e o teste não provaria nada.
 * O teto é curto de propósito (a casa espera 5 s, o mesmo do teste).
 */
const aCaixaJaFoiLida = async () => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/notices"))).toBe(true);
};

describe("Central do Usuário → Avisos conta os não lidos no próprio item de menu", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("o número do servidor aparece ao lado do rótulo, e diz o que conta", async () => {
    montaColuna(caixaDoServidor(7));
    const item = await itemDeAvisos();
    // A espera é CURTA de propósito: a casa configura `asyncUtilTimeout` em
    // 5 s, que é o mesmo teto do teste — uma busca que falha estoura o teste
    // por tempo e engole a mensagem. Com o teto próprio, o vermelho diz o que
    // não achou.
    const selo = await within(item).findByText("7", {}, { timeout: 1500 });
    expect(selo.getAttribute("aria-label")).toBe("7 não lido(s)");
  });

  it("com a caixa em dia, o item não carrega selo nenhum — zero não se anuncia", async () => {
    montaColuna(caixaDoServidor(0));
    const item = await itemDeAvisos();
    await aCaixaJaFoiLida();
    expect(item.textContent).toBe("Avisos");
  });

  it("sem contagem do servidor o menu não inventa número", async () => {
    montaColuna(caixaQueFalha);
    const item = await itemDeAvisos();
    await aCaixaJaFoiLida();
    expect(item.textContent).toBe("Avisos");
  });

  it("passar de 99 não estica a coluna: o selo diz 99+ e o rótulo, o número inteiro", async () => {
    montaColuna(caixaDoServidor(120));
    const item = await itemDeAvisos();
    const selo = await within(item).findByText("99+", {}, { timeout: 1500 });
    expect(selo.getAttribute("aria-label")).toBe("120 não lido(s)");
  });
});
