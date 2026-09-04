import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
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
    createFileRoute:
      (..._args: unknown[]) =>
      (options: Record<string, unknown>) => ({
        ...options,
        options,
        useParams: () => ({ architectId: "ana" }),
      }),
  };
});

import { Route as MentoringRoute } from "@/routes/mentoring";
import { fixtureAdminUser } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * ADR-0093 na tela — O QUE UMA PESSOA ESCREVEU NÃO VIRA FATO APURADO.
 *
 * O backend fechou um P0 de injeção indireta: tema e decisões da 1:1 são texto
 * que alguém DIGITOU, e digitado dentro da lista de fatos ele herdava a
 * garantia que a instrução de sistema dá aos fatos. Saíram de `facts` e
 * passaram a viajar em `written`, rotulados.
 *
 * A conta que sobrou para cá, e é o motivo deste arquivo: o schema desta tela
 * não declarava `written`, e o zod sem `.strict()` DESCARTA em silêncio o que
 * não está declarado. Nada quebrava — sumia conteúdo. E sumia justamente no
 * cenário que o ADR-0087 existe para cobrir: com o provedor no chão, o painel
 * determinístico é tudo o que a pessoa tem, e ele mostrava só a data da última
 * 1:1, sem o tema e sem as decisões — sem o "de onde paramos".
 *
 * Por isso o teste entra pelo FIO e não pelo componente: ele responde a
 * chamada de verdade e mede o que aparece na tela. Medido apagando `written`
 * do `personAdvice` em `src/lib/api-schemas.ts`: os três primeiros casos ficam
 * vermelhos, porque é exatamente esse o defeito que eles descrevem. Um teste
 * que passasse `written` como propriedade do componente continuaria verde com
 * o contrato quebrado, e não teria medido nada.
 *
 * As três afirmações:
 *
 *   1. o texto de gente APARECE, e aparece SEPARADO dos fatos — bloco próprio,
 *      rótulo próprio, e nada dele dentro da lista de fatos apurados;
 *   2. ele aparece ESCAPADO: uma tag digitada no formulário chega como as
 *      letras que ela é, e não como elemento no documento;
 *   3. sem texto de gente (que é o caso dos outros assistentes), a tela desenha
 *      como antes: nenhum título órfão, nenhum espaço morto.
 */
const fetchMock = vi.fn();

const MentoringPage = MentoringRoute.options.component as () => ReactNode;

/** Uma tag digitada no campo de tema, como quem tenta injetar HTML na tela. */
const TEMA_FORJADO =
  "<script data-forjado>window.__forjado = 1</script> retomar a conversa sobre o PDI";

const DECISOES = "Fechar o item de PDI mais antigo até a próxima conversa.";

const FATO = "A última 1:1 aconteceu em 2026-06-01.";

const ROTULO_DO_TEMA = "Tema da última 1:1, escrito por quem conduziu";

const ROTULO_DAS_DECISOES = "Decisões da última 1:1, escritas por quem conduziu";

/**
 * O corpo da preparação de 1:1 COM O PROVEDOR NO CHÃO: `narration` nula e o
 * aviso no lugar dela. É o cenário do ADR-0087, e o que sobra na tela é o
 * determinístico — os fatos apurados e o texto de quem conduziu a conversa.
 */
const preparacao = {
  subject: "preparação da conversa de 1:1 com esta pessoa",
  suggestion: true,
  notice:
    "Isto é uma sugestão gerada por inteligência artificial a partir do que o sistema calculou. Nada foi gravado: quem decide é você.",
  facts: [FATO],
  written: [
    { label: ROTULO_DO_TEMA, text: TEMA_FORJADO },
    { label: ROTULO_DAS_DECISOES, text: DECISOES },
  ],
  absences: [],
  narration: null as string | null,
  narrationUnavailable: "A sugestão em linguagem natural está indisponível no momento.",
};

const rotaDaPreparacao =
  (corpo: unknown): FetchRoute =>
  (href) =>
    href.includes("one-on-one-preparation") ? jsonResponse(corpo) : undefined;

/** Clica em "Preparar a 1:1" e espera a resposta chegar à tela. */
async function preparaA1x1(corpo: unknown): Promise<ReturnType<typeof userEvent.setup>> {
  mockAppFetch(fetchMock, { user: fixtureAdminUser, routes: [rotaDaPreparacao(corpo)] });
  renderWithApp(<MentoringPage />);
  const usuario = userEvent.setup();
  await usuario.click(await screen.findByRole("button", { name: /Preparar a 1:1/ }));
  await screen.findByText(FATO);
  return usuario;
}

