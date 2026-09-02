import type { APIRequestContext } from "@playwright/test";
import { Client } from "pg";

import { apiPath } from "../src/lib/api-path";

/**
 * Fase 2 (backend ADR-0035) — `lead_user_id` morreu: o vínculo Tech
 * Lead→pessoa é TIME + `team_memberships(role='tech_lead')` + régua do time
 * (`team_level_rules`).
 *
 * Onda 33 — a massa passou a nascer PELA API, não mais por SQL. As rotas
 * chegaram nas ondas 30-31 (`POST /teams`, `POST /teams/:id/memberships`,
 * `PATCH /architects/:id {teamId}`, `PUT /teams/:id/rules/:level`) e o
 * SQL direto tinha um defeito que a rodada de entrega provou: o roster
 * (`GET /architects`) vive em cache (`architects:all`, TTL de
 * CACHE_TTL_SECONDS) invalidado só pelas escritas da aplicação. Um
 * `UPDATE architects SET team_id` por fora deixava o cache com `teamId:
 * null`, `visibleArchitectIds` não via a pessoa e o tech lead abria o painel
 * com "Pessoas sob sua liderança 0" — com o banco certo. Escrever pela porta
 * que invalida é a única forma de o vínculo valer no mesmo instante.
 *
 * A régua criada cobre TODOS os níveis de carreira com TODAS as
 * competências ativas (NON_RESTRICTIVE, nível exigido crescendo com o
 * rank): sem régua, a materialização da avaliação responde "0 itens, sem
 * erro" (ADR-0032) e os fluxos de escrita não têm o que preencher.
 */
export interface TeamLinkInput {
  /** Sessão de ADMIN já logada — quem cadastra time, compõe quadro e rege régua. */
  api: APIRequestContext;
  runId: string;
  leadUserId: string;
  architectIds: string[];
}

interface CareerLevel {
  id: string;
  rank: number;
}

interface Competency {
  id: string;
  active: boolean;
}

const LEVEL_CEILING = 5;

async function unwrap<T>(response: Awaited<ReturnType<APIRequestContext["post"]>>): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.url()} → ${response.status()}: ${await response.text()}`);
  }
  const body: unknown = await response.json();
  if (body !== null && typeof body === "object" && !Array.isArray(body) && "data" in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export async function linkLeadToArchitects(input: TeamLinkInput): Promise<string> {
  const { api } = input;
  const team = await unwrap<{ id: string }>(
    await api.post(apiPath("/teams"), { data: { name: `E2E Time ${input.runId}` } }),
  );
  await unwrap(
    await api.post(apiPath(`/teams/${team.id}/memberships`), {
      data: { userId: input.leadUserId, role: "tech_lead" },
    }),
  );
  for (const architectId of input.architectIds) {
    await unwrap(
      await api.patch(apiPath(`/architects/${architectId}`), { data: { teamId: team.id } }),
    );
  }

  const levels = await unwrap<CareerLevel[]>(await api.get(apiPath("/career-levels")));
  const competencies = (await unwrap<Competency[]>(await api.get(apiPath("/competencies")))).filter(
    (competency) => competency.active,
  );
  for (const level of levels) {
    await unwrap(
      await api.put(apiPath(`/teams/${team.id}/rules/${level.id}`), {
        data: {
          minimumQualifiedCapabilities: 3,
          competencies: competencies.map((competency) => ({
            competencyId: competency.id,
            requirementType: "NON_RESTRICTIVE",
            requiredLevel: Math.min(level.rank + 2, LEVEL_CEILING),
          })),
        },
      }),
    );
  }
  return team.id;
}

/**
 * Remover DEPOIS dos arquitetos do spec: `architects.team_id` referencia o
 * time. Limpeza continua direta no Postgres (não há `DELETE /teams`, e
 * `DELETE FROM architects` já é SQL nos specs); o cache de roster expira em
 * CACHE_TTL_SECONDS e o spec seguinte cria gente nova pela API, que invalida.
 */
export async function unlinkTeam(databaseUrl: string, teamId: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`UPDATE architects SET team_id = NULL WHERE team_id = $1`, [teamId]);
    await client.query(`DELETE FROM team_level_rules WHERE team_id = $1`, [teamId]);
    await client.query(`DELETE FROM team_memberships WHERE team_id = $1`, [teamId]);
    await client.query(`DELETE FROM teams WHERE id = $1`, [teamId]);
  } finally {
    await client.end();
  }
}
