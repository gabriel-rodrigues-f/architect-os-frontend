import { describe, expect, it } from "vitest";

import type { Professional, TeamTransferRequestView } from "@/lib/domain";
import type { SessionUser } from "@/lib/api";
import { UiAuthorizationPolicy } from "@/lib/scope";
import { TeamTransfersViewModel } from "@/lib/view-models";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
  fixtureMemberUser,
  fixtureTeamId,
} from "../../helpers/fixtures";

/**
 * Decisão do dono (2026-09-06): no Time, para o GERENTE, "Mudar de time"
 * deixa de ser imediato e vira SOLICITAÇÃO; o gerente do time de destino
 * aprova; só então a pessoa migra. O tech lead não vê o botão. O admin
 * continua movendo direto (correção de cadastro).
 *
 * Este é o view-model de QUEM VÊ O QUÊ — testado sem React, contra a mesma
 * `UiAuthorizationPolicy` que as telas usam.
 */
const ana = { id: "ana", teamId: fixtureTeamId } as Professional;

const gerenteDeDados: SessionUser = {
  ...fixtureAssignedManagerUser,
  id: "gerente-de-dados",
  memberships: [{ teamId: "time-dados", role: "manager" }],
};

const solicitacao = (patch: Partial<TeamTransferRequestView> = {}): TeamTransferRequestView => ({
  id: "req-1",
  professionalId: "ana",
  fromTeamId: fixtureTeamId,
  toTeamId: "time-dados",
  reason: "Realocação por demanda do produto",
  requestedByUserId: fixtureAssignedManagerUser.id,
  requestedAt: "2026-09-06T12:00:00.000Z",
  status: "pending",
  decidedByUserId: null,
  decidedAt: null,
  decisionNote: null,
  version: 1,
  professionalName: "Ana Martins",
  fromTeamName: "Time Plataforma",
  toTeamName: "Time Dados",
  requestedByName: "Gerente do time",
  decidedByName: null,
  ...patch,
});

const vm = new TeamTransfersViewModel(new UiAuthorizationPolicy());

describe("TeamTransfersViewModel — como o time muda", () => {
  it("o admin move direto (correção de cadastro)", () => {
    expect(vm.teamChangeModeFor(fixtureAdminUser, ana)).toBe("immediate");
  });

  it("o gerente designado SOLICITA — o gerente do destino aprova", () => {
    expect(vm.teamChangeModeFor(fixtureAssignedManagerUser, ana)).toBe("request");
  });

  it("o tech lead e o profissional não mudam time de ninguém", () => {
    expect(vm.teamChangeModeFor(fixtureAssignedTechLeadUser, ana)).toBeNull();
    expect(vm.teamChangeModeFor(fixtureMemberUser, ana)).toBeNull();
  });
});

describe("TeamTransfersViewModel — quem decide e quem cancela", () => {
  it("o gerente do time de DESTINO decide; o de origem, não", () => {
    expect(vm.decides(gerenteDeDados, solicitacao())).toBe(true);
    expect(vm.decides(fixtureAssignedManagerUser, solicitacao())).toBe(false);
  });

  it("o admin decide e cancela qualquer uma", () => {
    expect(vm.decides(fixtureAdminUser, solicitacao())).toBe(true);
    expect(vm.mayCancel(fixtureAdminUser, solicitacao())).toBe(true);
  });

  it("quem pediu cancela; o gerente do destino, não", () => {
    expect(vm.mayCancel(fixtureAssignedManagerUser, solicitacao())).toBe(true);
    expect(vm.mayCancel(gerenteDeDados, solicitacao())).toBe(false);
  });

  it("o tech lead não decide nem cancela", () => {
    expect(vm.decides(fixtureAssignedTechLeadUser, solicitacao())).toBe(false);
    expect(vm.mayCancel(fixtureAssignedTechLeadUser, solicitacao())).toBe(false);
  });

  it("uma solicitação já decidida não se decide nem se cancela de novo", () => {
    const aprovada = solicitacao({ status: "approved" });
    expect(vm.decides(gerenteDeDados, aprovada)).toBe(false);
    expect(vm.mayCancel(fixtureAssignedManagerUser, aprovada)).toBe(false);
  });
});

describe("TeamTransfersViewModel — a caixa de pendências", () => {
  const paraMim = solicitacao({
    id: "para-mim",
    fromTeamId: "time-dados",
    toTeamId: fixtureTeamId,
  });
  const minha = solicitacao({ id: "minha" });
  const alheia = solicitacao({
    id: "alheia",
    fromTeamId: "time-x",
    toTeamId: "time-y",
    requestedByUserId: "outro",
  });
  const decidida = solicitacao({ id: "decidida", status: "refused" });

  it("separa 'a aprovar por mim' de 'solicitadas por mim', só as pendentes", () => {
    const caixa = vm.inbox(fixtureAssignedManagerUser, [paraMim, minha, alheia, decidida]);
    expect(caixa.toDecide.map((req) => req.id)).toEqual(["para-mim"]);
    expect(caixa.requestedByMe.map((req) => req.id)).toEqual(["minha"]);
  });

  it("para o admin, tudo o que está pendente é a decidir", () => {
    const caixa = vm.inbox(fixtureAdminUser, [paraMim, minha, alheia, decidida]);
    expect(caixa.toDecide.map((req) => req.id)).toEqual(["para-mim", "minha", "alheia"]);
    expect(caixa.requestedByMe).toEqual([]);
  });

  it("a contagem do menu é o que há a decidir", () => {
    expect(vm.countToDecide(fixtureAssignedManagerUser, [paraMim, minha, alheia])).toBe(1);
    expect(vm.countToDecide(gerenteDeDados, [paraMim, minha, alheia])).toBe(1);
    expect(vm.countToDecide(fixtureAssignedTechLeadUser, [paraMim, minha, alheia])).toBe(0);
  });

  it("a pessoa com solicitação pendente ganha o selo com o destino", () => {
    expect(vm.pendingOf("ana", [minha, decidida])?.toTeamName).toBe("Time Dados");
    expect(vm.pendingOf("bruno", [minha])).toBeUndefined();
  });

  it("só quem pode ter pendência consulta a caixa: admin e gerente com vínculo", () => {
    expect(vm.mayHavePending(fixtureAdminUser)).toBe(true);
    expect(vm.mayHavePending(fixtureAssignedManagerUser)).toBe(true);
    expect(vm.mayHavePending(fixtureAssignedTechLeadUser)).toBe(false);
    expect(vm.mayHavePending(fixtureMemberUser)).toBe(false);
  });
});
