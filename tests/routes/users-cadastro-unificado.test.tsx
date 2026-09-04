import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import type { SessionUser } from "@/lib/api";
import { Route as UsersRoute } from "@/routes/users";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
  fixtureCareerLevels,
  fixtureState,
  fixtureUnassignedTechLeadUser,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";

/**
 * ONDA 37 — *"O cadastro deve ser uma coisa só, ou seja, o que fazemos em
 * Time e em Usuários precisa estar conectado."* Usuários passa a ser o
 * ÚNICO lugar onde uma pessoa nasce: Nome · E-mail · Cargo · (Senioridade,
 * só para o profissional) · Time.
 *
 * O que esta rede prende, e por quê:
 *
 *   1. **as três personas veem só os cargos que podem criar.** A régua é do
 *      backend (`TeamStaffingGuard`); oferecer "Gestor" a um gestor seria
 *      desenhar um caminho que termina em 403.
 *   2. **senioridade aparece e some com o cargo.** O dono tirou o nível de
 *      carreira da liderança; o campo escondido também não pode viajar no
 *      corpo — quem garante isso é `PersonAdmission`, e aqui se prova que a
 *      tela obedece.
 *   3. **o time é obrigatório**, e quem lidera um só já o encontra escolhido.
 *   4. **a recusa do serviço fala JUNTO DO CAMPO e trava o envio.** "Este
 *      time já tem um gestor" num toast some sozinho e deixa o formulário
 *      com cara de pronto.
 */

const fetchMock = vi.fn();

const UsersPage = UsersRoute.options.component as () => ReactNode;

const TIMES = [
  { id: "time-plataforma", name: "Plataforma", active: true },
  { id: "time-dados", name: "Dados", active: true },
];

const rotaDeTimes: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/teams")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse(TIMES)
    : undefined;

const rotaDeContas: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/auth/users")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse([fixtureAdminUser])
    : undefined;

function corpoDaAdmissao(): Record<string, unknown> | undefined {
  const chamada = fetchMock.mock.calls.find(
    ([entrada, init]) =>
      String(entrada instanceof Request ? entrada.url : entrada).endsWith(apiPath("/auth/users")) &&
      (init as RequestInit | undefined)?.method === "POST",
  );
  const corpo = (chamada?.[1] as RequestInit | undefined)?.body;
  return typeof corpo === "string" ? (JSON.parse(corpo) as Record<string, unknown>) : undefined;
}

function renderAs(user: SessionUser, extras: FetchRoute[] = []) {
  mockAppFetch(fetchMock, {
    user,
    state: user === fixtureAdminUser ? fixtureState : scopedFixtureStateFor(user),
    routes: [...extras, rotaDeContas, rotaDeTimes, careerLevelsRoute],
  });
  return renderWithApp(<UsersPage />);
}

async function abrirCadastro(user: SessionUser, extras: FetchRoute[] = []) {
  renderAs(user, extras);
  const abrir = await screen.findByRole("button", { name: "Cadastrar pessoa" });
  await userEvent.click(abrir);
  return within(await screen.findByRole("dialog"));
}

const rotulosDe = (select: HTMLElement) =>
  [...select.querySelectorAll("option")]
    .map((option) => option.textContent)
    .filter((texto) => texto !== "Escolha o time" && texto !== "Escolha a senioridade");

describe("Usuários é o único lugar de cadastro — os cargos que cada persona vê", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("o admin cadastra Gestor, Tech Lead e Membro — nunca outro Administrador", async () => {
    const dialogo = await abrirCadastro(fixtureAdminUser);
    expect(rotulosDe(dialogo.getByLabelText("Cargo"))).toEqual(["Gestor", "Tech Lead", "Membro"]);
  });

  it("o gestor cadastra Tech Lead e Membro", async () => {
    const dialogo = await abrirCadastro(fixtureAssignedManagerUser);
    expect(rotulosDe(dialogo.getByLabelText("Cargo"))).toEqual(["Tech Lead", "Membro"]);
  });

  it("o tech lead cadastra só Membro", async () => {
    const dialogo = await abrirCadastro(fixtureAssignedTechLeadUser);
    expect(rotulosDe(dialogo.getByLabelText("Cargo"))).toEqual(["Membro"]);
  });
});

