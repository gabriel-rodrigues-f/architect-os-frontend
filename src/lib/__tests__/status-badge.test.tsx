import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "@/components/app/ui-bits";

/**
 * R2-VIS-01 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — status de avaliação e
 * papel de usuário pegavam emprestado `bg-level-*`, o vocabulário de
 * proficiência (`LevelBadge`). `StatusBadge` tem paleta própria (`status-*`,
 * `tokens.ts`), sem relação com nível de competência.
 */
describe("StatusBadge — paleta de estado própria, sem tokens de proficiência", () => {
  it("cada tom usa a classe de fundo correspondente, nunca bg-level-*", () => {
    const tones = ["neutral", "progress", "done"] as const;
    for (const tone of tones) {
      const { container, unmount } = render(<StatusBadge tone={tone} label={`rótulo-${tone}`} />);
      const badge = container.querySelector("span");
      expect(badge?.className, tone).toContain(`bg-status-${tone}`);
      expect(badge?.className, tone).not.toMatch(/bg-level-\d/);
      unmount();
    }
  });

  it("mostra o rótulo recebido", () => {
    render(<StatusBadge tone="done" label="Concluída" />);
    expect(screen.getByText("Concluída")).toBeTruthy();
  });
});
