import { Client } from "pg";

/**
 * Fase 2 (backend ADR-0035) — `lead_user_id` morreu: o vínculo Tech
 * Lead→pessoa é TIME + `team_memberships(role='tech_lead')` + régua do time
 * (`team_level_rules`). Não existe rota HTTP para criar times ou vínculos
 * (lacuna registrada em ATIVIDADES), então a massa E2E nasce direto no
 * Postgres — o mesmo canal que os specs já usam para a limpeza.
 *
 * A régua criada cobre TODOS os níveis de carreira com TODAS as
 * competências ativas (NON_RESTRICTIVE, nível exigido crescendo com o
 * rank): sem régua, a materialização da avaliação responde "0 itens, sem
 * erro" (ADR-0032) e os fluxos de escrita não têm o que preencher.
 */
export interface TeamLinkInput {
  databaseUrl: string;
  runId: string;
  leadUserId: string;
  architectIds: string[];
}

export async function linkLeadToArchitects(input: TeamLinkInput): Promise<string> {
  const teamId = `e2e-team-${input.runId}`;
  const client = new Client({ connectionString: input.databaseUrl });
  await client.connect();
  try {
    await client.query(`INSERT INTO teams (id, name) VALUES ($1, $2)`, [
      teamId,
      `E2E Time ${input.runId}`,
    ]);
    await client.query(
      `INSERT INTO team_memberships (id, team_id, user_id, role) VALUES ($1, $2, $3, 'tech_lead')`,
      [`e2e-vinculo-${input.runId}`, teamId, input.leadUserId],
    );
    await client.query(
      `INSERT INTO team_level_rules (id, team_id, career_level_id, minimum_qualified_capabilities)
       SELECT $1 || '-' || cl.id, $2, cl.id, 3 FROM career_levels cl`,
      [`e2e-regra-${input.runId}`, teamId],
    );
    await client.query(
      `INSERT INTO team_rule_competencies
         (team_level_rule_id, competency_id, requirement_type, required_level)
       SELECT r.id, c.id, 'NON_RESTRICTIVE', LEAST(cl.rank + 2, 5)
         FROM team_level_rules r
         JOIN career_levels cl ON cl.id = r.career_level_id
        CROSS JOIN competencies c
        WHERE r.team_id = $1 AND c.active`,
      [teamId],
    );
    await client.query(`UPDATE architects SET team_id = $1 WHERE id = ANY($2::text[])`, [
      teamId,
      input.architectIds,
    ]);
  } finally {
    await client.end();
  }
  return teamId;
}

/** Remover DEPOIS dos arquitetos do spec: `architects.team_id` referencia o time. */
export async function unlinkTeam(databaseUrl: string, teamId: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`UPDATE architects SET team_id = NULL WHERE team_id = $1`, [teamId]);
    await client.query(`DELETE FROM team_level_rules WHERE team_id = $1`, [teamId]);
    await client.query(`DELETE FROM teams WHERE id = $1`, [teamId]);
  } finally {
    await client.end();
  }
}
