import type { APIRequestContext } from "@playwright/test";
import { Client } from "pg";

import { apiPath } from "../src/lib/api-path";

/**
 * Fase 2 (backend ADR-0035) — `lead_user_id` morreu: o vínculo Tech
 * Lead→pessoa é TIME + `team_memberships(role='tech_lead')` + régua do time
 * (`team_level_rules`).
 *
 * Onda 33 — a massa passou a nascer PELA API, não mais por SQL. O SQL direto
 * tinha um defeito que a rodada de entrega provou: o roster
 * (`GET /architects`) vive em cache (`architects:all`, TTL de
 * CACHE_TTL_SECONDS) invalidado só pelas escritas da aplicação. Um
 * `UPDATE architects SET team_id` por fora deixava o cache com `teamId:
 * null`, `visibleArchitectIds` não via a pessoa e o tech lead abria o painel
 * com "Pessoas sob sua liderança 0" — com o banco certo. Escrever pela porta
 * que invalida é a única forma de o vínculo valer no mesmo instante.
 *
 * ONDA 37 (backend ADR-0084) — A ORDEM INVERTEU. Antes a massa criava a
 * conta e o profissional soltos e só depois pendurava os dois num time; hoje
 * o time NASCE PRIMEIRO e a pessoa nasce nele: `POST /auth/users` exige
 * `teamId` e escreve conta, profissional e vínculo numa transação só. Não há
 * mais como fabricar conta órfã — nem no produto, nem aqui.
 *
 * A régua criada cobre TODOS os níveis de carreira com TODAS as
 * competências ativas (nível exigido crescendo com o rank — a
 * obrigatoriedade morreu na onda 36): sem régua, a materialização da
 * avaliação responde "0 itens, sem erro" (ADR-0032) e os fluxos de escrita
 * não têm o que preencher.
 */
const API_URL = process.env["E2E_API_URL"] ?? "http://localhost:4000";

/** A senha que toda pessoa da massa passa a usar depois de ativar a conta. */
export const PASSWORD = "senha-de-teste-e2e-123";

/** O CARGO (papel de acesso). `admin` não é cargo de cadastro — ADR-0084. */
export type Cargo = "manager" | "tech_lead" | "member";

export interface CareerLevel {
  id: string;
  name: string;
  rank: number;
}

interface Competency {
  id: string;
  active: boolean;
}

export interface AdmissionInput {
  playwright: typeof import("playwright-core");
  /** Sessão de quem cadastra — admin cadastra qualquer cargo em qualquer time. */
  api: APIRequestContext;
  name: string;
  email: string;
  role: Cargo;
  teamId: string;
  /** A SENIORIDADE: exigida do profissional, proibida na liderança. */
  careerLevelId?: string | undefined;
}

export interface AdmittedPerson {
  userId: string;
  architectId: string;
}

const LEVEL_CEILING = 5;
const MINIMUM_QUALIFIED_CAPABILITIES = 3;

