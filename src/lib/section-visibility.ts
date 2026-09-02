export class SectionVisibilityMemory {
  constructor(private readonly prefix: string = "synapse:section-open:") {}

  recall(storageKey: string): boolean | null {
    try {
      const remembered = window.localStorage.getItem(this.prefix + storageKey);
      return remembered === null ? null : remembered === "true";
    } catch {
      return null;
    }
  }

  remember(storageKey: string, open: boolean): void {
    try {
      window.localStorage.setItem(this.prefix + storageKey, String(open));
    } catch {
      return;
    }
  }
}

export const defaultSectionVisibilityMemory = new SectionVisibilityMemory();
