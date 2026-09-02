import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SectionCard } from "@/components/app/ui-bits";
import { I18nProvider } from "@/lib/i18n";

/**
 * Onda 32 — pedido literal do dono olhando /teams: "eu quero um botão para
 * mostrar / esconder; o mesmo vale para times cadastrados". Duas seções na
 * mesma tela = componente, não cópia: o recolher entra no `SectionCard`, que
 * 21 arquivos já usam, SEM mudar o comportamento de quem não pede
 * (`collapsible` ausente = como hoje, nem botão nem invólucro).
 *
 * As três invariantes de foco (DECISOES.md) valem aqui: o que escondeu sai da
 * árvore; o controle declara `aria-expanded` e `aria-controls`; e o nome
 * acessível diz sobre O QUÊ ele abre e fecha. Teclado e mouse nascem juntos.
 */
function renderCard(props: Partial<Parameters<typeof SectionCard>[0]> = {}) {
  return render(
    <I18nProvider>
      <SectionCard title="Times cadastrados" {...props}>
        <p>conteúdo da seção</p>
      </SectionCard>
    </I18nProvider>,
  );
}

const botaoDeEsconder = () => screen.getByRole("button", { name: "Esconder Times cadastrados" });
const botaoDeMostrar = () => screen.getByRole("button", { name: "Mostrar Times cadastrados" });

beforeEach(() => {
  try {
    window.localStorage.removeItem("synapse:section-open:teams.registry");
    window.localStorage.removeItem("synapse:section-open:teams.roster");
  } catch {
    return;
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SectionCard — sem `collapsible` nada muda para os 21 usos existentes", () => {
  it("não desenha botão de mostrar/esconder e mostra o conteúdo direto na região", () => {
    renderCard();
    expect(screen.getByText("conteúdo da seção")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    const regiao = screen.getByRole("region", { name: "Times cadastrados" });
    expect(regiao.querySelector(":scope > p")).toBeTruthy();
  });
});

describe("SectionCard recolhível — o botão do cabeçalho mostra e esconde", () => {
  it("nasce aberta, com o controle declarando o que controla", () => {
    renderCard({ collapsible: true });
    const botao = botaoDeEsconder();
    expect(botao.getAttribute("aria-expanded")).toBe("true");
    const alvo = botao.getAttribute("aria-controls");
    expect(alvo).toBeTruthy();
    expect(document.getElementById(alvo!)?.textContent).toContain("conteúdo da seção");
  });

  it("clicar esconde o conteúdo — fora da árvore, não só invisível — e clicar de novo mostra", async () => {
    renderCard({ collapsible: true });
    await userEvent.click(botaoDeEsconder());
    expect(screen.queryByText("conteúdo da seção")).toBeNull();
    expect(botaoDeMostrar().getAttribute("aria-expanded")).toBe("false");

    await userEvent.click(botaoDeMostrar());
    expect(screen.getByText("conteúdo da seção")).toBeTruthy();
  });

  it("pelo teclado: Enter esconde, Espaço mostra", async () => {
    renderCard({ collapsible: true });
    botaoDeEsconder().focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.queryByText("conteúdo da seção")).toBeNull();

    botaoDeMostrar().focus();
    await userEvent.keyboard(" ");
    expect(screen.getByText("conteúdo da seção")).toBeTruthy();
  });

  it("`defaultOpen: false` nasce recolhida", () => {
    renderCard({ collapsible: true, defaultOpen: false });
    expect(screen.queryByText("conteúdo da seção")).toBeNull();
    expect(botaoDeMostrar()).toBeTruthy();
  });

  it("a região continua anunciada pelo título mesmo recolhida", async () => {
    renderCard({ collapsible: true });
    await userEvent.click(botaoDeEsconder());
    expect(screen.getByRole("region", { name: "Times cadastrados" })).toBeTruthy();
  });
});

describe("SectionCard recolhível — o estado é lembrado por quem vê", () => {
  it("com `storageKey`, esconder é lembrado e a próxima montagem nasce recolhida", async () => {
    const primeira = renderCard({ collapsible: true, storageKey: "teams.registry" });
    await userEvent.click(botaoDeEsconder());
    primeira.unmount();

    renderCard({ collapsible: true, storageKey: "teams.registry" });
    expect(await screen.findByRole("button", { name: "Mostrar Times cadastrados" })).toBeTruthy();
    expect(screen.queryByText("conteúdo da seção")).toBeNull();
  });

  it("chaves diferentes não se misturam", async () => {
    const primeira = renderCard({ collapsible: true, storageKey: "teams.registry" });
    await userEvent.click(botaoDeEsconder());
    primeira.unmount();

    renderCard({ collapsible: true, storageKey: "teams.roster" });
    expect(screen.getByText("conteúdo da seção")).toBeTruthy();
  });

  it("sem `storageKey` nada é gravado", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderCard({ collapsible: true });
    await userEvent.click(botaoDeEsconder());
    expect(setItem).not.toHaveBeenCalled();
  });

  it("janela privativa: localStorage LANÇA e a seção funciona do mesmo jeito, aberta", async () => {
    const lerDeVerdade = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, chave) {
      if (chave.startsWith("synapse:section-open:")) throw new DOMException("SecurityError");
      return lerDeVerdade.call(this, chave);
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    renderCard({ collapsible: true, storageKey: "teams.registry" });
    expect(screen.getByText("conteúdo da seção")).toBeTruthy();
    await userEvent.click(botaoDeEsconder());
    expect(screen.queryByText("conteúdo da seção")).toBeNull();
    await userEvent.click(botaoDeMostrar());
    expect(screen.getByText("conteúdo da seção")).toBeTruthy();
  });
});
