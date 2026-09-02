import { describe, expect, it } from "vitest";

import { filterNavGroups, NAV_GROUPS } from "@/components/app/AppShell";
import type { SessionUser } from "@/lib/api";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
  fixtureMemberUser,
  fixtureUnassignedTechLeadUser,
} from "../../helpers/fixtures";

/**
 * Onda 31 — o item "Times" do grupo Administração. Nasceu com a flag
 * emprestada da régua (`teamRuleReachOnly`) e `nav-do-profissional` reprovou
 * na hora: o tech lead com vínculo passava a ver o grupo Administração. O
 * alcance do item é o do quadro — administrador e GESTOR DESIGNADO — e este
 * arquivo fixa as duas pontas para o empréstimo não voltar.
 */
const destinos = (user: SessionUser | undefined): string[] =>
  filterNavGroups(NAV_GROUPS, user).flatMap((grupo) => grupo.items.map((item) => item.to));

describe("menu — o item Times alcança quem compõe o quadro", () => {
  it("aparece para o administrador e para o gestor com vínculo de gestor", () => {
    expect(destinos(fixtureAdminUser)).toContain("/teams");
    expect(destinos(fixtureAssignedManagerUser)).toContain("/teams");
  });

  it("não aparece para member, nem para tech lead — com ou sem vínculo", () => {
    expect(destinos(fixtureMemberUser)).not.toContain("/teams");
    expect(destinos(fixtureUnassignedTechLeadUser)).not.toContain("/teams");
    expect(destinos(fixtureAssignedTechLeadUser)).not.toContain("/teams");
    expect(destinos(undefined)).not.toContain("/teams");
  });
});
