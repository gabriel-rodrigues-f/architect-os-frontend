import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginScreen } from "@/components/app/LoginScreen";
import { apiPath } from "@/lib/api-path";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { Bloco, folhaDeEstilo } from "../../helpers/folha-de-estilo";
import { jsonResponse } from "../../helpers/render-app";

/**
 * O ritmo do cartão (terceira avaliação de UX, 2026-09-07): 32 no topo,
 * Entrar → 8 → texto de apoio → 28 → rótulo → 8 → campo → 20 → rótulo → 8 →
 * campo → 16 → botão → 16 → Esqueci → 28 na base. Borda menos visível,
 * sombra ampla e baixa, CTA com três estados, "Esqueci" com mais contraste,
 * ícone de senha com área de clique ≥ 32×32.
 */
const fetchMock = vi.fn();

function LoginWrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>{children}</AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

async function abrir() {
  fetchMock.mockImplementation((url: string) => {
    if (String(url).endsWith(apiPath("/auth/status"))) {
      return Promise.resolve(jsonResponse({ data: { hasUsers: true } }));
    }
    return Promise.resolve(jsonResponse({ error: "Unauthorized" }, 401));
  });
  render(
    <LoginWrapper>
      <LoginScreen />
    </LoginWrapper>,
  );
  return screen.findByRole("button", { name: "Entrar" });
}

function pixels(valor: string | null): number {
  const match = /^([\d.]+)(px|rem)$/.exec(valor ?? "");
  if (!match) return Number.NaN;
  return match[2] === "rem" ? Number(match[1]) * 16 : Number(match[1]);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Login — o ritmo vertical do cartão", () => {
  it("32 no topo e 28 na base", () => {
    const cartao = Bloco.de("@utility auth-card");
    expect(pixels(cartao.valorDe("padding"))).toBe(32);
    expect(pixels(cartao.valorDe("padding-block-end"))).toBe(28);
  });

  it("Entrar → 8 → apoio → 28 → campos a 20 entre si, rótulo a 8 do campo → 16 → botão → 16 → Esqueci", async () => {
    const botao = await abrir();
    const titulo = screen.getByRole("heading", { level: 1 });
    const apoio = titulo.nextElementSibling as HTMLElement;
    expect(apoio.className).toMatch(/\bmt-2\b/);
    const form = botao.closest("form")!;
    expect(form.className).toMatch(/\bmt-7\b/);
    const campos = screen.getByLabelText("E-mail").closest("[data-testid='auth-fields']")!;
    expect(campos.className).toMatch(/\bspace-y-5\b/);
    const grupo = screen.getByLabelText("E-mail").parentElement!;
    expect(grupo.className).toMatch(/\bspace-y-1\.5\b/);
    expect(Bloco.de("@utility auth-field").declara("margin-top", "2px")).toBe(true);
    expect(botao.className).toMatch(/\bmt-4\b/);
    const esqueci = screen.getByRole("button", { name: "Esqueci minha senha" });
    expect(esqueci.className).toMatch(/\bmt-4\b/);
  });
});

describe("Login — borda, sombra e estados", () => {
  it("a borda é 10–20% menos visível e a sombra é ampla, difusa e baixa, sem glow", () => {
    const cartao = Bloco.de("@utility auth-card");
    const borda = /var\(--color-border\)\s+(\d+)%,\s*transparent/.exec(
      cartao.valorDe("border") ?? "",
    );
    expect(borda).not.toBeNull();
    expect(Number(borda![1])).toBeGreaterThanOrEqual(80);
    expect(Number(borda![1])).toBeLessThanOrEqual(90);
    const sombra = cartao.valorDe("box-shadow") ?? "";
    const partes = /^0\s+(\d+)px\s+(\d+)px\s+(-?\d+)px/.exec(sombra);
    expect(partes).not.toBeNull();
    expect(Number(partes![2])).toBeGreaterThanOrEqual(64);
    expect(Number(partes![3])).toBeLessThan(0);
    expect(sombra).not.toContain("var(--primary)");
  });

  it("o CTA tem três estados: default um degrau menos saturado, hover mais claro, active mais escuro", () => {
    const padrao = Bloco.de(".auth-cta:not(:disabled)");
    expect(padrao.existe).toBe(true);
    expect(padrao.contem("var(--primary)")).toBe(true);
    expect(padrao.contem("oklch(0.55 0 0)")).toBe(true);
    const hover = Bloco.de(".auth-cta:hover:not(:disabled)");
    expect(hover.contem("var(--primary) 86%, white")).toBe(true);
    const active = Bloco.de(".auth-cta:active:not(:disabled)");
    expect(active.existe).toBe(true);
    const escuro = /var\(--primary\)\s+(\d+)%,\s*black/.exec(
      active.valorDe("background-color") ?? "",
    );
    expect(escuro).not.toBeNull();
    expect(Number(escuro![1])).toBeGreaterThanOrEqual(94);
    expect(Number(escuro![1])).toBeLessThanOrEqual(96);
    expect(folhaDeEstilo.indexOf(".auth-cta:active:not(:disabled) {")).toBeGreaterThan(
      folhaDeEstilo.indexOf(".auth-cta:hover:not(:disabled) {"),
    );
  });

  it("'Esqueci minha senha' ganha 5–10% de contraste e mantém hover e foco", () => {
    const link = Bloco.de(".auth-link {");
    expect(link.existe).toBe(true);
    const cor = /var\(--color-muted-foreground\)\s+(\d+)%,\s*var\(--color-foreground\)/.exec(
      link.valorDe("color") ?? "",
    );
    expect(cor).not.toBeNull();
    expect(Number(cor![1])).toBeGreaterThanOrEqual(75);
    expect(Number(cor![1])).toBeLessThanOrEqual(85);
    const utility = Bloco.de("@utility auth-link");
    expect(utility.contem("&:hover")).toBe(true);
    expect(utility.contem("&:focus-visible")).toBe(true);
  });

  it("o ícone de mostrar senha tem área de clique de pelo menos 32×32", async () => {
    await abrir();
    const olho = screen.getByRole("button", { name: "Mostrar senha" });
    expect(olho.className).toMatch(/\binset-y-0\b/);
    expect(olho.className).toMatch(/\bw-(10|11|12)\b/);
    expect(olho.className).toMatch(/\bmin-h-8\b/);
  });
});
