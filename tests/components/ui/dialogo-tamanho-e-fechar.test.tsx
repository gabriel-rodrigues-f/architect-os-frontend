import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { I18nProvider } from "@/lib/i18n";
import en from "@/locales/en.json";
import pt from "@/locales/pt.json";

/**
 * Revisão mestre 2026-09-08, [F-04] e [M-01]: o diálogo não tinha tamanho
 * nomeado (512 por padrão, 672 copiado à mão em 6 rotas, `max-h` 85vh ou
 * 90vh conforme o autor) e o botão de fechar dizia "Close" em inglês, em
 * `sr-only`, fora do alcance da catraca de idioma. Agora `size="sm|md|lg"`
 * (400/512/672) com rolagem interna sempre, o nome do botão vem do i18n
 * (`dialog.close` — "Fechar janela", para não colidir com o "Fechar" que um
 * rodapé de diálogo já tem) e o foco dele é o anel da casa por `focus-visible`. A
 * sombra é o token `--elevation-overlay` — o que flutua lê o token.
 */
function Traduzido({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

function dialogo(size?: "sm" | "md" | "lg") {
  render(
    <Traduzido>
      <Dialog open>
        <DialogContent {...(size ? { size } : {})}>
          <DialogTitle>Título</DialogTitle>
        </DialogContent>
      </Dialog>
    </Traduzido>,
  );
  return screen.getByRole("dialog");
}

describe("DialogContent — tamanhos nomeados e botão de fechar da casa", () => {
  afterEach(cleanup);

  it("md é o padrão (512) e sm/lg são 400 e 672, sempre com rolagem interna", () => {
    expect(dialogo().className).toContain("max-w-lg");
    cleanup();
    expect(dialogo("sm").className).toContain("max-w-[400px]");
    cleanup();
    expect(dialogo("lg").className).toContain("max-w-2xl");
    cleanup();
    for (const size of ["sm", "md", "lg"] as const) {
      const classe = dialogo(size).className;
      expect(classe, size).toContain("max-h-[85vh]");
      expect(classe, size).toContain("overflow-y-auto");
      cleanup();
    }
  });

  it("o botão de fechar tem nome em português e o anel por focus-visible", () => {
    dialogo();
    const fechar = screen.getByRole("button", { name: "Fechar janela" });
    expect(fechar.className).toContain("focus-visible:focus-ring");
    expect(fechar.className).not.toMatch(/(?<![\w-])focus:/);
  });

  it("a chave `dialog.close` existe nos dois idiomas, distinta do 'Fechar' de rodapé", () => {
    expect(pt["dialog.close"]).toBe("Fechar janela");
    expect(en["dialog.close"]).toBe("Close dialog");
  });

  it("flutua com o token de elevação de overlay, não com a sombra do framework", () => {
    const classe = dialogo().className;
    expect(classe).toContain("shadow-(--elevation-overlay)");
    expect(classe).not.toMatch(/\bshadow-(?:sm|md|lg|xl)\b/);
  });
});

describe("SheetContent — os mesmos tamanhos e o mesmo botão", () => {
  afterEach(cleanup);

  it("o painel lateral aceita size e fecha em português", () => {
    render(
      <Traduzido>
        <Sheet open>
          <SheetContent size="lg">
            <SheetTitle>Painel</SheetTitle>
          </SheetContent>
        </Sheet>
      </Traduzido>,
    );
    const painel = screen.getByRole("dialog");
    expect(painel.className).toContain("sm:max-w-lg");
    expect(painel.className).toContain("shadow-(--elevation-overlay)");
    expect(screen.getByRole("button", { name: "Fechar janela" }).className).toContain(
      "focus-visible:focus-ring",
    );
  });
});
