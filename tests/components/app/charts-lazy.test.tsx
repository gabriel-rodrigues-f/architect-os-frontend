import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CapabilityRadar } from "@/components/app/charts";
import { I18nProvider } from "@/lib/i18n";

/**
 * F1-BUNDLE — o recharts (412 kB) saía no caminho crítico de toda rota que
 * importa `charts`, inclusive para quem nunca vê gráfico. A carga passou a ser
 * preguiçosa; o contrato que isto protege é que a fatia preguiçosa é só o
 * desenho: a área do gráfico já nasce com a altura final (nada de salto de
 * layout) e a tabela equivalente — a alternativa textual acessível — continua
 * disponível de imediato, sem depender do chunk chegar.
 */
const dados = [
  { capability: "Integração", atual: 3, alvo: 4 },
  { capability: "Segurança", atual: 2, alvo: 4 },
];

describe("CapabilityRadar — recharts fora do primeiro render", () => {
  afterEach(cleanup);

  it("reserva a altura e serve a tabela equivalente antes do recharts carregar", async () => {
    const { container } = render(
      <I18nProvider>
        <CapabilityRadar data={dados} />
      </I18nProvider>,
    );

    expect(container.querySelector(".recharts-responsive-container")).toBeNull();

    const area = screen.getByRole("img");
    expect(area.style.height).toBe("320px");
    expect(screen.getByRole("columnheader", { name: "Capacidade" })).toBeTruthy();

    await waitFor(() =>
      expect(container.querySelector(".recharts-responsive-container")).not.toBeNull(),
    );

    expect(area.style.height).toBe("320px");
  });
});
