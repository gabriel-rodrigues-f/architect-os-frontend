import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginScreen } from "@/components/app/LoginScreen";
import { apiPath } from "@/lib/api-path";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { Bloco } from "../../helpers/folha-de-estilo";
import { jsonResponse } from "../../helpers/render-app";

/**
 * Refino da composição do login (2026-09-07). O dono: "a distância entre
 * branding e forms e o fato de estarem nas extremidades me incomoda". Nada
 * de redesenho: um container central com largura máxima, um grid de duas
 * colunas com gap limitado e o centro visual um pouco acima do meio; o
 * cartão em 460, o CTA no azul da identidade, o erro mais suave e a frase
 * da casa em três linhas. Tudo sem hack de posição absoluta.
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

function servico(recusa = "E-mail ou senha inválidos.") {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const href = String(url);
    if (href.endsWith(apiPath("/auth/status"))) {
      return Promise.resolve(jsonResponse({ data: { hasUsers: true } }));
    }
    if (href.endsWith(apiPath("/auth/login")) && init?.method === "POST") {
      return Promise.resolve(jsonResponse({ code: "INVALID_CREDENTIALS", message: recusa }, 401));
    }
    return Promise.resolve(jsonResponse({ error: "Unauthorized" }, 401));
  });
}

async function abrir() {
  render(
    <LoginWrapper>
      <LoginScreen />
    </LoginWrapper>,
  );
  return screen.findByRole("button", { name: "Entrar" });
}

/** `oklch(L C H)` → os três números; `null` se não for um oklch literal. */
function oklch(valor: string | null): { l: number; c: number; h: number } | null {
  const match = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(valor ?? "");
  if (!match) return null;
  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]) };
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

describe("Login — a composição: container central e grid de duas colunas", () => {
  it("o conteúdo vive num container central com largura máxima; a rede fica fora dele, na viewport inteira", async () => {
    servico();
    await abrir();
    const palco = screen.getByTestId("auth-stage");
    expect(palco.classList.contains("auth-stage")).toBe(true);
    const rede = screen.getByTestId("synapse-network");
    expect(palco.contains(rede)).toBe(false);
    expect(rede.parentElement?.contains(palco)).toBe(true);
  });

  it("o container tem max-width 1188 (10% mais ao centro, dono 2026-09-07), margem automática e respiro lateral por clamp", () => {
    const bloco = Bloco.de("@utility auth-stage");
    expect(bloco.existe).toBe(true);
    expect(bloco.declara("max-width", "1188px")).toBe(true);
    expect(bloco.declara("margin-inline", "auto")).toBe(true);
    expect(bloco.declara("width", "calc(100% - clamp(64px, 10vw, 96px))")).toBe(true);
  });

  it("o grid: 1.1fr / minmax(400px, 0.9fr), gap limitado, alinhado ao centro — nunca space-between", async () => {
    servico();
    await abrir();
    const grade = screen.getByTestId("auth-grid");
    expect(grade.classList.contains("auth-grid")).toBe(true);
    const bloco = Bloco.de("@utility auth-grid");
    expect(bloco.declara("grid-template-columns", "minmax(0, 1.1fr) minmax(400px, 0.9fr)")).toBe(
      true,
    );
    expect(bloco.declara("gap", "clamp(58px, 6.3vw, 108px)")).toBe(true);
    expect(bloco.declara("align-items", "center")).toBe(true);
    expect(bloco.contem("space-between")).toBe(false);
  });

  it("o centro visual fica acima do meio: o respiro de baixo é maior que o de cima", () => {
    const bloco = Bloco.de("@utility auth-grid");
    const cima = bloco.valorDe("padding-block-start");
    const baixo = bloco.valorDe("padding-block-end");
    expect(cima).not.toBeNull();
    expect(baixo).not.toBeNull();
    expect(cima).not.toBe(baixo);
  });

  it("nenhum hack absoluto: marca e cartão são filhos do grid, sem position, translate ou margem negativa", async () => {
    servico();
    await abrir();
    const grade = screen.getByTestId("auth-grid");
    const marca = screen.getByRole("region", { name: "Synapse" });
    const cartao = screen.getByTestId("auth-card");
    expect(marca.parentElement).toBe(grade);
    expect(cartao.parentElement).toBe(grade);
    for (const bloco of [grade, marca, cartao]) {
      const classes = bloco.className;
      expect(classes).not.toMatch(/\babsolute\b|\bfixed\b|translate-|-m[trblxy]?-|justify-between/);
    }
  });
});

