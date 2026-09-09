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
 *
 * Dono (2026-09-08) acrescentou três coisas à linha, e todas são provadas
 * aqui: o hiperlink "Clique para visualizar" (que NAVEGA e marca), o clique
 * na linha (que SÓ marca) e a data ao lado do título — a que saiu do
 * cabeçalho de grupo.
 */
function notice(overrides: Partial<Notice>): Notice {
  return {
    id: "notice-1",
    eventType: "development-item.deadline-approaching",
    title: "Item de PDI vence em 3 dias",
    link: "/development-plans?professionalId=ana",
    occurredAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    readAt: null,
    professionalId: "ana",
    teamId: "team-integration",
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
        onNavigate={() => undefined}
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
        onNavigate={() => undefined}
      />,
    );
    expect(screen.queryByLabelText("Não lido")).toBeNull();
  });

  it("clique entrega o aviso inteiro ao chamador", async () => {
    const onOpen = vi.fn();
    const alvo = notice({ id: "aviso-clicado" });
    renderWith(
      <NoticeList
        notices={[alvo]}
        unreadOf={() => true}
        onOpen={onOpen}
        onNavigate={() => undefined}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Item de PDI/ }));
    expect(onOpen).toHaveBeenCalledWith(alvo);
  });
});

describe("a linha traz a data ao lado do título", () => {
  afterEach(() => cleanup());

  it("mostra `título - dd/mm/aaaa` sem cabeçalho de dia acima", () => {
    render(
      <I18nProvider>
        <NoticeList
          notices={[notice({ occurredAt: "2026-08-28T15:00:00.000Z" })]}
          unreadOf={() => true}
          onOpen={() => undefined}
          onNavigate={() => undefined}
        />
      </I18nProvider>,
    );
    const linha = screen.getByRole("button", { name: /Item de PDI/ });
    expect(linha.textContent).toContain("Item de PDI vence em 3 dias - 28/08/2026");
  });
});

describe("o hiperlink de destino, em toda linha", () => {
  afterEach(() => cleanup());

  const renderLinha = (overrides: Partial<Notice>, onNavigate = vi.fn(), onOpen = vi.fn()) => {
    render(
      <I18nProvider>
        <NoticeList
          notices={[notice(overrides)]}
          unreadOf={() => true}
          onOpen={onOpen}
          onNavigate={onNavigate}
        />
      </I18nProvider>,
    );
    return { onNavigate, onOpen };
  };

  it("é um link de verdade, com o destino do TIPO do aviso no href", () => {
    renderLinha({ eventType: "assessment.completed", professionalId: "ana" });
    const link = screen.getByRole("link", { name: "Clique para visualizar" });
    expect(link.getAttribute("href")).toBe("/assessments?professionalId=ana");
  });

  it("clicar no link navega para aquele destino — e o chamador recebe o aviso junto", async () => {
    const { onNavigate } = renderLinha({
      id: "aviso-do-link",
      eventType: "support.access-opened",
      professionalId: "bruno",
    });
    await userEvent.click(screen.getByRole("link", { name: "Clique para visualizar" }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0]?.[1]).toBe("/professionals/bruno");
  });

  /** Botão dentro de botão não existe: o link é IRMÃO da linha, não filho. */
  it("clicar no link não dispara também o clique da linha — a marcação não sai duas vezes", async () => {
    const { onNavigate, onOpen } = renderLinha({});
    await userEvent.click(screen.getByRole("link", { name: "Clique para visualizar" }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("o link é alcançável por teclado: Tab chega nele e Enter o aciona", async () => {
    const { onNavigate } = renderLinha({});
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole("link", { name: "Clique para visualizar" })).toBe(
      document.activeElement,
    );
    await userEvent.keyboard("{Enter}");
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});

describe("a seleção da linha", () => {
  afterEach(() => cleanup());

  it("sem as duas mãos da seleção, a linha não tem caixa nenhuma", () => {
    render(
      <I18nProvider>
        <NoticeList
          notices={[notice({})]}
          unreadOf={() => true}
          onOpen={() => undefined}
          onNavigate={() => undefined}
        />
      </I18nProvider>,
    );
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("a caixa se nomeia pelo aviso que seleciona e avisa quem a marcou", async () => {
    const onToggleSelection = vi.fn();
    render(
      <I18nProvider>
        <NoticeList
          notices={[notice({ id: "aviso-marcado" })]}
          unreadOf={() => true}
          onOpen={() => undefined}
          onNavigate={() => undefined}
          selectedOf={() => false}
          onToggleSelection={onToggleSelection}
        />
      </I18nProvider>,
    );
    const caixa = screen.getByRole("checkbox", {
      name: "Selecionar aviso: Item de PDI vence em 3 dias",
    });
    await userEvent.click(caixa);
    expect(onToggleSelection.mock.calls[0]?.[0]?.id).toBe("aviso-marcado");
  });
});
