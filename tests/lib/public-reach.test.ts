import { describe, expect, it } from "vitest";

import { defaultPublicReach, PublicReach } from "@/lib/public-reach";

/**
 * O alcance público — quem escapa do `AuthGate` do `__root`.
 *
 * A concordância entre esta lista e a matriz de alcance é cobrada pela
 * catraca `tests/architecture/alcance-por-rota.test.ts`. O que se mede aqui é
 * a outra metade: a REGRA de comparação. Um prefixo frouxo aqui abriria em
 * silêncio tudo que pendurasse abaixo de uma rota pública, e nenhuma catraca
 * de declaração pegaria isso — as duas listas continuariam iguais.
 */
describe("o alcance público é exceção nomeada, não subárvore", () => {
  it("a rota do convite escapa do portão", () => {
    expect(defaultPublicReach.covers("/set-password")).toBe(true);
  });

  it("a barra no fim é o mesmo endereço", () => {
    expect(defaultPublicReach.covers("/set-password/")).toBe(true);
  });

  it("nada pendurado abaixo dela escapa junto", () => {
    expect(defaultPublicReach.covers("/set-password/qualquer-coisa")).toBe(false);
  });

  it("nada que só COMECE com o nome dela escapa junto", () => {
    expect(defaultPublicReach.covers("/set-password-de-outra-pessoa")).toBe(false);
  });

  it("o resto da aplicação continua atrás do portão", () => {
    for (const rota of ["/", "/users", "/team", "/settings", "/calibration"]) {
      expect(defaultPublicReach.covers(rota), rota).toBe(false);
    }
  });

  /**
   * Enquanto for UMA, a exceção é lida de cabeça por quem revisa. A segunda
   * rota pública é uma decisão de segurança, e ela passa por editar este
   * teste — que é o ponto.
   */
  it("há exatamente uma rota pública hoje", () => {
    expect(PublicReach.ROUTES).toEqual(["/set-password"]);
  });
});
