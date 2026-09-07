import { BrowserMemory, browserMemory } from "./browser-memory";

/**
 * AS PREFERÊNCIAS DA COLUNA — recolhida, largura e grupos fechados — num
 * objeto só, sobre a `BrowserMemory` ([FA-05]). Antes eram seis `setItem`
 * soltos no `AppShell`, mais `readMigratedItem` e `CollapsedNavGroups`
 * espalhados em três arquivos: o mesmo mecanismo em seis lugares e nenhum
 * protegido contra o navegador que recusa escrever.
 *
 * As larguras têm limite aqui, e não na tela: um valor salvo por uma versão
 * antiga (ou editado à mão) nunca sai do intervalo em que o menu é legível.
 */
export class SidebarPreferences {
  static readonly COLLAPSED_KEY = "synapse:sidebar-collapsed";
  static readonly LEGACY_COLLAPSED_KEY = "architect-os:sidebar-collapsed";
  static readonly WIDTH_KEY = "synapse:sidebar-width";
  static readonly LEGACY_WIDTH_KEY = "architect-os:sidebar-width";
  static readonly COLLAPSED_GROUPS_KEY = "synapse:nav-collapsed-groups";

  static readonly DEFAULT_WIDTH = 264;
  static readonly MIN_WIDTH = 208;
  static readonly MAX_WIDTH = 420;
  static readonly RAIL_WIDTH = 64;

  constructor(private readonly memory: BrowserMemory = browserMemory) {}

  static clampWidth(value: number): number {
    return Math.min(SidebarPreferences.MAX_WIDTH, Math.max(SidebarPreferences.MIN_WIDTH, value));
  }

  get collapsed(): boolean {
    return (
      this.memory.read(
        SidebarPreferences.COLLAPSED_KEY,
        SidebarPreferences.LEGACY_COLLAPSED_KEY,
      ) === "true"
    );
  }

  rememberCollapsed(collapsed: boolean): void {
    this.memory.write(SidebarPreferences.COLLAPSED_KEY, String(collapsed));
  }

  /** A largura escolhida pela pessoa, já dentro do intervalo — ou `null` se ela nunca escolheu. */
  get chosenWidth(): number | null {
    const salva = Number(
      this.memory.read(SidebarPreferences.WIDTH_KEY, SidebarPreferences.LEGACY_WIDTH_KEY),
    );
    return Number.isFinite(salva) && salva > 0 ? SidebarPreferences.clampWidth(salva) : null;
  }

  rememberWidth(width: number): void {
    this.memory.write(SidebarPreferences.WIDTH_KEY, String(SidebarPreferences.clampWidth(width)));
  }

  get collapsedGroups(): Set<string> {
    const raw = this.memory.read(SidebarPreferences.COLLAPSED_GROUPS_KEY);
    if (!raw) return new Set();
    try {
      const lista: unknown = JSON.parse(raw);
      return new Set(
        Array.isArray(lista)
          ? lista.filter((item): item is string => typeof item === "string")
          : [],
      );
    } catch {
      return new Set();
    }
  }

  rememberCollapsedGroups(groups: ReadonlySet<string>): void {
    this.memory.write(SidebarPreferences.COLLAPSED_GROUPS_KEY, JSON.stringify([...groups]));
  }

  /**
   * O login esquece os grupos fechados: na primeira abertura depois de entrar,
   * todos nascem abertos (dono, 2026-09-06 — "Configuração nasceu escondido").
   */
  forgetCollapsedGroups(): void {
    this.memory.forget(SidebarPreferences.COLLAPSED_GROUPS_KEY);
  }
}

export const defaultSidebarPreferences = new SidebarPreferences();
