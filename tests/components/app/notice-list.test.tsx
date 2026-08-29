import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoticeList } from "@/components/app/NoticeList";
import type { Notice } from "@/lib/gateways/notices.gateway";
import { I18nProvider } from "@/lib/i18n";

/**
 * Tela 2 — NoticeList/NoticeItem são COMPARTILHADOS entre o dropdown do sino
 * e a página /notices (regra 6 satisfeita no nascimento). O ponto de não-lido
 * é o segundo canal além da cor (decisão de acessibilidade do repositório), e
 * o clique entrega o aviso inteiro ao chamador — quem navega e marca lido é a
 * tela, o componente não conhece rota nem gateway.
 */
function notice(overrides: Partial<Notice>): Notice {
  return {
    id: "aviso-1",
    eventType: "pdi.item.dueSoon",
    title: "Item de PDI vence em 3 dias",
    link: "/development-plans?architectId=ana",
    occurredAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    readAt: null,
    architectId: "ana",
    teamId: "time-integracao",
    ...overrides,
  };
}

describe("NoticeList", () => {
  afterEach(() => cleanup());

  const renderWith = (ui: React.ReactNode) => render(<I18nProvider>{ui}</I18nProvider>);

  it("mostra título, tempo relativo e o ponto de não-lido quando readAt é nulo", () => {
    renderWith(
      <NoticeList
        notices={[notice({ readAt: null })]}
        unreadOf={(item) => item.readAt === null}
        onOpen={() => undefined}
      />,
    );
    expect(screen.getByText("Item de PDI vence em 3 dias")).toBeTruthy();
    expect(screen.getByText("há 2 horas")).toBeTruthy();
    expect(screen.getByLabelText("Não lido")).toBeTruthy();
  });

  it("aviso lido não leva o ponto", () => {
    renderWith(
      <NoticeList
        notices={[notice({ readAt: "2026-08-28T10:00:00.000Z" })]}
        unreadOf={(item) => item.readAt === null}
        onOpen={() => undefined}
      />,
    );
    expect(screen.queryByLabelText("Não lido")).toBeNull();
  });

  it("clique entrega o aviso inteiro ao chamador", async () => {
    const onOpen = vi.fn();
    const alvo = notice({ id: "aviso-clicado" });
    renderWith(<NoticeList notices={[alvo]} unreadOf={() => true} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: /Item de PDI/ }));
    expect(onOpen).toHaveBeenCalledWith(alvo);
  });
});
