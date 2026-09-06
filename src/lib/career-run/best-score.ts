/** O recorde fica só neste navegador: a tela de erro não fala com servidor nenhum. */
export class BestScore {
  static readonly STORAGE_KEY = "synapse:career-run-best";

  static read(): number {
    try {
      const raw = window.localStorage.getItem(BestScore.STORAGE_KEY);
      const value = raw === null ? 0 : Number(raw);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  }

  static keep(score: number): number {
    const best = Math.max(BestScore.read(), score);
    try {
      window.localStorage.setItem(BestScore.STORAGE_KEY, String(best));
    } catch {
      return best;
    }
    return best;
  }
}