/** O bloco de um rótulo: o container que o título e o conteúdo dele dividem. */
function blocoDe(titulo: string): HTMLElement {
  const cabecalho = screen.getByText(titulo);
  const bloco = cabecalho.parentElement;
  if (bloco === null) throw new Error(`o título "${titulo}" saiu sem bloco em volta`);
  return bloco;
}

beforeEach(() => {
  window.localStorage.setItem("synapse:locale", "pt");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("o texto que uma pessoa escreveu, ao lado dos fatos e nunca dentro deles", () => {
  it("com o provedor no chão, o painel mostra os fatos E o que quem conduziu escreveu", async () => {
    await preparaA1x1(preparacao);

    expect(screen.getByText(/está indisponível no momento/)).toBeTruthy();
    expect(screen.getByText(FATO)).toBeTruthy();
    expect(screen.getByText("O que uma pessoa escreveu")).toBeTruthy();
    expect(screen.getByText(ROTULO_DO_TEMA)).toBeTruthy();
    expect(screen.getByText(TEMA_FORJADO)).toBeTruthy();
    expect(screen.getByText(ROTULO_DAS_DECISOES)).toBeTruthy();
    expect(screen.getByText(DECISOES)).toBeTruthy();
  });

  it("o que o sistema calculou e o que alguém digitou ficam em blocos diferentes", async () => {
    await preparaA1x1(preparacao);

    const fatos = blocoDe("O que o sistema calculou");
    const escrito = blocoDe("O que uma pessoa escreveu");

    // A lista de fatos continua tendo SÓ o que o sistema apurou.
    expect(
      within(fatos)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([FATO]);
    expect(within(fatos).queryByText(TEMA_FORJADO)).toBeNull();
    expect(within(fatos).queryByText(DECISOES)).toBeNull();
    // E o bloco do texto de gente não contém fato nenhum.
    expect(within(escrito).queryByText(FATO)).toBeNull();
    expect(escrito.contains(fatos)).toBe(false);
    expect(fatos.contains(escrito)).toBe(false);
  });

  it("uma tag digitada no formulário chega como TEXTO, não como elemento", async () => {
    await preparaA1x1(preparacao);

    // O React escapa o filho de JSX: a marca existe como letra na tela…
    expect(screen.getByText(TEMA_FORJADO).textContent).toContain("<script");
    // …e não como nó no documento. `dangerouslySetInnerHTML` ou um renderizador
    // de markdown no lugar do filho de JSX faria esta linha vermelha.
    expect(document.querySelector("[data-forjado]")).toBeNull();
    expect(document.querySelectorAll("script").length).toBe(0);
    expect((window as unknown as { __forjado?: number }).__forjado).toBeUndefined();
  });

  it("copiar leva o texto de gente junto, marcado como citação e não como fato", async () => {
    const usuario = await preparaA1x1(preparacao);

    await usuario.click(screen.getByRole("button", { name: "Copiar" }));

    const transcricao = await waitFor(async () => {
      const texto = await navigator.clipboard.readText();
      expect(texto).toContain(FATO);
      return texto;
    });
    expect(transcricao).toContain(`* ${FATO}`);
    expect(transcricao).toContain(`> ${ROTULO_DO_TEMA}: ${TEMA_FORJADO}`);
    expect(transcricao).toContain(`> ${ROTULO_DAS_DECISOES}: ${DECISOES}`);
  });
});

describe("sem texto de gente, a tela desenha como antes", () => {
  it("o assistente que não preenche o campo não ganha título órfão", async () => {
    await preparaA1x1({ ...preparacao, written: [] });

    expect(screen.getByText(FATO)).toBeTruthy();
    expect(screen.queryByText("O que uma pessoa escreveu")).toBeNull();
  });

  /**
   * O servidor antigo, que ainda não publica o campo. A tela nova NÃO pode
   * recusar a resposta inteira por isso: seria trocar "sumiu o tema da 1:1"
   * por "o assistente parou de funcionar" durante a subida.
   */
  it("resposta sem o campo continua desenhando o que o sistema calculou", async () => {
    const { written: _written, ...semOCampo } = preparacao;
    await preparaA1x1(semOCampo);

    expect(screen.getByText(FATO)).toBeTruthy();
    expect(screen.getByText(/quem decide é você/)).toBeTruthy();
    expect(screen.queryByText("O que uma pessoa escreveu")).toBeNull();
  });
});