export async function unwrap<T>(
  response: Awaited<ReturnType<APIRequestContext["post"]>>,
): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.url()} → ${response.status()}: ${await response.text()}`);
  }
  const body: unknown = await response.json();
  if (body !== null && typeof body === "object" && !Array.isArray(body) && "data" in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export async function registerTeam(api: APIRequestContext, runId: string): Promise<string> {
  const team = await unwrap<{ id: string }>(
    await api.post(apiPath("/teams"), { data: { name: `E2E Time ${runId}` } }),
  );
  return team.id;
}

export async function careerLevels(api: APIRequestContext): Promise<CareerLevel[]> {
  return unwrap<CareerLevel[]>(await api.get(apiPath("/career-levels")));
}

/**
 * A senioridade pelo NOME que o dono usa no formulário (Júnior | Pleno |
 * Sênior). Ler o id do catálogo em vez de fixá-lo mantém a massa presa ao
 * que a instância tem, e não a um seed específico.
 */
export async function seniorityNamed(api: APIRequestContext, name: string): Promise<string> {
  const levels = await careerLevels(api);
  const level = levels.find((candidate) => candidate.name === name);
  if (!level) {
    throw new Error(
      `senioridade "${name}" não existe — níveis disponíveis: ${levels
        .map((candidate) => candidate.name)
        .join(", ")}`,
    );
  }
  return level.id;
}

export async function defineTeamRules(api: APIRequestContext, teamId: string): Promise<void> {
  const levels = await careerLevels(api);
  const competencies = (await unwrap<Competency[]>(await api.get(apiPath("/competencies")))).filter(
    (competency) => competency.active,
  );
  for (const level of levels) {
    await unwrap(
      await api.put(apiPath(`/teams/${teamId}/rules/${level.id}`), {
        data: {
          minimumQualifiedCapabilities: MINIMUM_QUALIFIED_CAPABILITIES,
          competencies: competencies.map((competency) => ({
            competencyId: competency.id,
            requiredLevel: Math.min(level.rank + 2, LEVEL_CEILING),
          })),
        },
      }),
    );
  }
}

export async function registerTeamWithRules(
  api: APIRequestContext,
  runId: string,
): Promise<string> {
  const teamId = await registerTeam(api, runId);
  await defineTeamRules(api, teamId);
  return teamId;
}

/**
 * ADMITIR a pessoa no time (ADR-0084): um POST, três escritas — conta,
 * profissional e vínculo de time. A conta nasce com senha temporária e
 * `mustChangePassword=true`, e a PRÓPRIA conta troca para `PASSWORD` numa
 * sessão isolada: reusar a sessão de quem cadastrou trocaria o cookie no
 * meio da fixture (Seção 24). Os testes de UI logam esperando o painel, não
 * a tela de troca obrigatória.
 */
export async function admitPersonToTeam(input: AdmissionInput): Promise<AdmittedPerson> {
  const admitted = await unwrap<{
    user: { id: string };
    architectId: string;
    temporaryPassword: string;
  }>(
    await input.api.post(apiPath("/auth/users"), {
      data: {
        name: input.name,
        email: input.email,
        role: input.role,
        teamId: input.teamId,
        ...(input.careerLevelId === undefined ? {} : { careerLevelId: input.careerLevelId }),
      },
    }),
  );

  const guest = await input.playwright.request.newContext({ baseURL: API_URL });
  await unwrap(
    await guest.post(apiPath("/auth/login"), {
      data: { email: input.email, password: admitted.temporaryPassword },
    }),
  );
  const changed = await guest.post(apiPath("/auth/change-password"), {
    data: { currentPassword: admitted.temporaryPassword, newPassword: PASSWORD },
  });
  if (!changed.ok()) {
    throw new Error(`troca de senha de ${input.email} falhou: ${changed.status()}`);
  }
  await guest.dispose();

  return { userId: admitted.user.id, architectId: admitted.architectId };
}

/**
 * Conta e profissional nascem juntos e SAEM juntos. A limpeza continua
 * direta no Postgres (não há rota de exclusão definitiva) e busca pelo
 * e-mail, que é o mesmo nos dois lados do cadastro unificado.
 *
 * O PROFISSIONAL sai primeiro, e a ordem é o que importa: o que ele deixou
 * para trás (sessão de mentoria, plano, transição) cai por cascata dele, e
 * várias dessas linhas referenciam a CONTA de quem registrou sem cascata
 * nenhuma. Apagar a conta antes bateria no RESTRICT — foi o que a ordem
 * inversa dos specs sempre evitou sem dizer.
 */
export async function dischargePeople(databaseUrl: string, emails: string[]): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`DELETE FROM architects WHERE email = ANY($1::text[])`, [emails]);
    await client.query(`DELETE FROM users WHERE email = ANY($1::text[])`, [emails]);
  } finally {
    await client.end();
  }
}

/**
 * Remover DEPOIS dos profissionais do spec: `architects.team_id` referencia o
 * time. O cache de roster expira em CACHE_TTL_SECONDS e o spec seguinte cria
 * gente nova pela API, que invalida.
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