describe("Login — o cartão e os campos", () => {
  it("o cartão tem 460 de largura (ou 100%), com 32 a 36 px de padding", async () => {
    servico();
    await abrir();
    const cartao = screen.getByTestId("auth-card");
    expect(cartao.classList.contains("auth-card")).toBe(true);
    const bloco = Bloco.de("@utility auth-card");
    expect(bloco.declara("width", "min(460px, 100%)")).toBe(true);
    const padding = pixels(bloco.valorDe("padding"));
    expect(padding).toBeGreaterThanOrEqual(32);
    expect(padding).toBeLessThanOrEqual(36);
  });

  it("os campos têm 44 a 48 px de altura e o foco é um anel do primário de 3 px a 8%", () => {
    const bloco = Bloco.de("@utility auth-field");
    const altura = pixels(bloco.valorDe("height"));
    expect(altura).toBeGreaterThanOrEqual(44);
    expect(altura).toBeLessThanOrEqual(48);
    // O anel mora FORA da camada de utilities: `Input` traz `focus-visible:ring-1`,
    // emitido depois na mesma camada — dentro do @utility o anel nunca chegaria à tela.
    const foco = Bloco.de(".auth-field:focus-visible");
    expect(foco.existe).toBe(true);
    // A largura do halo é o token `--focus-ring-width` (3px) — o mesmo da utility `focus-ring` ([A-01]).
    expect(foco.valorDe("box-shadow")?.replace(/\s+/g, " ")).toBe(
      "0 0 0 var(--focus-ring-width) color-mix(in oklch, var(--color-primary) 8%, transparent)",
    );
    expect(Bloco.de(":root {").valorDe("--focus-ring-width")).toBe("3px");
  });

  it("o 'Esqueci minha senha' fica logo abaixo do botão, sem sobra vertical (16 px, ritmo de 2026-09-07)", async () => {
    servico();
    await abrir();
    const esqueci = screen.getByRole("button", { name: "Esqueci minha senha" });
    expect(esqueci.className).toMatch(/\bmt-4\b/);
    expect(esqueci.className).not.toMatch(/\bmt-[5-9]\b/);
  });
});

describe("Login — CTA, erro e a frase da casa", () => {
  it("o CTA Entrar é o primário — e o primário do tema escuro é o azul da identidade, sem a cena redefinir nada", async () => {
    servico();
    const botao = await abrir();
    expect(botao.classList.contains("bg-primary")).toBe(true);
    expect(botao.classList.contains("auth-cta")).toBe(true);
    // [P-01]: o azul vem do `.dark`; `auth-stage` não sobrescreve token de cor.
    expect(Bloco.de("@utility auth-stage").contem("--primary")).toBe(false);
    const palco = Bloco.de("\n.dark {");
    const primario = oklch(palco.valorDe("--primary"));
    expect(primario).not.toBeNull();
    expect(primario!.c).toBeGreaterThan(0.08);
    expect(primario!.h).toBeGreaterThan(215);
    expect(primario!.h).toBeLessThan(260);
    expect(primario!.l).toBeLessThan(0.75);
    const texto = oklch(palco.valorDe("--primary-foreground"));
    expect(texto!.l).toBeGreaterThan(0.95);
  });

  it("o hover do CTA é o mesmo azul um degrau mais luminoso, com o texto claro — nunca clareia até o branco (dono, 2026-09-07)", () => {
    // Mesmo motivo do anel: `Button` traz `hover:bg-primary/90`; o hover vive sem camada.
    const hover = Bloco.de(".auth-cta:hover:not(:disabled)");
    expect(hover.existe).toBe(true);
    expect(hover.contem("var(--primary) 86%, white")).toBe(true);
    expect(hover.declara("color", "var(--primary-foreground)")).toBe(true);
    expect(hover.contem("var(--color-foreground)")).toBe(false);
  });

  it("o erro é suave: classe própria, ícone discreto, e não recebe foco", async () => {
    servico();
    const botao = await abrir();
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ana@company.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "segredo" } });
    fireEvent.click(botao);
    const alerta = await screen.findByRole("alert");
    expect(alerta.classList.contains("auth-alert")).toBe(true);
    expect(alerta.hasAttribute("tabindex")).toBe(false);
    const icone = alerta.querySelector("svg");
    expect(icone?.getAttribute("aria-hidden")).toBe("true");
    expect(alerta.textContent).toBe("E-mail ou senha inválidos.");
    const bloco = Bloco.de("@utility auth-alert");
    expect(bloco.existe).toBe(true);
    expect(bloco.contem("var(--color-destructive)")).toBe(true);
    expect(bloco.contem("border")).toBe(true);
    expect(bloco.contem("bg-destructive/10")).toBe(false);
  });
});
