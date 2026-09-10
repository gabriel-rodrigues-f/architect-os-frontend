import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MentoringRoute } from "@/routes/mentoring";
import { Route as PlansRoute } from "@/routes/development-plans";
import { apiPath } from "@/lib/api-path";
import { fixtureAssignedManagerUser } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * A IA SAI DA MENTORIA E 1:1 (dono, 2026-09-09) — *"Em Mentoria e 1:1, pode
 * remover a parte da IA, não é útil. Mantenha somente o bloco Linha do
 * Tempo. Remova tudo relacionado a geração da IA desta página: front, back,
 * modelo, banco."*
 *
 * Isto reverte o pedido do MESMO dia que mandava manter a "Preparação do
 * 1:1" — o mais recente vence, e os comentários de 07/09 e 09/09 espalhados
 * pelo código dizem o contrário porque são de antes.
 *
 * A ARMADILHA QUE ESTE ARQUIVO EVITA, e é a razão do seu formato: um teste
 * de remoção que monta a tela contra um servidor que não responde nada fica
 * VERDE mesmo depois de alguém devolver o botão — ele não teria como
 * distinguir "o bloco não existe" de "o bloco existe e não achou o que
 * desenhar". Por isso o `fetch` DESTE arquivo responde a preparação inteira,
 * com narração, fatos e selo, e o usuário é uma gerente que LIDERA a pessoa
 * selecionada. Todo o combustível do bloco removido está no fixture: se a
 * `ProfiledAdviceSection` voltar para `mentoring.tsx`, ela terá tudo de que
 * precisa para aparecer — e as três asserções abaixo ficam vermelhas.
 */
const fetchMock = vi.fn();

const MentoringPage = MentoringRoute.options.component as () => ReactNode;
const PlansPage = PlansRoute.options.component as () => ReactNode;

const conselho = {
  subject: "preparação do 1:1 com Ana Martins",
  suggestion: true,
  notice: "Isto é uma sugestão gerada por inteligência artificial. Quem decide é você.",
  facts: ["Distância 2 em Domain Modeling", "Última 1:1 há 40 dias"],
  written: [],
  absences: [],
  narration: "Comece perguntando a Ana Martins o que travou o item de PDI.",
  narrationUnavailable: null,
  profile: "moderate",
};

/** O servidor de antes, inteiro — inclusive o selo que virava sessão salva. */
const preparacaoRoute: FetchRoute = (href) =>
  new URL(href, "http://localhost").pathname.includes("one-on-one-preparation")
    ? jsonResponse({ ...conselho, scriptProvenance: "selo-opaco" })
    : undefined;

/** O roteiro de PDI, que NÃO é desta tela e continua vivo (ADR-0087, 0092 §5). */
const roteiroDePdiRoute: FetchRoute = (href) =>
  new URL(href, "http://localhost").pathname.includes("session-script")
    ? jsonResponse({
        ...conselho,
        subject: "roteiro da conversa de construção do PDI desta pessoa",
        outline: ["Distâncias a discutir", "Prioridade sugerida"],
      })
    : undefined;

const chamadasDeIa = (): string[] =>
  fetchMock.mock.calls
    .map((chamada) => new URL(String(chamada[0]), "http://localhost").pathname)
    .filter((pathname) => pathname.includes("one-on-one-preparation"));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, {
    user: fixtureAssignedManagerUser,
    routes: [preparacaoRoute, roteiroDePdiRoute],
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Mentoria e 1:1 fica só com a Linha do Tempo", () => {
  it("não oferece o botão de preparar o 1:1 nem o seletor de perfil de geração", async () => {
    renderWithApp(<MentoringPage />);

    // A tela chegou: a Linha do Tempo é o que o dono mandou manter.
    expect(await screen.findByText(/Linha do tempo/i)).toBeTruthy();

    expect(screen.queryByRole("button", { name: /Preparar o 1:1/ })).toBeNull();
    expect(screen.queryByText(/Perfil de geração/i)).toBeNull();
    expect(screen.queryByTestId("one-on-one-preparation")).toBeNull();
    expect(screen.queryByText(/Preparação do 1:1/i)).toBeNull();
  });

  /**
   * Trocar de pessoa era o gesto que o bug de 2026-09-08 media, e é o gesto
   * que remonta o cartão: a asserção do BOTÃO tem de vir depois da troca,
   * senão ela só repete o que o primeiro caso já disse. A contagem de
   * chamadas vem junto porque a tela também não pode pedir nada sozinha.
   */
  it("nem depois de trocar de pessoa o cartão de IA aparece, e nada é pedido ao provedor", async () => {
    renderWithApp(<MentoringPage />);
    await screen.findByText(/Linha do tempo/i);

    await userEvent.click(screen.getByRole("combobox", { name: "Filtrar mentorado" }));
    await userEvent.click(await screen.findByText("Bruno Almeida"));

    expect(screen.queryByRole("button", { name: /Preparar o 1:1/ })).toBeNull();
    expect(screen.queryByText(/Preparação do 1:1/i)).toBeNull();
    expect(chamadasDeIa()).toEqual([]);
  });

  /**
   * A FRONTEIRA, escrita: o roteiro de PDI mora no Plano de Desenvolvimento
   * Individual desde 2026-09-07, é outra tela e outro menu, e o dono não
   * pediu a remoção dele. Sem esta asserção, a próxima leitura desta catraca
   * entenderia "a IA saiu" como "a IA saiu de todo lugar".
   */
  it("o roteiro de PDI, que é de outra tela, continua de pé", async () => {
    renderWithApp(<PlansPage />);

    expect(await screen.findByRole("button", { name: /Gerar roteiro de PDI/ })).toBeTruthy();
    expect(fetchMock.mock.calls.map((chamada) => String(chamada[0]))).not.toContain(
      apiPath("/professionals/ana/one-on-one-preparation"),
    );
  });
});
