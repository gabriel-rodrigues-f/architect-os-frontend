import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-errors";
import { InMemoryTeamAllocationGateway } from "@/lib/gateways/team-allocation.gateway";
import { fixtureState, fixtureTeamId } from "../helpers/fixtures";

/**
 * Onda 35 — contrato novo do backend: `POST /architects/:id/team-allocation`
 * recebe `{ teamId, reason }`, com `reason` obrigatório e não vazio; sem ele,
 * 400. O gateway em memória é o oráculo desse contrato para as telas — se ele
 * aceitasse alocação sem motivo, a tela passaria verde aqui e 400 no ar.
 */
const times = [
  { id: fixtureTeamId, name: "Time Plataforma", active: true },
  { id: "time-dados", name: "Time Dados", active: true },
];

describe("gateway em memória de alocação — o motivo é obrigatório, como no serviço", () => {
  it("aloca com motivo e o registra junto da alocação feita", async () => {
    const gateway = new InMemoryTeamAllocationGateway(fixtureState.architects, times);

    const alocada = await gateway.allocateArchitectToTeam("ana", "time-dados", "Demanda nova");

    expect(alocada.teamId).toBe("time-dados");
    expect(gateway.allocationsMade).toEqual([
      { architectId: "ana", teamId: "time-dados", reason: "Demanda nova" },
    ]);
  });

  it("recusa com 400 quando o motivo está vazio ou só tem espaços", async () => {
    const gateway = new InMemoryTeamAllocationGateway(fixtureState.architects, times);

    for (const motivo of ["", "   "]) {
      const recusa = await gateway.allocateArchitectToTeam("ana", "time-dados", motivo).then(
        () => null,
        (error: unknown) => error,
      );
      expect(recusa).toBeInstanceOf(ApiError);
      expect((recusa as ApiError).status).toBe(400);
    }
    expect(gateway.allocationsMade).toEqual([]);
  });
});
