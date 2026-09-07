/**
 * A MEMÓRIA DO NAVEGADOR, com a proteção que o `localStorage` não dá.
 *
 * Safari em janela privada, cota estourada, `storage` bloqueado por política:
 * `setItem` LANÇA — e um clique que só queria lembrar "menu recolhido" caía
 * com a tela ([FA-05]: seis `setItem` soltos no `AppShell`, nenhum protegido).
 * Aqui toda leitura e toda escrita são engolidas em `try/catch`: a preferência
 * que não dá para guardar é esquecida, e a tela segue.
 *
 * A migração de chave `architect-os:` → `synapse:` (R2-VIS-10) mora aqui
 * também: quem lê pela chave nova e encontra só a antiga promove o valor e
 * apaga o legado — uma sessão já aberta não perde o que tinha salvo.
 */
export class BrowserMemory {
  constructor(private readonly storage: () => Storage = () => window.localStorage) {}

  read(key: string, legacyKey?: string): string | null {
    try {
      const store = this.storage();
      const atual = store.getItem(key);
      if (atual !== null || legacyKey === undefined) return atual;
      const antigo = store.getItem(legacyKey);
      if (antigo !== null) {
        store.setItem(key, antigo);
        store.removeItem(legacyKey);
      }
      return antigo;
    } catch {
      return null;
    }
  }

  /** Devolve `false` quando o navegador recusou — quem chama decide se importa. */
  write(key: string, value: string): boolean {
    try {
      this.storage().setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  forget(key: string): void {
    try {
      this.storage().removeItem(key);
    } catch {
      return;
    }
  }
}

export const browserMemory = new BrowserMemory();
