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
 *      backend (`TeamStaffingGuard`); oferecer "Gerente" a um gerente seria
 *      desenhar um caminho que termina em 403.
 *   2. **senioridade aparece e some com o cargo.** O dono tirou o nível de
 *      carreira da liderança; o campo escondido também não pode viajar no
 *      corpo — quem garante isso é `PersonAdmission`, e aqui se prova que a
 *      tela obedece.
 *   3. **o time é obrigatório**, e quem lidera um só já o encontra escolhido.
 *   4. **a recusa do serviço fala JUNTO DO CAMPO e trava o envio.** "Este
 *      time já tem um gerente" num toast some sozinho e deixa o formulário
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
  const abrir = await screen.findByRole("button", { name: "Cadastrar Profissional" });
  await userEvent.click(abrir);
  return within(await screen.findByRole("dialog"));
}

const rotulosDe = (select: HTMLElement) =>
  [...select.querySelectorAll("option")]
    .map((option) => option.textContent)
    .filter((texto) => texto !== "Escolha a senioridade");

/**
 * O campo Time é o seletor da casa (`TeamChoiceField`, dono 2026-09-06): um
 * botão que abre a lista. Escolher é abrir e clicar no nome do time.
 */
const seletorDeTime = (dialogo: ReturnType<typeof within>) =>
  dialogo.getByLabelText("Time", { selector: "button" });

async function escolherTime(dialogo: ReturnType<typeof within>, nome: string) {
  await userEvent.click(seletorDeTime(dialogo));
  await userEvent.click(screen.getByRole("option", { name: nome }));
}

const timesOferecidos = async (dialogo: ReturnType<typeof within>) => {
  await userEvent.click(seletorDeTime(dialogo));
  const nomes = within(screen.getByRole("listbox"))
    .queryAllByRole("option")
    .map((option) => option.textContent)
    .filter((texto) => texto !== "Escolha o time");
  await userEvent.keyboard("{Escape}");
  return nomes;
};

