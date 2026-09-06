/**
 * A preferência de grupos do menu recolhidos vive no navegador. O login a
 * esquece: na primeira abertura após entrar, todos os grupos nascem abertos
 * (pedido do dono, 2026-09-06 — "Configuração nasceu escondido").
 */
export class CollapsedNavGroups {
  static readonly STORAGE_KEY = "synapse:nav-collapsed-groups";

  static forget(): void {
    try {
      window.localStorage.removeItem(CollapsedNavGroups.STORAGE_KEY);
    } catch {
      return;
    }
  }
}
