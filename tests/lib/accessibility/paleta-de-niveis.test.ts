import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { DICHROMACIES, SEPARATION, separationUnder } from "@/lib/accessibility";
import { DarkTheme, LightTheme, Oklch, tokenRegistry } from "@/lib/design";
import { LEVELS } from "@/lib/domain";

/**
 * ONDA22/paleta-de-niveis — pedido do dono, literal: "eu não quero que vc
 * mantenha esse fundo xadrez / diagonal. verifique quais cores já estão em uso
 * na aplicação e utilize uma paleta de cores padronizada, sem xadrez ou
 * listras."
 *
 * A hachura que saiu não era enfeite: ela era o SEGUNDO CANAL da escala. A
 * paleta anterior punha os cinco níveis na mesma claridade (0,90) e separava
 * só por matiz — 25, 65, 110, 165, 195 —, e 110/165/195 caem justamente na
 * faixa que a dicromacia vermelho-verde comprime. Medido com o simulador
 * deste projeto, os cinco níveis ficavam assim ANTES desta fatia (ΔE OKLab
 * ×100, pela pior de protanopia/deuteranopia; piso = 6):
 *
 *   tema claro   1-2 = 3,65   2-3 = 0,26   3-4 = 4,79   4-5 = 3,68
 *   tema escuro  1-2 = 2,53   2-3 = 0,19   3-4 = 3,49   4-5 = 2,56
 *
 * Nenhum par passava. O 2-3 era praticamente a MESMA cor. Tirar a hachura sem
 * mexer na paleta teria entregado uma escala que só quem enxerga os dois
 * canais de cor consegue ler.
 *
 * Por isso a paleta nova não separa por matiz: ela varia CLARIDADE, CROMA e
 * MATIZ juntos e de forma monotônica — nível 1 é o mais lavado, nível 5 o mais
 * saturado. Onde o matiz colapsa sob dicromacia, a claridade sustenta o par.
 * Este arquivo é a prova, e é ele que impede a próxima mão de voltar a
 * empilhar os cinco níveis numa faixa só de claridade.
 *
 * O nível 0 ("sem dado") fica de fora dos pares porque não é degrau da escala:
 * é o zero dela, neutro e mais recessivo que o nível 1 nos dois temas, e a
 * célula o anuncia por escrito com um travessão em vez de um dígito.
 */

const temas = [new LightTheme(), new DarkTheme()];
const niveis = LEVELS.map(({ level }) => level);
const faixaDoNivel = (level: number) => tokenRegistry.get(`level-${String(level)}`)!;
const tintaDoNivel = (level: number) => tokenRegistry.get(`level-${String(level)}-fg`)!;

describe("a escala de níveis se separa sem depender da hachura", () => {
  it("todo par adjacente passa do piso de separação, nos dois temas, sob cada dicromacia", () => {
    for (const tema of temas) {
      for (let passo = 0; passo < niveis.length - 1; passo++) {
        const umNivel = niveis[passo]!;
        const outroNivel = niveis[passo + 1]!;
        const uma = tema.resolve(faixaDoNivel(umNivel));
        const outra = tema.resolve(faixaDoNivel(outroNivel));

        for (const deficiency of DICHROMACIES) {
          expect(
            separationUnder(uma, outra, deficiency),
            `níveis ${String(umNivel)} e ${String(outroNivel)} no tema ${tema.id} sob ${deficiency}`,
          ).toBeGreaterThan(SEPARATION.floor);
        }
      }
    }
  });

  /**
   * O par não adjacente é o caso fácil — se ele afrouxar, a escala deixou de
   * ser rampa e virou vaivém.
   */
  it("níveis distantes se separam ainda mais do que os vizinhos", () => {
    for (const tema of temas) {
      const distanciaEntre = (umNivel: number, outroNivel: number) =>
        Math.min(
          ...DICHROMACIES.map((deficiency) =>
            separationUnder(
              tema.resolve(faixaDoNivel(umNivel)),
              tema.resolve(faixaDoNivel(outroNivel)),
              deficiency,
            ),
          ),
        );

      expect(distanciaEntre(1, 5), `extremos no tema ${tema.id}`).toBeGreaterThan(
        distanciaEntre(1, 2),
      );
      expect(distanciaEntre(1, 5), `extremos no tema ${tema.id}`).toBeGreaterThan(
        distanciaEntre(4, 5),
      );
    }
  });
});