describe("Usuários é o único lugar de cadastro — os cargos que cada persona vê", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("o admin cadastra Gerente, Tech Lead e Profissional — nunca outro Administrador", async () => {
    const dialogo = await abrirCadastro(fixtureAdminUser);
    expect(rotulosDe(dialogo.getByLabelText("Cargo"))).toEqual([
      "Gerente",
      "Tech Lead",
      "Profissional",
    ]);
  });

  it("o gerente cadastra Tech Lead e Profissional", async () => {
    const dialogo = await abrirCadastro(fixtureAssignedManagerUser);
    expect(rotulosDe(dialogo.getByLabelText("Cargo"))).toEqual(["Tech Lead", "Profissional"]);
  });

  /** D4 (dono, 2026-09-05): o tech lead indica, o gerente cadastra — a ação nem aparece. */
  it("o tech lead não cadastra", async () => {
    renderAs(fixtureAssignedTechLeadUser);
    expect(
      await screen.findByText("Cadastrar pessoas é do administrador e do gerente."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cadastrar Profissional" })).toBeNull();
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

  it("Profissional tem Senioridade, com os níveis de carreira da organização", async () => {
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
              { user: fixtureAdminUser, professionalId: "novo", invitationDelivered: true },
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
    await escolherTime(dialogo, "Dados");
    await userEvent.click(dialogo.getByRole("button", { name: "Cadastrar Profissional" }));

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

    expect(
      dialogo.getByRole("button", { name: "Cadastrar Profissional" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  /**
   * Quem cadastra mas não tem time ativo onde pôr a pessoa (o administrador
   * com todos os times desativados — o gerente sem vínculo nem alcança a
   * tela, revisão de papéis de 2026-09-05) recebe a explicação: um seletor
   * vazio com o botão apagado é um beco sem explicação.
   *
   * Item 12 do dono (2026-09-08): o campo deixa de oferecer "Escolha o time"
   * para uma lista que não existe. Na volta do mesmo dia, o dono trocou o
   * desenho: *"Ao invés de aparecer como linha clicável no filtro, vamos
   * bloquear o filtro"* — então o campo fica BLOQUEADO com a frase, sem
   * hiperlink nenhum, e a explicação abaixo dele continua sendo a saída.
   */
  it("quem não tem time ativo nenhum recebe a explicação, e o campo fica bloqueado", async () => {
    const soTimesDesativados: FetchRoute = (href, init) =>
      href.endsWith(apiPath("/teams")) && (init?.method ?? "GET") === "GET"
        ? jsonResponse(TIMES.map((time) => ({ ...time, active: false })))
        : undefined;
    const dialogo = await abrirCadastro(fixtureAdminUser, [soTimesDesativados]);

    expect(dialogo.queryByText("Escolha o time")).toBeNull();
    expect(dialogo.getByText("Nenhum time cadastrado")).toBeTruthy();
    // Filtro sem opções é filtro bloqueado (dono, 2026-09-08): nada abre, e
    // nenhum hiperlink pende do campo.
    const campoDeTime = dialogo.getByRole("button", { name: "Time" });
    expect(campoDeTime.hasAttribute("disabled")).toBe(true);
    await userEvent.click(campoDeTime);
    expect(screen.queryByRole("link", { name: /Cadastrar/ })).toBeNull();
    expect(
      dialogo.getByText(
        "Você não lidera nenhum time ativo — peça ao administrador para vinculá-lo a um time.",
      ),
    ).toBeTruthy();
  });

  it("quem lidera um time só já o encontra escolhido — e TRAVADO, com a explicação ao passar o mouse (dono, 2026-09-06)", async () => {
    const dialogo = await abrirCadastro(fixtureAssignedManagerUser);
    const time = seletorDeTime(dialogo);
    expect(time.textContent).toContain("Plataforma");
    expect(time.hasAttribute("disabled")).toBe(true);
    expect(time.getAttribute("title")).toBe("Cadastro restrito a pessoas do seu time.");
    expect(dialogo.getByText("Cadastro restrito a pessoas do seu time.")).toBeTruthy();
    await userEvent.click(time);
    expect(screen.queryByRole("option", { name: "Dados" })).toBeNull();
  });

  it("o administrador escolhe o time livremente — nada travado", async () => {
    const dialogo = await abrirCadastro(fixtureAdminUser);
    expect(seletorDeTime(dialogo).hasAttribute("disabled")).toBe(false);
    expect(await timesOferecidos(dialogo)).toEqual(["Plataforma", "Dados"]);
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
      "Este time já tem um gerente: Marina Alves. Um time tem no máximo um gerente — troque o gerente atual antes de indicar outro.",
    correlationId: "corr-1",
  };

  it("o segundo gerente do time é recusado com a mensagem do serviço, junto do campo Time", async () => {
    const dialogo = await abrirCadastro(fixtureAdminUser, [
      (href, init) =>
        href.endsWith(apiPath("/auth/users")) && init?.method === "POST"
          ? jsonResponse(RECUSA_DE_GESTOR, 409)
          : undefined,
    ]);
    await userEvent.type(dialogo.getByLabelText("Nome"), "Joana Prado");
    await userEvent.type(dialogo.getByLabelText("E-mail"), "joana@empresa.com");
    await userEvent.selectOptions(dialogo.getByLabelText("Cargo"), "manager");
    await escolherTime(dialogo, "Plataforma");
    await userEvent.click(dialogo.getByRole("button", { name: "Cadastrar Profissional" }));

    const recusa = await dialogo.findByRole("alert");
    expect(recusa.textContent).toContain("Marina Alves");
    expect(seletorDeTime(dialogo).getAttribute("aria-describedby")).toBe(recusa.id);
    expect(
      dialogo.getByRole("button", { name: "Cadastrar Profissional" }).hasAttribute("disabled"),
    ).toBe(true);

    await escolherTime(dialogo, "Dados");
    expect(
      dialogo.getByRole("button", { name: "Cadastrar Profissional" }).hasAttribute("disabled"),
    ).toBe(false);
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
        ? jsonResponse({ user: fixtureAdminUser, professionalId: "novo", invitationDelivered }, 201)
        : undefined;

  async function cadastrar(invitationDelivered: boolean) {
    const dialogo = await abrirCadastro(fixtureAdminUser, [
      admissaoQueResponde(invitationDelivered),
    ]);
    await userEvent.selectOptions(dialogo.getByLabelText("Cargo"), "tech_lead");
    await userEvent.type(dialogo.getByLabelText("Nome"), "Joana Prado");
    await userEvent.type(dialogo.getByLabelText("E-mail"), "joana@empresa.com");
    await escolherTime(dialogo, "Dados");
    await userEvent.click(dialogo.getByRole("button", { name: "Cadastrar Profissional" }));
    // O diálogo de sucesso substitui o de cadastro no MESMO papel; espera-se
    // pelo título dele, e não por "um dialog", que já existe.
    await screen.findByText("Profissional cadastrado");
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
