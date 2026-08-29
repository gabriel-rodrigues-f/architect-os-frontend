import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AdherenceSummary } from "@/components/app/AdherenceSummary";
import { I18nProvider } from "@/lib/i18n";

/**
 * CONTRATO (Cálculo de aderência): "Sempre DOIS números, nunca um" — a % diz
 * quão perto, o segundo campo diz quantas obrigatórias faltam. Colapsar os
 * dois produziria "85% pronto" para quem não atende um obrigatório. Este
 * componente é o guardião visual da regra: os dois números saem juntos, em
 * QUALQUER estado, inclusive quando não falta nenhuma.
 */
describe("AdherenceSummary", () => {
  afterEach(() => cleanup());

  const renderWith = (ui: React.ReactNode) => render(<I18nProvider>{ui}</I18nProvider>);

  it("mostra a porcentagem E a contagem de obrigatórias faltantes — nunca um só", () => {
    renderWith(<AdherenceSummary label="Nível atual · Pleno" percentage={85} missingCount={2} />);
    expect(screen.getByText("85%")).toBeTruthy();
    expect(screen.getByText("Faltam 2 competências obrigatórias")).toBeTruthy();
  });

  it("com 1 faltante a frase concorda em número", () => {
    renderWith(<AdherenceSummary label="Próximo nível" percentage={92} missingCount={1} />);
    expect(screen.getByText("Falta 1 competência obrigatória")).toBeTruthy();
  });

  it("sem faltantes o segundo número continua visível — zero é informação, não ausência", () => {
    renderWith(<AdherenceSummary label="Próximo nível" percentage={100} missingCount={0} />);
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText("Nenhuma competência obrigatória faltando")).toBeTruthy();
  });

  it("a porcentagem exibida é arredondada, mas a barra recebe o valor cru", () => {
    renderWith(<AdherenceSummary label="Nível atual" percentage={66.7} missingCount={3} />);
    expect(screen.getByText("67%")).toBeTruthy();
  });
});
