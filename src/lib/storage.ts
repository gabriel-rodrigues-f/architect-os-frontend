export function readMigratedItem(newKey: string, legacyKey: string): string | null {
  try {
    const atual = window.localStorage.getItem(newKey);
    if (atual !== null) return atual;
    const antigo = window.localStorage.getItem(legacyKey);
    if (antigo !== null) {
      window.localStorage.setItem(newKey, antigo);
      window.localStorage.removeItem(legacyKey);
    }
    return antigo;
  } catch {
    return null;
  }
}
