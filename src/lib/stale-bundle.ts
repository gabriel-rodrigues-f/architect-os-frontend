/**
 * A ABA DO BUILD ANTERIOR (dono, 2026-09-10: *"todas as rotas estão com erro
 * de carregamento"*). Cada tela é um pedaço de JavaScript com o hash do build
 * no nome. A aba aberta antes de um deploy guarda os nomes velhos; o servidor
 * novo não os tem (404), e toda navegação caía em "Esta página não carregou".
 * O "Tentar novamente" revalidava o roteador — e pedia de novo o arquivo morto.
 *
 * O remédio é recarregar a página, que traz o HTML novo com os nomes novos.
 * UMA vez só: a marca em `sessionStorage` impede o laço quando o build novo
 * também falha — aí a tela de erro fica de pé, que é o certo.
 */
export class StaleBundle {
  static readonly STORAGE_KEY = "synapse:stale-bundle-reload";
  static readonly RELOAD_WINDOW_MS = 10_000;

  /** O texto que Chrome, Firefox e Safari dão ao import dinâmico que não baixou. */
  private static readonly CHUNK_FAILURE =
    /dynamically imported module|Importing a module script failed/i;

  constructor(
    private readonly storage: Pick<Storage, "getItem" | "setItem">,
    private readonly reload: () => void,
    private readonly now: () => number = Date.now,
  ) {}

  static forBrowser(): StaleBundle {
    return new StaleBundle(window.sessionStorage, () => window.location.reload());
  }

  static isChunkLoadFailure(error: unknown): boolean {
    return error instanceof Error && StaleBundle.CHUNK_FAILURE.test(error.message);
  }

  /** Recarrega, a menos que já tenha recarregado dentro da janela. Diz se recarregou. */
  reloadOnce(): boolean {
    const last = this.read();
    if (last !== null && this.now() - Number(last) < StaleBundle.RELOAD_WINDOW_MS) return false;
    this.write(String(this.now()));
    this.reload();
    return true;
  }

  private read(): string | null {
    try {
      return this.storage.getItem(StaleBundle.STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private write(value: string): void {
    try {
      this.storage.setItem(StaleBundle.STORAGE_KEY, value);
    } catch {
      // Sem armazenamento, recarrega mesmo assim: o pior caso é o laço que o navegador já corta.
    }
  }
}
