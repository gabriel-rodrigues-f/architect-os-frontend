import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RequirementTypeBadge } from "@/components/app/RequirementTypeBadge";
import { I18nProvider } from "@/lib/i18n";

/**
 * Componente compartilhado da spec §6: a obrigatoriedade aparece no editor da
 * régua, nos faltantes do roteiro e na FOTO do item de avaliação. O rótulo em
 * palavra é o segundo canal além da cor — a decisão de acessibilidade da casa
 * (`DECISOES.md`): quem não distingue os tons lê "Obrigatória" e "Opcional".
 */
describe("RequirementTypeBadge", () => {
  afterEach(cleanup);

  it("diz OBRIGATÓRIA para a competência restritiva", () => {
    render(
      <I18nProvider>
        <RequirementTypeBadge requirementType="RESTRICTIVE" />
      </I18nProvider>,
    );

    expect(screen.getByText("Obrigatória")).toBeTruthy();
  });

  it("diz OPCIONAL para a competência não restritiva", () => {
    render(
      <I18nProvider>
        <RequirementTypeBadge requirementType="NON_RESTRICTIVE" />
      </I18nProvider>,
    );

    expect(screen.getByText("Opcional")).toBeTruthy();
  });

  it("distingue os dois no estilo sem estrear paleta nova — reusa os tons dos badges da casa", () => {
    const { container: obrigatoria } = render(
      <I18nProvider>
        <RequirementTypeBadge requirementType="RESTRICTIVE" />
      </I18nProvider>,
    );
    const { container: opcional } = render(
      <I18nProvider>
        <RequirementTypeBadge requirementType="NON_RESTRICTIVE" />
      </I18nProvider>,
    );

    const classesObrigatoria = obrigatoria.firstElementChild?.className ?? "";
    const classesOpcional = opcional.firstElementChild?.className ?? "";

    expect(classesObrigatoria).not.toBe(classesOpcional);
    expect(classesOpcional).toContain("bg-secondary");
    expect(classesObrigatoria).not.toMatch(/bg-level-\d/);
    expect(classesOpcional).not.toMatch(/bg-level-\d/);
  });
});
