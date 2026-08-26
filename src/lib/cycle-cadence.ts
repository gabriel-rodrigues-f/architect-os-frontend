import type { CycleCadence } from "./operational-settings";

/**
 * CFG-05 / B9 (SPEC-OO3-13-HARDCODED-CONFIG.md) — a REPRESENTAÇÃO do ciclo
 * por cadência. A tela de ciclos fixava semestres (`Half "H1"|"H2"`, regex
 * `^(\d{4}) (H[12])$`, datas 01-01→06-30/07-01→12-31, id `${year}-h1`) como
 * funções soltas dentro de `cycles.tsx` — pendência de auditoria (regra de
 * identidade/datas/parse dentro da rota) E hardcoded que a cadência
 * configurável (`cycle.cadence`, `app_settings`) precisa parametrizar.
 *
 * Desenho: uma estratégia por cadência (`CycleCadenceScheme.of(cadence)`),
 * cada uma declarando seus períodos com chave e datas fixas do ano —
 * identidade (`cycleId`/`cycleName`), datas (`datesFor`), parse
 * (`parseCycleName`) e sugestão de próximo período livre (`nextAvailable`)
 * são genéricos sobre essa declaração. Com SEMIANNUAL (o default do seed),
 * ids, nomes, datas, regex de parse e validação de duplicidade são
 * byte-idênticos ao que `cycles.tsx` fazia hardcoded — os testes existentes
 * de ciclos provam (nenhuma asserção mudou).
 *
 * A cadência só muda CICLOS FUTUROS: ciclos existentes guardam `id`, `name`
 * e datas próprios (avaliações e PDIs referenciam `cycle_id`) — trocar a
 * cadência muda apenas as opções que o diálogo "Novo ciclo" oferece.
 */

/** Um período do ano dentro de uma cadência — chave e datas MM-DD fixas. */
interface PeriodSpec {
  readonly key: string;
  readonly start: string;
  readonly end: string;
}

const PERIODS: Record<CycleCadence, readonly PeriodSpec[]> = {
  SEMIANNUAL: [
    { key: "H1", start: "01-01", end: "06-30" },
    { key: "H2", start: "07-01", end: "12-31" },
  ],
  QUARTERLY: [
    { key: "Q1", start: "01-01", end: "03-31" },
    { key: "Q2", start: "04-01", end: "06-30" },
    { key: "Q3", start: "07-01", end: "09-30" },
    { key: "Q4", start: "10-01", end: "12-31" },
  ],
  ANNUAL: [{ key: "Y", start: "01-01", end: "12-31" }],
};

/** Um par ano/período — a identidade de um ciclo dentro de uma cadência. */
export interface CyclePeriod {
  year: number;
  period: string;
}

export class CycleCadenceScheme {
  private static readonly instances = new Map<CycleCadence, CycleCadenceScheme>();

  private constructor(
    readonly cadence: CycleCadence,
    private readonly specs: readonly PeriodSpec[],
  ) {}

  static of(cadence: CycleCadence): CycleCadenceScheme {
    let scheme = CycleCadenceScheme.instances.get(cadence);
    if (!scheme) {
      scheme = new CycleCadenceScheme(cadence, PERIODS[cadence]);
      CycleCadenceScheme.instances.set(cadence, scheme);
    }
    return scheme;
  }

  /** As chaves de período que o diálogo oferece (`["H1","H2"]`, `["Q1"..."Q4"]`, `["Y"]`). */
  get periods(): readonly string[] {
    return this.specs.map((spec) => spec.key);
  }

  /** Cadência anual tem UM período — o seletor de período nem aparece. */
  get singlePeriod(): boolean {
    return this.specs.length === 1;
  }

  /**
   * Rótulo e id nascem do par ano/período — nunca de texto livre. Com um
   * período só (ANNUAL), o ano É o nome/id: "2027" / `2027`, sem sufixo.
   */
  cycleName(year: number, period: string): string {
    return this.singlePeriod ? String(year) : `${year} ${period}`;
  }

  cycleId(year: number, period: string): string {
    return this.singlePeriod ? String(year) : `${year}-${period.toLowerCase()}`;
  }

  datesFor(year: number, period: string): { start: string; end: string } {
    const spec = this.specs.find((s) => s.key === period) ?? this.specs[0]!;
    return { start: `${year}-${spec.start}`, end: `${year}-${spec.end}` };
  }

  /**
   * Extrai ano/período de um nome existente; cai no ano corrente e primeiro
   * período se não casar o padrão da cadência (mesmo fallback do hardcoded).
   */
  parseCycleName(name: string): CyclePeriod {
    const pattern = this.singlePeriod
      ? /^(\d{4})$/
      : new RegExp(`^(\\d{4}) (${this.specs.map((s) => s.key).join("|")})$`);
    const match = pattern.exec(name);
    if (match) return { year: Number(match[1]), period: match[2] ?? this.specs[0]!.key };
    return { year: new Date().getFullYear(), period: this.specs[0]!.key };
  }

  /** Primeiro par ano/período cujo id ainda não existe, a partir do ano corrente. */
  nextAvailable(existing: readonly { id: string }[]): CyclePeriod {
    const used = new Set(existing.map((c) => c.id));
    let year = new Date().getFullYear();
    let index = 0;
    while (used.has(this.cycleId(year, this.specs[index]!.key))) {
      index += 1;
      if (index === this.specs.length) {
        index = 0;
        year += 1;
      }
    }
    return { year, period: this.specs[index]!.key };
  }
}
