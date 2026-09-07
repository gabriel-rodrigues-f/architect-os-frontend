import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatCard, StatTones } from "@/components/app/ui-bits";
import { I18nProvider } from "@/lib/i18n";

/**
 * Pedido do dono (2026-09-05): "Gráficos e big number precisam ter cor,
 * precisamos começar a retocar isso para sermos mais claros." Oito cartões
 * iguais faziam "Distâncias críticas: 7" pesar o mesmo que "Profissionais:
 * 5". O tom é decidido por quem sabe o que o número significa — fila vazia é
 * bom, fila cheia pede atenção, severidade é crítica — e o cartão o publica.
 */
describe("StatCard — o big number carrega um tom", () => {
  afterEach(cleanup);

  it("fila: zero é bom, qualquer pendência pede atenção", () => {
    expect(StatTones.byPending(0)).toBe("good");
    expect(StatTones.byPending(3)).toBe("attention");
  });

  it("severidade: zero é bom, qualquer ocorrência é crítica", () => {
    expect(StatTones.bySeverity(0)).toBe("good");
    expect(StatTones.bySeverity(1)).toBe("critical");
  });

  it("o cartão publica o tom, e o neutro continua sendo o padrão", () => {
    render(
      <I18nProvider>
        <StatCard label="Profissionais" value={5} />
        <StatCard label="Distâncias críticas" value={7} tone="critical" />
      </I18nProvider>,
    );
    expect(
      screen.getByText("Profissionais").closest("[data-tone]")?.getAttribute("data-tone"),
    ).toBe("neutral");
    expect(
      screen.getByText("Distâncias críticas").closest("[data-tone]")?.getAttribute("data-tone"),
    ).toBe("critical");
  });
});
