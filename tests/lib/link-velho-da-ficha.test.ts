import { describe, expect, it } from "vitest";

import { LegacyProfessionalLink } from "@/lib/legacy-professional-links";

/**
 * ADR-0096 — o link velho da ficha aponta, não morre.
 *
 * O backend perdeu o caminho velho da API de uma vez (quebra assumida, backend
 * e frontend sobem juntos); a barra de endereço, não. Quem tem o link velho da
 * ficha de alguém salvo não participou da renomeação, e devolver 404 seria
 * cobrar dele uma decisão nossa.
 *
 * O que precisa ficar provado aqui não é "existe um redirecionamento", e sim
 * que ele só reescreve o PRIMEIRO SEGMENTO: id, aba, query e âncora viajam
 * intactos — um redirecionamento que perde a aba manda a pessoa para o lugar
 * errado com cara de acerto. E que ele não morde caminho que apenas COMEÇA com
 * as mesmas letras.
 */
const ANTIGO = "/architects";

describe("link velho da ficha — o caminho antigo aponta para /professionals", () => {
  it("reescreve só o primeiro segmento e preserva id, aba, query e âncora", () => {
    expect(LegacyProfessionalLink.redirectFor(`${ANTIGO}/abc-123`)).toBe("/professionals/abc-123");
    expect(LegacyProfessionalLink.redirectFor(`${ANTIGO}/abc-123/evolution`)).toBe(
      "/professionals/abc-123/evolution",
    );
    expect(LegacyProfessionalLink.redirectFor(`${ANTIGO}/abc-123/statement?ciclo=2026-01`)).toBe(
      "/professionals/abc-123/statement?ciclo=2026-01",
    );
    expect(LegacyProfessionalLink.redirectFor(`${ANTIGO}/abc-123/roadmap#trilha`)).toBe(
      "/professionals/abc-123/roadmap#trilha",
    );
  });

  it("aponta também o caminho sem id — a lista velha vai para a lista nova", () => {
    expect(LegacyProfessionalLink.redirectFor(ANTIGO)).toBe("/professionals");
  });

  it("não morde caminho que apenas COMEÇA com as mesmas letras", () => {
    expect(LegacyProfessionalLink.redirectFor(`${ANTIGO}omething`)).toBeNull();
    expect(LegacyProfessionalLink.redirectFor("/architecture")).toBeNull();
  });

  it("deixa passar o endereço novo e as demais rotas — nada de laço de redirecionamento", () => {
    expect(LegacyProfessionalLink.redirectFor("/professionals/abc-123")).toBeNull();
    expect(LegacyProfessionalLink.redirectFor("/")).toBeNull();
    expect(LegacyProfessionalLink.redirectFor("/teams")).toBeNull();
  });
});
