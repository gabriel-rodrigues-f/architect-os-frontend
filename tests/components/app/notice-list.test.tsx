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
 * O TEXTO DO AVISO É O LINK (dono, 2026-09-08): *"ao invés de mantermos um
 * texto 'Clique para visualizar', vamos inserir um hiperlink no próprio texto
 * descritivo da notificação. Se o usuário clicar na linha, apenas seta como
 * lido; se clicar no texto, seta como lida e navega."* Os dois gestos moram na
 * mesma linha, e o que este arquivo prende é que eles NÃO se disparam juntos.
 *
 * E a frase é montada AQUI, no idioma de quem lê (mesma data): o aviso chega
 * com o tipo e as peças, e é por isso que as asserções abaixo falam de
 * "Mentoria registrada para Ana Martins" sem que ninguém tenha mandado essa
 * string pelo fio.
 */
function notice(overrides: Partial<Notice>): Notice {
  return {
    id: "notice-1",
    eventType: "development-item.deadline-approaching",
    wording: { subjectName: "Ana Martins", tally: 3 },
    link: "/development-plans?professionalId=ana",
    occurredAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    readAt: null,
    professionalId: "ana",
    teamId: "team-integration",
    ...overrides,
  };
}

const FRASE_DO_PRAZO = "Faltam 3 dias para o prazo de um compromisso do PDI de Ana Martins";

describe("NoticeList", () => {
  afterEach(() => cleanup());

  const renderWith = (ui: React.ReactNode) => render(<I18nProvider>{ui}</I18nProvider>);

  it("mostra a frase composta, o tempo relativo e o ponto de não-lido quando readAt é nulo", () => {
    renderWith(
      <NoticeList
        notices={[notice({ readAt: null })]}
        unreadOf={(item) => item.readAt === null}
        onOpen={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    expect(screen.getByText(FRASE_DO_PRAZO)).toBeTruthy();
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

  it("o clique na LINHA entrega o aviso inteiro ao chamador — e só marca", async () => {
    const onOpen = vi.fn();
    const onNavigate = vi.fn();
    const alvo = notice({ id: "aviso-clicado" });
    renderWith(
      <NoticeList notices={[alvo]} unreadOf={() => true} onOpen={onOpen} onNavigate={onNavigate} />,
    );

    await userEvent.click(screen.getByText("há 2 horas"));

    expect(onOpen).toHaveBeenCalledWith(alvo);
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

describe("a linha traz a data ao lado do título", () => {
  afterEach(() => cleanup());

  it("mostra `frase - dd/mm/aaaa` sem cabeçalho de dia acima", () => {
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
    expect(screen.getByText("- 28/08/2026")).toBeTruthy();
    expect(screen.getByRole("link", { name: FRASE_DO_PRAZO })).toBeTruthy();
  });
});

describe("o hiperlink é o PRÓPRIO texto do aviso (dono, 2026-09-08)", () => {
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

  it("o texto 'Clique para visualizar' não existe mais em lugar nenhum da linha", () => {
    renderLinha({});
    expect(screen.queryByText("Clique para visualizar")).toBeNull();
  });

  it("é um link de verdade, com o destino do TIPO do aviso no href", () => {
    renderLinha({ eventType: "assessment.completed", professionalId: "ana" });
    const link = screen.getByRole("link", { name: "Avaliação de Ana Martins foi concluída" });
    expect(link.getAttribute("href")).toBe("/assessments?professionalId=ana");
  });

  it("clicar no texto navega para aquele destino — e o chamador recebe o aviso junto", async () => {
    const { onNavigate } = renderLinha({
      id: "aviso-do-link",
      eventType: "support.access-opened",
      professionalId: "bruno",
      wording: { subjectName: "Bruno Almeida" },
    });

    await userEvent.click(screen.getByRole("link"));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0]?.[1]).toBe("/professionals/bruno");
  });

  /**
   * A ARMADILHA QUE O DONO NOMEOU: "link dentro de linha clicável precisa
   * parar a propagação, senão os dois gestos disparam". Sem
   * `stopPropagation`, um clique no texto marcaria como lido DUAS vezes — uma
   * pelo link, outra pela linha que o contém.
   */
  it("clicar no texto não dispara também o clique da linha — a marcação não sai duas vezes", async () => {
    const { onNavigate, onOpen } = renderLinha({});

    await userEvent.click(screen.getByRole("link"));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("o link é alcançável por teclado: Tab chega nele e Enter o aciona", async () => {
    const { onNavigate } = renderLinha({});

    await userEvent.tab();

    expect(screen.getByRole("link")).toBe(document.activeElement);
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

  it("a caixa se nomeia pela FRASE do aviso que seleciona e avisa quem a marcou", async () => {
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
      name: `Selecionar aviso: ${FRASE_DO_PRAZO}`,
    });
    await userEvent.click(caixa);

    expect(onToggleSelection.mock.calls[0]?.[0]?.id).toBe("aviso-marcado");
  });
});
