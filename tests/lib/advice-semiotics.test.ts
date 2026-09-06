import { describe, expect, it } from "vitest";

import { AdviceSemiotics, AiProgressEstimate } from "@/lib/advice-semiotics";

describe("AdviceSemiotics — o sinal ao lado do título", () => {
  it("aviso vence ação, ação vence contexto", () => {
    expect(AdviceSemiotics.emojiFor("Riscos e próximos passos")).toBe("⚠️");
    expect(AdviceSemiotics.emojiFor("Próximos passos")).toBe("🎯");
    expect(AdviceSemiotics.emojiFor("Onde está a pessoa")).toBe("🧭");
  });

  it("ignora acento e caixa", () => {
    expect(AdviceSemiotics.emojiFor("EVOLUÇÃO PERCEBIDA")).toBe("💪");
    expect(AdviceSemiotics.emojiFor("Evidências que sustentam")).toBe("📎");
  });

  it("título sem palavra conhecida fica sem sinal", () => {
    expect(AdviceSemiotics.emojiFor("Considerações")).toBeNull();
  });
});

describe("AiProgressEstimate — a barra enquanto o provedor escreve", () => {
  it("começa em zero, sobe rápido e nunca chega a 100 sozinha", () => {
    expect(AiProgressEstimate.percentAt(0)).toBe(0);
    const at3s = AiProgressEstimate.percentAt(3_000);
    const at10s = AiProgressEstimate.percentAt(10_000);
    expect(at3s).toBeGreaterThan(15);
    expect(at10s).toBeGreaterThan(at3s);
    expect(AiProgressEstimate.percentAt(60_000)).toBe(95);
  });

  it("a mensagem acompanha o relógio", () => {
    expect(AiProgressEstimate.stageAt(1_000)).toBe("reading");
    expect(AiProgressEstimate.stageAt(5_000)).toBe("writing");
    expect(AiProgressEstimate.stageAt(20_000)).toBe("finishing");
  });
});

describe("AdviceSemiotics.emojiForFact — cada fato calculado leva o seu sinal (dono, 2026-09-06)", () => {
  it("lê a frase inteira e escolhe pelo assunto; sem assunto conhecido, o sinal de calculado", () => {
    expect(AdviceSemiotics.emojiForFact("Não há avaliação registrada para esta pessoa.")).toBe(
      "📝",
    );
    expect(AdviceSemiotics.emojiForFact("Não há 1:1 registrada com esta pessoa.")).toBe("🤝");
    expect(AdviceSemiotics.emojiForFact("Não há PDI registrado para esta pessoa.")).toBe("🗺️");
    expect(AdviceSemiotics.emojiForFact("Não há evidência registrada para esta pessoa.")).toBe(
      "📎",
    );
    expect(AdviceSemiotics.emojiForFact("A régua do time exige 0 competências.")).toBe("📏");
    expect(
      AdviceSemiotics.emojiForFact("Nenhuma competência da régua está abaixo do nível exigido."),
    ).toBe("📉");
    expect(
      AdviceSemiotics.emojiForFact(
        "Não há degrau de competência registrado no histórico desta pessoa.",
      ),
    ).toBe("📈");
    expect(AdviceSemiotics.emojiForFact("Qualquer outra coisa.")).toBe("🧮");
  });
});
