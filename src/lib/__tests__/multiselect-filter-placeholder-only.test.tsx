import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MultiSelectFilter } from "@/components/app/MultiSelectFilter";
import { I18nProvider } from "../i18n";

/**
 * R3-007 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — bug relatado pela dona do
 * produto: com um único arquiteto sem especialização cadastrada,
 * `specializationOptions`/`capabilityOptions` (`team-shared.tsx`) tinham
 * exatamente UMA entrada — a opção-placeholder sintética ("Sem
 * especialização"/"Sem capacidade") que dá um id filtrável pra quem não tem
 * o campo real preenchido. Uma tentativa anterior de correção checava
 * `options.length === 0`, que nunca disparava aqui (o array genuinamente
 * tem um item, só que não é uma escolha real). O campo aparecia habilitado,
 * como se houvesse algo de verdade pra filtrar.
 *
 * A correção marca a opção sintética com `isPlaceholder: true` e recalcula
 * `isEmpty` como "nenhuma opção real" (`options.filter((o) =>
 * !o.isPlaceholder).length === 0`) — só placeholder deve se comportar
 * IGUAL a nenhuma opção: campo desabilitado, mensagem de vazio no lugar do
 * resumo, não "todas as opções reais desmarcadas".
 */
describe("MultiSelectFilter — só opção-placeholder equivale a vazio", () => {
  afterEach(() => cleanup());

  it("com só a opção-placeholder, o campo fica desabilitado e mostra a mensagem de vazio", () => {
    render(
      <I18nProvider>
        <MultiSelectFilter
          id="team-filter-specialization"
          label="Especialização"
          options={[
            { id: "__no-specialization__", label: "Sem especialização", isPlaceholder: true },
          ]}
          selected={["__no-specialization__"]}
          onChange={vi.fn()}
          selectAllLabel="Todas"
          allSummaryLabel="Todas selecionadas"
          noneSummaryLabel="Nenhuma"
          emptyLabel="Nenhuma especialização cadastrada."
        />
      </I18nProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Especialização" }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
    expect(trigger.textContent).toContain("Nenhuma especialização cadastrada.");
    // Nunca deveria ter mostrado o resumo de "tudo selecionado" pra uma
    // opção que não é uma escolha real.
    expect(trigger.textContent).not.toContain("Todas selecionadas");
  });

  it("com opções reais AO LADO do placeholder, o campo continua habilitado e o placeholder é selecionável", () => {
    render(
      <I18nProvider>
        <MultiSelectFilter
          id="team-filter-specialization"
          label="Especialização"
          options={[
            { id: "arch-1", label: "Arquitetura de Dados" },
            { id: "__no-specialization__", label: "Sem especialização", isPlaceholder: true },
          ]}
          selected={["arch-1", "__no-specialization__"]}
          onChange={vi.fn()}
          selectAllLabel="Todas"
          allSummaryLabel="Todas selecionadas"
          noneSummaryLabel="Nenhuma"
          emptyLabel="Nenhuma especialização cadastrada."
        />
      </I18nProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Especialização" }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(false);
    expect(trigger.textContent).toContain("Todas selecionadas");
  });
});
