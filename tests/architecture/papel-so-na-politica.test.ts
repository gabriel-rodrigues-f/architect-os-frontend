import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ArquivoFonte, Varredura } from "../helpers/catraca";

/**
 * Revisão mestre 2026-09-08, [FA-04] — o RBAC da tela vivia duplicado fora de
 * `UiAuthorizationPolicy`: `user.role === "manager"` num view-model,
 * `isLeadCapable(user.role)` na ajuda e no catálogo, o gerente comparado à mão
 * no menu. A divisão ADMIN/SUPPORT precisou ser caçada em oito lugares.
 *
 * A régua: um PAPEL só é comparado dentro da política (`scope.ts`) e do
 * vocabulário (`auth.gateway.ts`). Todo o resto faz uma PERGUNTA nomeada —
 * `isLeadership`, `hasOwnCareerFile`, `managesTeam`, `teamsBoundAsOwnRole` —
 * ou consulta uma tabela por papel. Prova do vermelho no dia em que nasceu:
 * 19 ocorrências em 8 arquivos; a catraca não tem baseline porque zerou na
 * mesma fatia (PR 3, item 5).
 */
const PAPEL_COMPARADO_A_MAO = /\b(?:user|account|membership|actor)\.role\s*[!=]==/g;
const PAPEL_COMPARADO_AO_VOCABULARIO =
  /\brole\s*[!=]==\s*(?:UserRoles|TeamLeadershipRoles|TeamMemberRoles|ORGANIZATION_ROLES|TEAM_LEADERSHIP_ROLES|TEAM_MEMBER_ROLES)\b/g;
const ATALHO_MORTO = /\bisLeadCapable\b/g;

const POLITICA = join("src", "lib", "scope.ts");
const VOCABULARIO = join("src", "lib", "gateways", "auth.gateway.ts");

const contagem = () =>
  new Varredura().contagem(
    (arquivo: ArquivoFonte) =>
      arquivo.ocorrencias(PAPEL_COMPARADO_A_MAO) +
      arquivo.ocorrencias(PAPEL_COMPARADO_AO_VOCABULARIO) +
      arquivo.ocorrencias(ATALHO_MORTO),
    (arquivo) =>
      arquivo.eFonteDeTela && arquivo.caminho !== POLITICA && arquivo.caminho !== VOCABULARIO,
  );

describe("papel só na política — nenhum `role ===` fora de scope.ts e do vocabulário", () => {
  it("src/ não compara papel à mão fora da política", () => {
    expect(contagem()).toEqual({});
  });

  it("a régua enxerga as três formas: `user.role ===`, `role !== UserRoles.X` e `isLeadCapable`", () => {
    const amostra = new ArquivoFonte(
      "src/x.ts",
      [
        'if (user.role === "manager") {}',
        "if (membership.role !== TeamLeadershipRoles.MANAGER) {}",
        "const pode = isLeadCapable(user.role);",
        // O que NÃO conta: comparar dois valores de formulário, ou uma tabela por papel.
        "const changed = role !== user.role;",
        "const home = HOME_BY_ROLE[user.role];",
      ].join("\n"),
    );
    expect(
      amostra.ocorrencias(PAPEL_COMPARADO_A_MAO) +
        amostra.ocorrencias(PAPEL_COMPARADO_AO_VOCABULARIO) +
        amostra.ocorrencias(ATALHO_MORTO),
    ).toBe(4); // a segunda linha cai nas duas primeiras réguas — e é isso que a torna dupla
  });
});