describe("senioridade aparece e some com o cargo", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("Membro tem Senioridade, com os níveis de carreira da organização", async () => {
    const dialogo = await abrirCadastro(fixtureAdminUser);
    await userEvent.selectOptions(dialogo.getByLabelText("Cargo"), "member");
    expect(rotulosDe(dialogo.getByLabelText("Senioridade"))).toEqual(
      fixtureCareerLevels.map((nivel) => nivel.name),
    );
  });

  /**
   * CFG-01, guard rail herdado de `team-roles-from-career-levels`: a lista
   * de senioridade vem de `GET /career-levels` (tabela, por `rank`), nunca
   * de um array literal. Com o `ROLES` fixo de três, um 4º nível cadastrado
   * jamais apareceria. Serve quatro e exige quatro, na ordem do rank.
   */
  it("um 4º nível cadastrado aparece — a lista vem da tabela, não de array fixo", async () => {
    const quatroNiveis = [
      ...fixtureCareerLevels,
      { id: "arquiteto-de-solucoes-iv", name: "Especialista", rank: 4 },
    ];
    const dialogo = await abrirCadastro(fixtureAdminUser, [
      (href) => (href.endsWith(apiPath("/career-levels")) ? jsonResponse(quatroNiveis) : undefined),
    ]);
    await userEvent.selectOptions(dialogo.getByLabelText("Cargo"), "member");
    expect(rotulosDe(dialogo.getByLabelText("Senioridade"))).toEqual([
      "Júnior",
      "Pleno",
      "Sênior",
      "Especialista",
    ]);
  });

  it("Tech Lead não tem Senioridade — o campo some da tela", async () => {
    const dialogo = await abrirCadastro(fixtureAdminUser);
    await userEvent.selectOptions(dialogo.getByLabelText("Cargo"), "tech_lead");
    expect(dialogo.queryByLabelText("Senioridade")).toBeNull();
  });

  it("nem some da tela e viaja no corpo: o Tech Lead vai sem nível de carreira", async () => {
    const dialogo = await abrirCadastro(fixtureAdminUser, [
      (href, init) =>
        href.endsWith(apiPath("/auth/users")) && init?.method === "POST"
          ? jsonResponse(
              { user: fixtureAdminUser, architectId: "novo", invitationDelivered: true },
              201,
            )
          : undefined,
    ]);
    await userEvent.selectOptions(dialogo.getByLabelText("Cargo"), "member");
    await userEvent.selectOptions(
      dialogo.getByLabelText("Senioridade"),
      "arquiteto-de-solucoes-ii",
    );
    await userEvent.selectOptions(dialogo.getByLabelText("Cargo"), "tech_lead");
    await userEvent.type(dialogo.getByLabelText("Nome"), "Joana Prado");
    await userEvent.type(dialogo.getByLabelText("E-mail"), "joana@empresa.com");
    await userEvent.selectOptions(dialogo.getByLabelText("Time"), "time-dados");
    await userEvent.click(dialogo.getByRole("button", { name: "Cadastrar pessoa" }));

    expect(corpoDaAdmissao()).toEqual({
      name: "Joana Prado",
      email: "joana@empresa.com",
      role: "tech_lead",
      teamId: "time-dados",
    });
  });
});

