import { describe, expect, it } from "vitest";

import { PontoDoEixo } from "@/lib/design";

/**
 * Pedido do dono (2026-09-03), olhando o radar: *"vamos melhorar a margem
 * entre o gráfico e as letras. quero uma margem um pouco maior, pouca coisa,
 * apenas pra que as letras não encostem no gráfico. coisa de 2, 3 px"*.
 *
 * O recharts entrega o ponto do rótulo colado na borda do polígono. Afastar
 * em x ou em y daria folga desigual: no eixo de cima o rótulo subiria, no da
 * direita não sairia do lugar. A folga é do RAIO — a mesma distância nos doze
 * lados —, e é isso que estes testes prendem.
 */
describe("PontoDoEixo — a folga é do raio, não do eixo x ou y", () => {
  const centro = { x: 100, y: 100 };

  it("afasta 3 px na horizontal quando o eixo aponta para a direita", () => {
    const [posX, posY] = PontoDoEixo.afastadoDoCentro(180, 100, centro.x, centro.y, 3);

    expect([posX, posY]).toEqual([183, 100]);
  });

  it("afasta 3 px na vertical quando o eixo aponta para cima", () => {
    const [posX, posY] = PontoDoEixo.afastadoDoCentro(100, 20, centro.x, centro.y, 3);

    expect([posX, posY]).toEqual([100, 17]);
  });

  it("na diagonal, a distância percorrida continua sendo a folga pedida", () => {
    const antes = { x: 160, y: 160 };
    const [posX, posY] = PontoDoEixo.afastadoDoCentro(antes.x, antes.y, centro.x, centro.y, 3);

    expect(Math.hypot(posX - antes.x, posY - antes.y)).toBeCloseTo(3, 10);
    expect(Math.hypot(posX - centro.x, posY - centro.y)).toBeCloseTo(
      Math.hypot(antes.x - centro.x, antes.y - centro.y) + 3,
      10,
    );
  });

  it("sem centro — o recharts ainda não mediu — devolve o ponto como veio", () => {
    expect(PontoDoEixo.afastadoDoCentro(180, 100, undefined, undefined, 3)).toEqual([180, 100]);
  });

  it("no próprio centro não há direção para onde afastar", () => {
    expect(PontoDoEixo.afastadoDoCentro(100, 100, centro.x, centro.y, 3)).toEqual([100, 100]);
  });
});
