import { describe, expect, it, vi } from "vitest";

import { StaleBundle } from "@/lib/stale-bundle";

/**
 * O BUILD NOVO DERRUBA A ABA VELHA (dono, 2026-09-10: "todas as rotas estão
 * com erro de carregamento"). A aba aberta antes do deploy guarda os nomes dos
 * pedaços de tela do build anterior; o servidor novo não os tem mais (404), e
 * toda navegação cai em "Esta página não carregou". O "Tentar novamente" só
 * revalidava o roteador — pedia de novo o mesmo arquivo morto.
 *
 * A regra: pedaço de tela que não baixa recarrega a página UMA vez; erro de
 * outra natureza não recarrega nada; e um segundo recarregamento seguido não
 * acontece — se o build novo também falhar, a tela de erro fica de pé.
 */
function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

describe("StaleBundle — a aba do build anterior se recarrega uma vez", () => {
  it("reconhece o pedaço de tela que não baixou, no texto de cada navegador", () => {
    expect(
      StaleBundle.isChunkLoadFailure(
        new TypeError("Failed to fetch dynamically imported module: http://x/assets/team-A1.js"),
      ),
    ).toBe(true);
    expect(
      StaleBundle.isChunkLoadFailure(new TypeError("error loading dynamically imported module")),
    ).toBe(true);
    expect(StaleBundle.isChunkLoadFailure(new TypeError("Importing a module script failed."))).toBe(
      true,
    );
  });

  it("erro de outra natureza não é pedaço de tela", () => {
    expect(StaleBundle.isChunkLoadFailure(new Error("Cannot read properties of undefined"))).toBe(
      false,
    );
    expect(StaleBundle.isChunkLoadFailure("texto solto")).toBe(false);
    expect(StaleBundle.isChunkLoadFailure(null)).toBe(false);
  });

  it("recarrega uma vez; o segundo pedido logo em seguida não recarrega", () => {
    const reload = vi.fn();
    const bundle = new StaleBundle(memoryStorage(), reload, () => 1_000);
    expect(bundle.reloadOnce()).toBe(true);
    expect(bundle.reloadOnce()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("passada a janela, um deploy novo volta a poder recarregar", () => {
    const reload = vi.fn();
    const storage = memoryStorage();
    let now = 1_000;
    const bundle = new StaleBundle(storage, reload, () => now);
    bundle.reloadOnce();
    now += StaleBundle.RELOAD_WINDOW_MS + 1;
    expect(bundle.reloadOnce()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("sem armazenamento (modo privado que recusa), ainda recarrega", () => {
    const reload = vi.fn();
    const refusing = {
      getItem: () => {
        throw new Error("negado");
      },
      setItem: () => {
        throw new Error("negado");
      },
    };
    expect(new StaleBundle(refusing, reload, () => 1).reloadOnce()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