describe("a escala é uma rampa de três sinais, não um leque de matizes", () => {
  /**
   * No claro a faixa escurece conforme o nível sobe; no escuro ela clareia. Os
   * dois sentidos dizem a mesma coisa: quanto maior o nível, mais a faixa se
   * afasta do papel.
   */
  it("a claridade anda sempre no mesmo sentido dentro de cada tema", () => {
    for (const tema of temas) {
      const claridades = niveis.map((level) => tema.resolve(faixaDoNivel(level)).l);
      const sentido = tema.id === "light" ? -1 : 1;

      for (let passo = 1; passo < claridades.length; passo++) {
        expect(
          (claridades[passo]! - claridades[passo - 1]!) * sentido,
          `níveis ${String(niveis[passo - 1])} → ${String(niveis[passo])} no tema ${tema.id}: ${claridades.map((valor) => valor.toFixed(3)).join(", ")}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("o croma cresce com o nível — o 1 é o mais lavado, o 5 o mais saturado", () => {
    for (const tema of temas) {
      const cromas = niveis.map((level) => tema.resolve(faixaDoNivel(level)).c);

      for (let passo = 1; passo < cromas.length; passo++) {
        expect(
          cromas[passo]! - cromas[passo - 1]!,
          `níveis ${String(niveis[passo - 1])} → ${String(niveis[passo])} no tema ${tema.id}: ${cromas.map((valor) => valor.toFixed(3)).join(", ")}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  /**
   * "Paleta padronizada", também literal do dono. Cada matiz da escala é o
   * matiz de um token que a aplicação já usa: 25 = `gap-critical`, 95 =
   * `gap-low`, 155 = `gap-ok`, 195 = `accent`/`sidebar-primary`, 235 =
   * `primary`. Sem esta cláusula a escala volta a inventar cor própria.
   */
  it("todo matiz da escala é o matiz de uma cor que a aplicação já usa", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
    const forasteiros = [...css.matchAll(/--([\w-]+):\s*(oklch\([^)]*\));/g)]
      .filter(([, nome]) => !/^level-/.test(nome!))
      .map(([, , valor]) => Oklch.parse(valor!))
      .filter((cor) => cor.c > 0.01)
      .map((cor) => cor.h);

    for (const level of niveis) {
      const matiz = faixaDoNivel(level).light.h;
      expect(
        forasteiros.some((outro) => Math.abs(outro - matiz) < 1),
        `level-${String(level)} usa o matiz ${String(matiz)}, que nenhuma outra cor da aplicação usa`,
      ).toBe(true);
    }
  });
});

/**
 * As faixas de nível declaram `darkOverride` — o escuro delas é desenho
 * próprio, não a transformação genérica de `fill`, porque a lógica inverte.
 * Isso as tira das duas checagens de `design-tokens`, que pulam quem tem
 * override. As duas voltam aqui, escritas para a escala.
 */
describe("o tema escuro reescreve a escala sem trair o matiz", () => {
  const claro = new LightTheme();
  const escuro = new DarkTheme();

  it("cada nível mantém o matiz nos dois temas, faixa e tinta", () => {
    for (const level of niveis) {
      for (const token of [faixaDoNivel(level), tintaDoNivel(level)]) {
        expect(escuro.resolve(token).h, token.name).toBeCloseTo(claro.resolve(token).h);
      }
    }
  });

  it("nenhuma faixa vibra mais no escuro do que no claro", () => {
    for (const level of niveis) {
      const token = faixaDoNivel(level);
      expect(escuro.resolve(token).c, token.name).toBeLessThanOrEqual(claro.resolve(token).c);
    }
  });

  it("a faixa do nível 0 é neutra e mais recessiva que a do nível 1", () => {
    const zero = tokenRegistry.get("level-0")!;
    expect(zero.light.c).toBeLessThan(0.01);

    expect(claro.resolve(zero).l).toBeGreaterThan(claro.resolve(faixaDoNivel(1)).l);
    expect(escuro.resolve(zero).l).toBeLessThan(escuro.resolve(faixaDoNivel(1)).l);
  });
});
