import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import pt from "@/locales/pt.json";
import { Route as CapabilityMapRoute } from "@/routes/capability-map";
import { Route as CompareRoute } from "@/routes/compare";

/**
 * Recomendação do PO (revisao-po-2026-08-30) sobre a fila visual do dono: o
 * nome de uma tela deve dizer a PERGUNTA que ela responde, e cada tela tem
 * UM nome. O Comparativo tinha três ("Comparativo do Time" no menu,
 * "Comparativo de Profissionais" no título, "Comparação entre Profissionais"
 * na ajuda); a Cobertura tinha dois e nenhum deles revelava que a pergunta é
 * de risco de concentração ("de quem o time depende").
 *
 * Sem esta rede, o nome volta a divergir no próximo toque — foi assim que
 * chegou a três.
 */

type Catalogo = Record<string, string>;

const catalogos: [string, Catalogo][] = [
  ["pt", pt as Catalogo],
  ["en", en as Catalogo],
];

const metaDe = (
  route: typeof CompareRoute | typeof CapabilityMapRoute,
  chave: "title" | "og:title",
): string | undefined => {
  const head = route.options.head as undefined | (() => { meta?: Record<string, string>[] });
  const meta = head?.().meta ?? [];
  if (chave === "title") return meta.find((tag) => tag["title"] !== undefined)?.["title"];
  return meta.find((tag) => tag["property"] === "og:title")?.["content"];
};

const NOMES_DE_TELA: {
  tela: string;
  chaves: string[];
  route: typeof CompareRoute | typeof CapabilityMapRoute;
}[] = [
  {
    tela: "Comparativo",
    chaves: [
      "compare.title",
      "cap.tabs.comparison",
      "help.compare.lead.title",
      "help.compare.member.title",
    ],
    route: CompareRoute,
  },
  {
    tela: "Cobertura",
    chaves: [
      "cap.title",
      "cap.tabs.coverage",
      "help.capabilityMap.lead.title",
      "help.capabilityMap.member.title",
    ],
    route: CapabilityMapRoute,
  },
];

describe("uma tela, um nome", () => {
  for (const { tela, chaves } of NOMES_DE_TELA) {
    for (const [idioma, catalogo] of catalogos) {
      it(`${tela} tem um nome só em ${idioma} — menu, título e ajuda`, () => {
        const nomes = chaves.map((chave) => catalogo[chave]);
        expect(new Set(nomes).size, `${tela} (${idioma}): ${nomes.join(" / ")}`).toBe(1);
      });
    }
  }

  for (const { tela, chaves, route } of NOMES_DE_TELA) {
    it(`${tela} usa o mesmo nome na aba do navegador`, () => {
      const nome = (pt as Catalogo)[chaves[0]!];
      expect(metaDe(route, "title")).toBe(`${nome} — Synapse`);
      expect(metaDe(route, "og:title")).toBe(`${nome} — Synapse`);
    });
  }

  it("a Cobertura se chama pela pergunta que responde, não pelo formato", () => {
    expect((pt as Catalogo)["cap.title"]).toBe("De quem o time depende");
    expect((en as Catalogo)["cap.title"]).toBe("Who the team depends on");
  });
});
