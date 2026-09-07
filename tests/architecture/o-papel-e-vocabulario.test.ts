import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { TEAM_LEADERSHIP_ROLES, USER_ROLES, UserRoles } from "@/lib/gateways/auth.gateway";

/**
 * PR 5 (revisão mestre 2026-09-08, §4.2 RBAC-06) — o literal `"admin"` solto
 * em nove arquivos significava "quem opera o sistema" num lugar e "quem lê
 * tudo" noutro. Quando o banco ganhou o quinto papel (`support` é o antigo
 * admin; `admin` virou a diretoria), o frontend quebrou de uma vez: o
 * `/auth/me` chegava com `support` e nenhum ramo o reconhecia.
 *
 * A catraca espelha a do backend (`o-time-e-a-fonte-do-escopo.test.ts`): os
 * literais de papel de organização existem num ponto só, `auth.gateway.ts`,
 * e cada uso diz QUAL pergunta faz — `operatesTheSystem` ou
 * `readsTheOrganization`.
 */
const raizDoRepositorio = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIRETORIO_FONTE = join(raizDoRepositorio, "src");
const VOCABULARIO_DE_PAPEL = join("src", "lib", "gateways", "auth.gateway.ts");

const LITERAIS_DE_PAPEL_DE_ORGANIZACAO = ['"admin"', "'admin'", '"support"', "'support'"];

function arquivosDeCodigo(diretorio: string): string[] {
  return readdirSync(diretorio, { recursive: true, withFileTypes: true })
    .filter((entrada) => entrada.isFile() && /\.tsx?$/.test(entrada.name))
    .map((entrada) => relative(raizDoRepositorio, join(entrada.parentPath, entrada.name)))
    .sort();
}

describe("o papel é vocabulário, não literal (PR 5, RBAC-06)", () => {
  it("os literais admin/support só existem no ponto único UserRoles", () => {
    const infratores = arquivosDeCodigo(DIRETORIO_FONTE)
      .filter((arquivo) => arquivo !== VOCABULARIO_DE_PAPEL)
      .filter((arquivo) => {
        const conteudo = readFileSync(join(raizDoRepositorio, arquivo), "utf8");
        return LITERAIS_DE_PAPEL_DE_ORGANIZACAO.some((literal) => conteudo.includes(literal));
      });

    expect(infratores).toEqual([]);
    expect(readFileSync(join(raizDoRepositorio, VOCABULARIO_DE_PAPEL), "utf8")).toContain(
      'ORGANIZATION_ROLES = ["admin", "support"] as const',
    );
  });

  it("um vocabulário para os dois eixos: USER_ROLES é organização + liderança + member", () => {
    expect(USER_ROLES).toEqual(["admin", "support", ...TEAM_LEADERSHIP_ROLES, "member"]);
    expect([...UserRoles.ALL]).toEqual([
      UserRoles.ADMIN,
      UserRoles.SUPPORT,
      UserRoles.MANAGER,
      UserRoles.TECH_LEAD,
      UserRoles.MEMBER,
    ]);
  });

  it("quem opera o sistema é ADMIN e SUPPORT; quem lê a organização inteira é só ADMIN (adendo 2, 2026-09-08)", () => {
    expect(UserRoles.operatesTheSystem(UserRoles.ADMIN)).toBe(true);
    expect(UserRoles.operatesTheSystem(UserRoles.SUPPORT)).toBe(true);
    expect(UserRoles.operatesTheSystem(UserRoles.MANAGER)).toBe(false);
    expect(UserRoles.operatesTheSystem(UserRoles.TECH_LEAD)).toBe(false);
    expect(UserRoles.operatesTheSystem(UserRoles.MEMBER)).toBe(false);

    expect(UserRoles.readsTheOrganization(UserRoles.ADMIN)).toBe(true);
    expect(UserRoles.readsTheOrganization(UserRoles.SUPPORT)).toBe(false);
    expect(UserRoles.readsTheOrganization(UserRoles.MANAGER)).toBe(false);
  });

  it("SUPPORT não vê nem atribui ADMIN; ADMIN atribui todos; quem não opera o sistema não atribui papel", () => {
    expect([...UserRoles.assignableBy(UserRoles.ADMIN)]).toEqual([...USER_ROLES]);
    expect([...UserRoles.assignableBy(UserRoles.SUPPORT)]).toEqual([
      UserRoles.SUPPORT,
      UserRoles.MANAGER,
      UserRoles.TECH_LEAD,
      UserRoles.MEMBER,
    ]);
    expect([...UserRoles.assignableBy(UserRoles.MANAGER)]).toEqual([]);
  });
});
