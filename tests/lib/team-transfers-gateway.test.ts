import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-errors";
import { InMemoryTeamTransfersGateway } from "@/lib/gateways/team-transfers.gateway";
import { fixtureAssignedManagerUser, fixtureState, fixtureTeamId } from "../helpers/fixtures";

/**
 * O gateway em memória é o ORÁCULO do contrato do backend (ebb305f):
 *   POST /architects/:id/team-transfer-requests { toTeamId, reason }
 *   POST /team-transfer-requests/:id/{approve,refuse,cancel}
 * Ele reproduz as recusas que a tela precisa saber tratar — motivo vazio,
 * mesmo time, pendência duplicada, decisão repetida, nota de recusa vazia.
 */
const times = [
  { id: fixtureTeamId, name: "Time Plataforma", active: true },
  { id: "time-dados", name: "Time Dados", active: true },
];

const novo = () =>
  new InMemoryTeamTransfersGateway(fixtureState.architects, times, fixtureAssignedManagerUser);

describe("InMemoryTeamTransfersGateway — solicitar", () => {
  it("cria a solicitação pendente com quem pediu e os nomes dos dois times", async () => {
    const gateway = novo();
    const pedida = await gateway.requestTeamTransfer("ana", "time-dados", "Demanda do produto");
    expect(pedida.status).toBe("pending");
    expect(pedida.fromTeamId).toBe(fixtureTeamId);
    expect(pedida.requestedByUserId).toBe(fixtureAssignedManagerUser.id);

    const [vista] = await gateway.teamTransferRequests("pending");
    expect(vista).toMatchObject({
      architectName: "Ana Martins",
      fromTeamName: "Time Plataforma",
      toTeamName: "Time Dados",
      requestedByName: fixtureAssignedManagerUser.name,
    });
  });

  it("recusa motivo vazio (400), mesmo time (400) e pendência duplicada (409)", async () => {
    const gateway = novo();
    await expect(gateway.requestTeamTransfer("ana", "time-dados", "  ")).rejects.toMatchObject({
      status: 400,
    });
    await expect(gateway.requestTeamTransfer("ana", fixtureTeamId, "x")).rejects.toMatchObject({
      code: "TEAM_TRANSFER_TO_SAME_TEAM",
    });
    await gateway.requestTeamTransfer("ana", "time-dados", "primeira");
    await expect(gateway.requestTeamTransfer("ana", "time-dados", "segunda")).rejects.toMatchObject(
      { code: "TEAM_TRANSFER_REQUEST_PENDING", status: 409 },
    );
  });
});

describe("InMemoryTeamTransfersGateway — decidir e cancelar", () => {
  it("aprovar muda o status e a pessoa migra; decidir de novo é 409", async () => {
    const gateway = novo();
    const pedida = await gateway.requestTeamTransfer("ana", "time-dados", "Demanda");
    const aprovada = await gateway.approveTeamTransfer(pedida.id);
    expect(aprovada.status).toBe("approved");
    expect(gateway.teamOf("ana")).toBe("time-dados");
    await expect(gateway.refuseTeamTransfer(pedida.id, "tarde")).rejects.toBeInstanceOf(ApiError);
    expect(await gateway.teamTransferRequests("pending")).toEqual([]);
  });

  it("recusar exige nota; a pessoa fica onde estava", async () => {
    const gateway = novo();
    const pedida = await gateway.requestTeamTransfer("ana", "time-dados", "Demanda");
    await expect(gateway.refuseTeamTransfer(pedida.id, "")).rejects.toMatchObject({ status: 400 });
    const recusada = await gateway.refuseTeamTransfer(pedida.id, "Sem vaga agora");
    expect(recusada).toMatchObject({ status: "refused", decisionNote: "Sem vaga agora" });
    expect(gateway.teamOf("ana")).toBe(fixtureTeamId);
  });

  it("cancelar encerra a pendência sem mover ninguém", async () => {
    const gateway = novo();
    const pedida = await gateway.requestTeamTransfer("ana", "time-dados", "Demanda");
    expect((await gateway.cancelTeamTransfer(pedida.id)).status).toBe("cancelled");
    expect(gateway.teamOf("ana")).toBe(fixtureTeamId);
    expect(await gateway.teamTransferRequests("pending")).toEqual([]);
  });
});
