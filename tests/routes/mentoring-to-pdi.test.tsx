import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MentoringTimeline } from "@/components/app/mentoring-shared";
import { Route as MentoringRoute } from "@/routes/mentoring";
import { type AppState, type SessionUser } from "@/lib/api";
import { type ContextScopeRequest, SELECTOR_CONTEXTS } from "@/lib/context-scope";
import type { MentoringSession } from "@/lib/domain";
import { fixtureState } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * A 1:1 NÃO MANDA MAIS NADA PARA O PDI.
 *
 * Dono, 2026-09-09: *"não quero mais vinculo aqui com PDI."* Este arquivo era
 * o inverso: media que o botão "Criar ação no PDI" aparecia na sessão com
 * competência já avaliada e que o clique chamava `/items/from-gap`. Ele foi
 * INVERTIDO em vez de apagado, pelo mesmo motivo que
 * `a-evidencia-saiu-do-produto.test.ts` existe — o lugar onde a decisão volta
 * a ser tomada, à vista, se alguém religar o botão.
 *
 * A rota `POST /plans/:id/items/from-gap` continua viva: quem a chama agora é
 * só a tela de PDI (`development-plans-view-model.ts`). O que fechou foi a
 * porta da 1:1.
 *
 * A sessão da fixture é a mesma de antes, e ISSO É O MECANISMO: ela ainda
 * grava `competencyIds`, `decisions` e `actions`, campos que não existem mais
 * no produto. O botão antigo só nascia com os três presentes (`actions` &&
 * competência da sessão com lacuna avaliada e fora do plano) — sobre uma
 * sessão que só tem `notes`, o código antigo restaurado não desenharia botão
 * nenhum e este arquivo ficaria VERDE diante da regressão que ele diz
 * guardar. `cloud-k8s` tem gap avaliado em `bruno-h2` (final 2, alvo 3) e a
 * sessão tem `nextSession`: é exatamente o caso em que o botão aparecia.
 *
 * Os três campos são podados hoje pelo schema da fronteira (`api-schemas.ts`)
 * antes de chegarem à tela. Por isso são DOIS níveis aqui, e o segundo não é
 * repetição do primeiro: pela ROTA, a poda do schema é parte da defesa (o
 * botão de volta no componente, sozinho, não teria com que aparecer); pelo
 * COMPONENTE, a linha do tempo recebe a sessão pronta, com os campos, e é aí
 * que o botão religado no `MentoringTimelineItem` fica vermelho sem depender
 * de mais nada.
 */

const fetchMock = vi.fn();

const usuario: SessionUser = {
  id: "u1",
  email: "gabriel@company.com",
  name: "Gabriel Rodrigues",
  role: "admin",
  professionalId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
};

/** A sessão COMO ELA ERA — com os três campos que morreram, escritos de propósito. */
type SessaoComOsCamposMortos = MentoringSession & {
  competencyIds: string[];
  decisions: string;
  actions: string;
};

const sessaoComGap: SessaoComOsCamposMortos = {
  id: "m-com-gap",
  mentor: "Gabriel Rodrigues",
  menteeId: "bruno",
  date: "2026-08-01",
  durationMin: 60,
  topic: "Aprofundar Kubernetes",
  notes: "Revisamos operadores customizados.",
  competencyIds: ["cloud-k8s"],
  decisions: "Vai propor um PoC de operador.",
  actions: "Escrever o operador de exemplo até a próxima sessão.",
  nextSession: "2026-09-15",
};

const state: AppState = {
  ...fixtureState,
  mentoringSessions: [sessaoComGap],
};

const MentoringPage = MentoringRoute.options.component as () => ReactNode;

/** As mesmas fatias que a rota /mentoring pede da loja. */
const CONTEXTOS_DA_LINHA_DO_TEMPO: readonly ContextScopeRequest[] = [
  ...SELECTOR_CONTEXTS,
  "mentoringSessions",
];

/**
 * O filtro da linha do tempo nasce sempre na primeira pessoa ativa em ordem
 * alfabética; como a fixture também tem "Ana Martins" no roster, as sessões de
 * "bruno" só aparecem depois de selecionar Bruno Almeida no combobox.
 */
async function selectMentee(name: string) {
  await userEvent.click(await screen.findByRole("combobox", { name: "Filtrar mentorado" }));
  await userEvent.click(await screen.findByText(name));
}

describe("Mentoria — o vínculo com o PDI saiu da 1:1 (dono, 2026-09-09)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    mockAppFetch(fetchMock, {
      user: usuario,
      state,
      routes: [
        (href, init) =>
          init?.method === "POST" && href.includes(apiPath("/plans/"))
            ? new Response("{}", { status: 201 })
            : undefined,
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("a linha do tempo não tem botão de PDI, nem na sessão com lacuna avaliada", async () => {
    renderWithApp(<MentoringPage />);
    await selectMentee("Bruno Almeida");
    await screen.findByText("Aprofundar Kubernetes");

    expect(screen.queryByRole("button", { name: /PDI/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Criar ação/ })).toBeNull();
  });

  it("nada na tela de Mentoria chama /items/from-gap", async () => {
    renderWithApp(<MentoringPage />);
    await selectMentee("Bruno Almeida");
    await screen.findByText("Aprofundar Kubernetes");

    // `pointerEventsCheck: 0` porque alguns botões da tela nascem desabilitados;
    // o que se mede aqui é o que a tela CHAMA, não o que ela deixa clicar.
    for (const botao of screen.queryAllByRole("button"))
      await userEvent.click(botao, { pointerEventsCheck: 0 });

    const postToPlans = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes("from-gap") && init?.method === "POST",
    );
    expect(postToPlans).toBeUndefined();
  });

  /**
   * O MESMO invariante um nível abaixo, e é este que não depende da poda do
   * schema: a linha do tempo recebe a sessão PRONTA, com `actions` e
   * `competencyIds` gravados. Era exatamente esse o par que fazia o
   * `MentoringTimelineItem` desenhar "Criar ação no PDI".
   */
  it("a linha do tempo, recebendo a sessão com ações e competência, não desenha botão de PDI", async () => {
    renderWithApp(<MentoringTimeline sessions={[sessaoComGap]} />, {
      contexts: CONTEXTOS_DA_LINHA_DO_TEMPO,
    });

    expect(await screen.findByText("Aprofundar Kubernetes")).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: /PDI/ })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: /Criar ação/ })).toHaveLength(0);
  });
});
