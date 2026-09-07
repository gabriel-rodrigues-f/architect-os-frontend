import { afterEach, describe, expect, it } from "vitest";

import { BrowserMemory } from "@/lib/browser-memory";
import { SidebarPreferences } from "@/lib/sidebar-preferences";

/**
 * [FA-05] — as preferências da coluna (recolhida, largura, grupos fechados)
 * eram seis `setItem` soltos no `AppShell`; agora são UM objeto sobre a
 * `BrowserMemory`, com a chave legada migrada e a largura sempre no intervalo.
 */
describe("SidebarPreferences", () => {
  afterEach(() => window.localStorage.clear());

  const prefs = new SidebarPreferences();

  it("recolhida: nasce aberta, lembra o que foi escolhido, lê a chave legada", () => {
    expect(prefs.collapsed).toBe(false);
    prefs.rememberCollapsed(true);
    expect(prefs.collapsed).toBe(true);
    window.localStorage.clear();
    window.localStorage.setItem(SidebarPreferences.LEGACY_COLLAPSED_KEY, "true");
    expect(prefs.collapsed).toBe(true);
    expect(window.localStorage.getItem(SidebarPreferences.COLLAPSED_KEY)).toBe("true");
  });

  it("largura: `null` quando nunca foi escolhida; o valor salvo volta dentro do intervalo", () => {
    expect(prefs.chosenWidth).toBeNull();
    prefs.rememberWidth(300);
    expect(prefs.chosenWidth).toBe(300);
    window.localStorage.setItem(SidebarPreferences.WIDTH_KEY, "9999");
    expect(prefs.chosenWidth).toBe(SidebarPreferences.MAX_WIDTH);
    window.localStorage.setItem(SidebarPreferences.WIDTH_KEY, "12");
    expect(prefs.chosenWidth).toBe(SidebarPreferences.MIN_WIDTH);
    window.localStorage.setItem(SidebarPreferences.WIDTH_KEY, "abc");
    expect(prefs.chosenWidth).toBeNull();
  });

  it("grupos fechados: conjunto vazio sem nada salvo; lembra, esquece, e ignora lixo", () => {
    expect(prefs.collapsedGroups.size).toBe(0);
    prefs.rememberCollapsedGroups(new Set(["nav.group.development"]));
    expect([...prefs.collapsedGroups]).toEqual(["nav.group.development"]);
    prefs.forgetCollapsedGroups();
    expect(prefs.collapsedGroups.size).toBe(0);
    window.localStorage.setItem(SidebarPreferences.COLLAPSED_GROUPS_KEY, "{nope");
    expect(prefs.collapsedGroups.size).toBe(0);
  });

  it("com o storage bloqueado, nada lança e as leituras caem no padrão", () => {
    const bloqueadas = new SidebarPreferences(
      new BrowserMemory(() => {
        throw new Error("SecurityError");
      }),
    );
    expect(() => bloqueadas.rememberCollapsed(true)).not.toThrow();
    expect(() => bloqueadas.rememberWidth(300)).not.toThrow();
    expect(() => bloqueadas.rememberCollapsedGroups(new Set(["x"]))).not.toThrow();
    expect(bloqueadas.collapsed).toBe(false);
    expect(bloqueadas.chosenWidth).toBeNull();
    expect(bloqueadas.collapsedGroups.size).toBe(0);
  });
});