describe("o time entra no cadastro", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("sem time escolhido o cadastro não sai", async () => {
    const dialogo = await abrirCadastro(fixtureAdminUser);
    await userEvent.type(dialogo.getByLabelText("Nome"), "Joana Prado");
    await userEvent.type(dialogo.getByLabelText("E-mail"), "joana@empresa.com");
    await userEvent.selectOptions(dialogo.getByLabelText("Cargo"), "tech_lead");

    expect(dialogo.getByRole("button", { name: "Cadastrar pessoa" }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  /**
   * O tech lead sem vínculo de time nenhum alcança a tela (o menu é da
   * liderança) e não tem onde cadastrar. Um seletor vazio com o botão apagado
   * é um beco sem explicação; a tela DIZ o que falta e a quem pedir.
   */
  it("quem não lidera time ativo nenhum recebe a explicação, não um seletor vazio", async () => {
    const dialogo = await abrirCadastro(fixtureUnassignedTechLeadUser);
    expect(rotulosDe(dialogo.getByLabelText("Time"))).toEqual([]);
    expect(
      dialogo.getByText(
        "Você não lidera nenhum time ativo — peça ao administrador para vinculá-lo a um time.",
      ),
    ).toBeTruthy();
  });

  it("quem lidera um time só já o encontra escolhido", async () => {
    const dialogo = await abrirCadastro(fixtureAssignedManagerUser);
    const time = dialogo.getByLabelText("Time") as HTMLSelectElement;
    expect(rotulosDe(time)).toEqual(["Plataforma"]);
    expect(time.value).toBe("time-plataforma");
  });
});

describe("a recusa do serviço fala no campo e trava o envio", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const RECUSA_DE_GESTOR = {
    code: "TEAM_ALREADY_HAS_MANAGER",
    message:
      "Este time já tem um gestor: Marina Alves. Um time tem no máximo um gestor — troque o gestor atual antes de indicar outro.",
    correlationId: "corr-1",
  };

  it("o segundo gestor do time é recusado com a mensagem do serviço, junto do campo Time", async () => {
    const dialogo = await abrirCadastro(fixtureAdminUser, [
      (href, init) =>
        href.endsWith(apiPath("/auth/users")) && init?.method === "POST"
          ? jsonResponse(RECUSA_DE_GESTOR, 409)
          : undefined,
    ]);
    await userEvent.type(dialogo.getByLabelText("Nome"), "Joana Prado");
    await userEvent.type(dialogo.getByLabelText("E-mail"), "joana@empresa.com");
    await userEvent.selectOptions(dialogo.getByLabelText("Cargo"), "manager");
    await userEvent.selectOptions(dialogo.getByLabelText("Time"), "time-plataforma");
    await userEvent.click(dialogo.getByRole("button", { name: "Cadastrar pessoa" }));

    const recusa = await dialogo.findByRole("alert");
    expect(recusa.textContent).toContain("Marina Alves");
    expect(dialogo.getByLabelText("Time").getAttribute("aria-describedby")).toBe(recusa.id);
    expect(dialogo.getByRole("button", { name: "Cadastrar pessoa" }).hasAttribute("disabled")).toBe(
      true,
    );

    await userEvent.selectOptions(dialogo.getByLabelText("Time"), "time-dados");
    expect(dialogo.getByRole("button", { name: "Cadastrar pessoa" }).hasAttribute("disabled")).toBe(
      false,
    );
  });
});

describe("depois de cadastrar, a tela diz o que ACONTECEU com o acesso", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  /**
   * ONDA 44 (ADR-0094) — a admissão parou de sortear senha. Antes desta rede
   * a tela continuou prometendo uma: dizia "Repasse a senha temporária" e
   * "copie agora", com um espaço vazio onde a senha ficava. O dono viu a
   * mensagem em produção — a tela mentia em silêncio porque nenhum teste
   * olhava para ela.
   *
   * O que ela precisa dizer agora são DUAS coisas diferentes, e a diferença
   * importa: quando o e-mail sai, a pessoa vai receber um link; quando NÃO
   * sai, ela não consegue entrar e alguém precisa reenviar.
   */
  const admissaoQueResponde =
    (invitationDelivered: boolean): FetchRoute =>
    (href, init) =>
      href.endsWith(apiPath("/auth/users")) && init?.method === "POST"
        ? jsonResponse({ user: fixtureAdminUser, architectId: "novo", invitationDelivered }, 201)
        : undefined;

  async function cadastrar(invitationDelivered: boolean) {
    const dialogo = await abrirCadastro(fixtureAdminUser, [
      admissaoQueResponde(invitationDelivered),
    ]);
    await userEvent.selectOptions(dialogo.getByLabelText("Cargo"), "tech_lead");
    await userEvent.type(dialogo.getByLabelText("Nome"), "Joana Prado");
    await userEvent.type(dialogo.getByLabelText("E-mail"), "joana@empresa.com");
    await userEvent.selectOptions(dialogo.getByLabelText("Time"), "time-dados");
    await userEvent.click(dialogo.getByRole("button", { name: "Cadastrar pessoa" }));
    // O diálogo de sucesso substitui o de cadastro no MESMO papel; espera-se
    // pelo título dele, e não por "um dialog", que já existe.
    await screen.findByText("Pessoa cadastrada");
    return within(screen.getByRole("dialog"));
  }

  it("com o e-mail entregue: fala do LINK, e nunca de senha para repassar", async () => {
    const dialogo = await cadastrar(true);

    expect(dialogo.getByText(/link para a pessoa criar a senha dela/i)).toBeTruthy();
    expect(dialogo.getByText(/joana@empresa\.com/)).toBeTruthy();
    // O texto que o dono viu, e que não pode voltar de jeito nenhum.
    expect(dialogo.queryByText(/copie agora/i)).toBeNull();
    expect(dialogo.queryByText(/repasse a senha/i)).toBeNull();
    expect(dialogo.queryByText(/senha tempor/i)).toBeNull();
  });

  it("com o e-mail RECUSADO: avisa que não saiu e diz o que fazer", async () => {
    const dialogo = await cadastrar(false);

    expect(dialogo.getByText(/NÃO saiu/)).toBeTruthy();
    expect(dialogo.getByText(/ainda não consegue entrar/i)).toBeTruthy();
    expect(dialogo.getByText(/Devolver o acesso/)).toBeTruthy();
  });
});
