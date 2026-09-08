import { describe, expect, it } from "vitest";

import type { SessionUser } from "@/lib/api";
import { AccountsDirectory, TableOrder } from "@/lib/view-models";
import { fixtureAdminUser, fixtureMemberUser } from "../../helpers/fixtures";

/**
 * Dono (2026-09-06): "Em Usuários > Contas cadastradas deve ser possível
 * filtrar por time. Cada título (Nome, E-mail, Cargo, Status) deve ter uma
 * setinha para asc/desc." O time da conta vem do VÍNCULO (`memberships`); a
 * conta sem vínculo é "Sem time".
 */
const plataforma = { id: "time-plataforma", name: "Plataforma" };
const dados = { id: "time-dados", name: "Dados" };

const conta = (id: string, name: string, extra: Partial<SessionUser> = {}): SessionUser => ({
  ...fixtureMemberUser,
  id,
  name,
  email: `${id}@empresa.com`,
  ...extra,
});

const contas: SessionUser[] = [
  conta("carla", "Carla Souza", {
    role: "tech_lead",
    status: "disabled",
    memberships: [{ teamId: "time-dados", role: "tech_lead" }],
  }),
  conta("ana", "Ana Martins", { memberships: [{ teamId: "time-plataforma", role: "member" }] }),
  { ...fixtureAdminUser, id: "admin", name: "Bruno Admin", email: "bruno@empresa.com" },
];

const rotulos = {
  roleLabel: (role: string) =>
    ({
      admin: "Administrador",
      support: "Suporte",
      manager: "Gerente",
      tech_lead: "Tech Lead",
      member: "Profissional",
    })[role] ?? role,
  statusLabel: (status: string) => (status === "active" ? "Ativa" : "Desativada"),
  noTeam: "Sem time",
  allTeams: "Todos os times",
};

const diretorio = () => new AccountsDirectory(contas, [plataforma, dados], rotulos);
const nomes = (lista: readonly SessionUser[]) => lista.map((account) => account.name);

describe("AccountsDirectory — o time da conta vem do vínculo", () => {
  it("lê o time do vínculo e diz 'Sem time' para quem não tem", () => {
    const dir = diretorio();
    expect(dir.teamNameOf(contas[1] as SessionUser)).toBe("Plataforma");
    expect(dir.teamNameOf(contas[2] as SessionUser)).toBe("Sem time");
  });

  it("o filtro oferece todos os times, os do alcance e 'Sem time' só quando alguma conta está solta", () => {
    const dir = diretorio();
    expect(dir.teamFilterOptions([plataforma, dados])).toEqual([
      { value: AccountsDirectory.ALL_TEAMS, label: "Todos os times" },
      { value: "time-plataforma", label: "Plataforma" },
      { value: "time-dados", label: "Dados" },
      { value: AccountsDirectory.NO_TEAM, label: "Sem time" },
    ]);
    const soVinculadas = new AccountsDirectory(contas.slice(0, 2), [plataforma, dados], rotulos);
    expect(soVinculadas.teamFilterOptions([plataforma]).map((option) => option.value)).toEqual([
      AccountsDirectory.ALL_TEAMS,
      "time-plataforma",
    ]);
  });

  it("filtra por time e por 'Sem time'", () => {
    const dir = diretorio();
    const semOrdem = TableOrder.none<"name">();
    expect(nomes(dir.list("time-dados", semOrdem))).toEqual(["Carla Souza"]);
    expect(nomes(dir.list(AccountsDirectory.NO_TEAM, semOrdem))).toEqual(["Bruno Admin"]);
    expect(nomes(dir.list(AccountsDirectory.ALL_TEAMS, semOrdem))).toHaveLength(3);
  });
});

describe("AccountsDirectory — cada coluna ordena nos dois sentidos", () => {
  const dir = diretorio();
  const todos = AccountsDirectory.ALL_TEAMS;

  it("por nome", () => {
    expect(nomes(dir.list(todos, TableOrder.by("name")))).toEqual([
      "Ana Martins",
      "Bruno Admin",
      "Carla Souza",
    ]);
    expect(nomes(dir.list(todos, TableOrder.by("name", "desc")))).toEqual([
      "Carla Souza",
      "Bruno Admin",
      "Ana Martins",
    ]);
  });

  it("por e-mail", () => {
    expect(nomes(dir.list(todos, TableOrder.by("email")))).toEqual([
      "Ana Martins",
      "Bruno Admin",
      "Carla Souza",
    ]);
  });

  it("por cargo, pelo rótulo que a tela mostra", () => {
    expect(nomes(dir.list(todos, TableOrder.by("role")))).toEqual([
      "Bruno Admin",
      "Ana Martins",
      "Carla Souza",
    ]);
  });

  it("por status, pelo rótulo que a tela mostra", () => {
    expect(nomes(dir.list(todos, TableOrder.by("status", "desc")))).toEqual([
      "Carla Souza",
      "Ana Martins",
      "Bruno Admin",
    ]);
  });

  it("por time, com 'Sem time' entre os nomes", () => {
    expect(nomes(dir.list(todos, TableOrder.by("team")))).toEqual([
      "Carla Souza",
      "Ana Martins",
      "Bruno Admin",
    ]);
  });

  it("empate desempata pelo nome", () => {
    expect(nomes(dir.list(todos, TableOrder.by("status")))).toEqual([
      "Ana Martins",
      "Bruno Admin",
      "Carla Souza",
    ]);
  });
});
