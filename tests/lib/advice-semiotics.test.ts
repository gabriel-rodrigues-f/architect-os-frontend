import {
  Award,
  Calculator,
  ClipboardList,
  Compass,
  Handshake,
  Map,
  Paperclip,
  Ruler,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { describe, expect, it } from "vitest";

import { AdviceSemiotics, AiProgressEstimate } from "@/lib/advice-semiotics";

describe("AdviceSemiotics — o sinal (ícone lucide) ao lado do título", () => {
  it("aviso vence ação, ação vence contexto", () => {
    expect(AdviceSemiotics.iconFor("Riscos e próximos passos")).toBe(TriangleAlert);
    expect(AdviceSemiotics.iconFor("Próximos passos")).toBe(Target);
    expect(AdviceSemiotics.iconFor("Onde está a pessoa")).toBe(Compass);
  });

  it("ignora acento e caixa", () => {
    expect(AdviceSemiotics.iconFor("EVOLUÇÃO PERCEBIDA")).toBe(Award);
    expect(AdviceSemiotics.iconFor("Evidências que sustentam")).toBe(Paperclip);
  });

  it("título sem palavra conhecida fica sem sinal", () => {
    expect(AdviceSemiotics.iconFor("Considerações")).toBeNull();
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

describe("AdviceSemiotics.iconForFact — cada fato calculado leva o seu sinal (dono, 2026-09-06)", () => {
  it("lê a frase inteira e escolhe pelo assunto; sem assunto conhecido, o sinal de calculado", () => {
    expect(AdviceSemiotics.iconForFact("Não há avaliação registrada para esta pessoa.")).toBe(
      ClipboardList,
    );
    expect(AdviceSemiotics.iconForFact("Não há 1:1 registrada com esta pessoa.")).toBe(Handshake);
    expect(AdviceSemiotics.iconForFact("Não há PDI registrado para esta pessoa.")).toBe(Map);
    expect(AdviceSemiotics.iconForFact("Não há evidência registrada para esta pessoa.")).toBe(
      Paperclip,
    );
    expect(AdviceSemiotics.iconForFact("A régua do time exige 0 competências.")).toBe(Ruler);
    expect(
      AdviceSemiotics.iconForFact("Nenhuma competência da régua está abaixo do nível exigido."),
    ).toBe(TrendingDown);
    expect(
      AdviceSemiotics.iconForFact(
        "Não há degrau de competência registrado no histórico desta pessoa.",
      ),
    ).toBe(TrendingUp);
    expect(AdviceSemiotics.iconForFact("Qualquer outra coisa.")).toBe(Calculator);
  });
});
