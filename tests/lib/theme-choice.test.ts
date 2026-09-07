import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { PublicReach } from "@/lib/public-reach";
import { ThemeChoice } from "@/lib/theme-choice";
import { raizDoFrontend } from "../helpers/catraca";

/**
 * [FA-09] — o `<html>` saía do servidor sem classe e a página pintava clara
 * até o `ThemeProvider` hidratar: a piscada de tema. A escolha agora é um
 * objeto que o provedor e o script pré-paint leem igual; o script roda no
 * `<head>` antes do primeiro paint e força o escuro na porta (`PublicReach`).
 */
describe("ThemeChoice — a mesma decisão para o provedor e para o pré-paint", () => {
  it("lê a preferência salva; o que não é claro nem escuro é 'system'", () => {
    expect(ThemeChoice.parse("dark")).toBe("dark");
    expect(ThemeChoice.parse("light")).toBe("light");
    expect(ThemeChoice.parse("system")).toBe("system");
    expect(ThemeChoice.parse(null)).toBe("system");
    expect(ThemeChoice.parse("lixo")).toBe("system");
  });

  it("resolve 'system' pelo sistema; claro e escuro valem por si", () => {
    expect(ThemeChoice.resolve("system", true)).toBe("dark");
    expect(ThemeChoice.resolve("system", false)).toBe("light");
    expect(ThemeChoice.resolve("light", true)).toBe("light");
    expect(ThemeChoice.resolve("dark", false)).toBe("dark");
  });

  it("a primeira pintura: escuro na porta, a preferência fora dela", () => {
    const publicReach = new PublicReach();
    expect(
      ThemeChoice.firstPaint({
        stored: "light",
        prefersDark: false,
        pathname: "/set-password",
        publicReach,
      }),
    ).toBe("dark");
    expect(
      ThemeChoice.firstPaint({ stored: "light", prefersDark: true, pathname: "/", publicReach }),
    ).toBe("light");
    expect(ThemeChoice.firstPaint({ stored: null, prefersDark: true, pathname: "/team" })).toBe(
      "dark",
    );
  });
});

describe("o script pré-paint", () => {
  const original = window.matchMedia;
  const prefersDark = (matches: boolean) => {
    window.matchMedia = ((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  };
  const roda = (pathname: string) => {
    window.history.replaceState({}, "", pathname);
    new Function(ThemeChoice.preambleScript())();
    return document.documentElement.classList.contains("dark");
  };

  afterEach(() => {
    window.matchMedia = original;
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
    window.history.replaceState({}, "", "/");
  });

  it("é JavaScript puro, sem módulo nem bundler, e lê as chaves da casa", () => {
    const script = ThemeChoice.preambleScript();
    expect(script).not.toContain("import ");
    expect(script).not.toContain("export ");
    expect(script).toContain(ThemeChoice.STORAGE_KEY);
    expect(script).toContain(ThemeChoice.LEGACY_STORAGE_KEY);
    expect(script).toContain("/set-password");
  });

  it("com 'dark' salvo, escurece antes do paint; com 'light', não", () => {
    prefersDark(false);
    window.localStorage.setItem(ThemeChoice.STORAGE_KEY, "dark");
    expect(roda("/")).toBe(true);
    window.localStorage.setItem(ThemeChoice.STORAGE_KEY, "light");
    expect(roda("/")).toBe(false);
  });

  it("sem preferência salva, segue o sistema; a chave legada ainda vale", () => {
    prefersDark(true);
    expect(roda("/team")).toBe(true);
    prefersDark(false);
    window.localStorage.setItem(ThemeChoice.LEGACY_STORAGE_KEY, "dark");
    expect(roda("/team")).toBe(true);
  });

  it("na porta (rota pública) é sempre escuro, mesmo com 'light' salvo", () => {
    prefersDark(false);
    window.localStorage.setItem(ThemeChoice.STORAGE_KEY, "light");
    expect(roda("/set-password")).toBe(true);
    expect(roda("/set-password/")).toBe(true);
  });

  it("o __root embute o script no head — e o CSP já admite script embutido", () => {
    const root = readFileSync(join(raizDoFrontend, "src", "routes", "__root.tsx"), "utf8");
    expect(root).toContain("scripts: [{ children: ThemeChoice.preambleScript() }]");
    const start = readFileSync(join(raizDoFrontend, "src", "start.ts"), "utf8");
    expect(start).toContain("script-src 'self' 'unsafe-inline'");
  });
});
