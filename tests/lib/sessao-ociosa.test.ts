import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CrossTabIdleActivity,
  defaultIdleSessionBudget,
  IdleSessionBudget,
  IdleSessionMonitor,
  IdleSessionWatch,
  type IdleSessionPhase,
} from "@/lib/idle-session";

/**
 * ONDA 29, fatia `sessao-ociosa` — a metade de MECANISMO. A metade de tela
 * está em `tests/components/app/sessao-ociosa-avisa-no-topo.test.tsx`.
 *
 * Estes são os quatro modos de falha conhecidos de temporizador de ociosidade,
 * e cada um tem seu bloco abaixo:
 *
 *   1. a máquina DORME e `setTimeout` mente;
 *   2. MUITAS ABAS, e a ociosa não pode derrubar quem está trabalhando;
 *   3. o que conta como "mexer na tela", e o custo disso;
 *   4. nada disso roda sem sessão.
 *
 * O teste que mais importa é o da SUSPENSÃO: ele avança o relógio do SISTEMA
 * sem deixar timer nenhum rodar. Um desenho que agende `setTimeout(logout, 10min)`
 * passa em todos os outros e falha só neste.
 */

class RegistroDeFases {
  readonly fases: IdleSessionPhase[] = [];

  readonly registrar = (fase: IdleSessionPhase): void => {
    this.fases.push(fase);
  };

  get ultima(): IdleSessionPhase | undefined {
    return this.fases.at(-1);
  }

  get avisou(): boolean {
    return this.fases.includes("warning");
  }

  get terminou(): boolean {
    return this.fases.includes("ended");
  }
}

const MINUTO = 60_000;
const INICIO = new Date("2026-08-31T09:00:00.000Z").getTime();

describe("orçamento de ociosidade — as duas constantes, juntas e nomeadas", () => {
  it("o padrão da casa é o orçamento TOTAL de 10 minutos: aviso aos 9, fim aos 10", () => {
    expect(defaultIdleSessionBudget.warnAfterIdleMinutes).toBe(9);
    expect(defaultIdleSessionBudget.endAfterIdleMinutes).toBe(10);
    expect(defaultIdleSessionBudget.warnAfterMs).toBe(9 * MINUTO);
    expect(defaultIdleSessionBudget.endAfterMs).toBe(10 * MINUTO);
  });

  /** "1 minuto após a mensagem" — a folga é a diferença, não uma terceira constante. */
  it("a folga entre o aviso e o fim é 1 minuto, derivada — não é constante solta", () => {
    expect(defaultIdleSessionBudget.graceMs).toBe(MINUTO);
  });

  it("a fase é função pura do tempo ocioso, nunca de um timer que disparou", () => {
    const orcamento = new IdleSessionBudget(9, 10);
    expect(orcamento.phaseAfter(0)).toBe("active");
    expect(orcamento.phaseAfter(9 * MINUTO - 1)).toBe("active");
    expect(orcamento.phaseAfter(9 * MINUTO)).toBe("warning");
    expect(orcamento.phaseAfter(10 * MINUTO - 1)).toBe("warning");
    expect(orcamento.phaseAfter(10 * MINUTO)).toBe("ended");
    expect(orcamento.phaseAfter(40 * MINUTO)).toBe("ended");
  });

  /** Trocar o orçamento é UMA linha: o dono pode ter querido 10+1. */
  it("trocar o orçamento para 10+1 é trocar os dois números de um construtor só", () => {
    const dezMaisUm = new IdleSessionBudget(10, 11);
    expect(dezMaisUm.phaseAfter(10 * MINUTO)).toBe("warning");
    expect(dezMaisUm.phaseAfter(11 * MINUTO)).toBe("ended");
    expect(dezMaisUm.graceMs).toBe(MINUTO);
  });
});

describe("sessão ociosa — o relógio do sistema, não o do timer", () => {
  let registro: RegistroDeFases;
  let watch: IdleSessionWatch;

  const montarVigia = (orcamento = new IdleSessionBudget(9, 10)) => {
    registro = new RegistroDeFases();
    watch = new IdleSessionWatch(
      new IdleSessionMonitor(orcamento, new CrossTabIdleActivity(), registro.registrar),
    );
    watch.start();
  };

  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(INICIO);
  });

  afterEach(() => {
    watch.stop();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("aos 9 minutos ociosos, avisa — e só avisa", () => {
    montarVigia();

    vi.advanceTimersByTime(9 * MINUTO);

    expect(registro.ultima).toBe("warning");
    expect(registro.terminou).toBe(false);
  });

  it("aos 10 minutos ociosos, encerra a sessão", () => {
    montarVigia();

    vi.advanceTimersByTime(10 * MINUTO);

    expect(registro.terminou).toBe(true);
  });

  it("encerra UMA vez só, mesmo com o relógio continuando a andar", () => {
    montarVigia();

    vi.advanceTimersByTime(30 * MINUTO);

    expect(registro.fases.filter((fase) => fase === "ended")).toHaveLength(1);
  });

  it("atividade aos 9m30s dissolve o aviso e devolve o orçamento INTEIRO — não o minuto restante", () => {
    montarVigia();

    vi.advanceTimersByTime(9 * MINUTO + 30_000);
    expect(registro.ultima).toBe("warning");

    document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    vi.advanceTimersByTime(1_000);
    expect(registro.ultima).toBe("active");

    vi.advanceTimersByTime(9 * MINUTO - 2_000);
    expect(registro.ultima).toBe("active");

    vi.advanceTimersByTime(2_000);
    expect(registro.ultima).toBe("warning");
    expect(registro.terminou).toBe(false);
  });

  /**
   * ARMADILHA 1 — A MÁQUINA DORME.
   *
   * `vi.setSystemTime` move `Date.now()` sem deixar um único timer rodar: é
   * exatamente o notebook fechado. O desenho que agenda `setTimeout(logout, 10min)`
   * volta com a sessão de pé; o desenho que COMPARA o instante da última
   * atividade com o AGORA desloga na volta.
   *
   * E desloga SEM passar pelo aviso: o minuto de folga só faz sentido para
   * quem está olhando a tela.
   */
  it("máquina suspensa por 40 minutos: ao voltar, desloga NA HORA e sem passar pelo aviso", () => {
    montarVigia();

    vi.setSystemTime(INICIO + 40 * MINUTO);
    expect(registro.terminou, "nada disparou ainda: nenhum timer rodou").toBe(false);

    document.dispatchEvent(new Event("visibilitychange"));

    expect(registro.terminou).toBe(true);
    expect(registro.avisou, "o aviso é para quem está olhando a tela").toBe(false);
  });

  /**
   * A mesma volta, com o orçamento ainda de pé: a aba AVISA em vez de
   * deslogar. E como "foco na janela" conta como mexer na tela, o próprio
   * retorno dissolve o aviso — nessa ordem, revisão primeiro. Trocar a ordem é
   * o que ressuscitaria a sessão suspensa do teste acima.
   */
  it("suspensão curta (9m30s): ao voltar, a aba avisa em vez de deslogar", () => {
    montarVigia();

    vi.setSystemTime(INICIO + 9 * MINUTO + 30_000);
    window.dispatchEvent(new Event("focus"));

    expect(registro.avisou).toBe(true);
    expect(registro.terminou).toBe(false);
    expect(registro.ultima, "o retorno do foco é atividade: dissolve o aviso").toBe("active");
  });

  /**
   * O foco de volta na janela conta como atividade (o dono mexeu na janela) —
   * mas a REVISÃO vem primeiro. Sem essa ordem, voltar de uma suspensão de 40
   * minutos ressuscitaria a sessão em vez de derrubá-la.
   */
  it("voltar o foco depois de 3 minutos ociosos devolve o orçamento inteiro", () => {
    montarVigia();

    vi.advanceTimersByTime(3 * MINUTO);
    window.dispatchEvent(new Event("focus"));

    vi.advanceTimersByTime(9 * MINUTO - 1_000);
    expect(registro.ultima).toBe("active");
  });
});

/**
 * ARMADILHA 2 — MUITAS ABAS.
 *
 * O dono abre o Synapse em duas abas, trabalha numa e esquece a outra. Se cada
 * aba contasse sozinha, a esquecida derrubaria as duas em 10 minutos, no meio
 * do trabalho — pior que a funcionalidade não existir.
 *
 * Aqui cada "aba" é um par (monitor, vigia) independente. Elas não se
 * conhecem: o que as liga é o carimbo compartilhado e o canal de transmissão.
 * A atividade é registrada no monitor da aba A DIRETAMENTE, e não por evento
 * de `document` — no jsdom as duas abas dividem o mesmo `document`, e um
 * `mousemove` chegaria nas duas, provando nada.
 */
describe("sessão ociosa — atividade em QUALQUER aba conta para TODAS", () => {
  const abas: IdleSessionWatch[] = [];

  const abrirAba = () => {
    const registro = new RegistroDeFases();
    const monitor = new IdleSessionMonitor(
      new IdleSessionBudget(9, 10),
      new CrossTabIdleActivity(),
      registro.registrar,
    );
    const watch = new IdleSessionWatch(monitor);
    watch.start();
    abas.push(watch);
    return { registro, monitor };
  };

  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(INICIO);
  });

  afterEach(() => {
    for (const aba of abas.splice(0)) aba.stop();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("a aba esquecida NÃO derruba a aba em que se está trabalhando", () => {
    const trabalhando = abrirAba();
    const esquecida = abrirAba();

    for (let passo = 0; passo < 20; passo += 1) {
      vi.advanceTimersByTime(MINUTO);
      trabalhando.monitor.registerActivity(Date.now());
    }

    expect(esquecida.registro.terminou, "a aba ociosa derrubou quem estava trabalhando").toBe(
      false,
    );
    expect(trabalhando.registro.terminou).toBe(false);
    expect(esquecida.registro.ultima).toBe("active");
  });

  it("atividade numa aba dissolve o aviso que já apareceu na outra", () => {
    const trabalhando = abrirAba();
    const esquecida = abrirAba();

    vi.advanceTimersByTime(9 * MINUTO);
    expect(esquecida.registro.ultima).toBe("warning");

    trabalhando.monitor.registerActivity(Date.now());
    vi.advanceTimersByTime(1_000);

    expect(esquecida.registro.ultima).toBe("active");
  });

  it("sem atividade em aba nenhuma, TODAS caem — não sobra aba logada com sessão morta", () => {
    const primeira = abrirAba();
    const segunda = abrirAba();

    vi.advanceTimersByTime(10 * MINUTO);

    expect(primeira.registro.terminou).toBe(true);
    expect(segunda.registro.terminou).toBe(true);
  });

  /**
   * `localStorage` LANÇA em janela privativa ou com dados de site bloqueados.
   * Quando isso acontece a aba continua contando sozinha — funcionalidade
   * degradada, nunca tela quebrada.
   */
  it("com localStorage bloqueado, a aba continua funcionando sozinha", () => {
    const explodir = () => {
      throw new Error("acesso ao armazenamento negado");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(explodir);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(explodir);

    const aba = abrirAba();
    vi.advanceTimersByTime(9 * MINUTO);
    expect(aba.registro.ultima).toBe("warning");

    vi.advanceTimersByTime(MINUTO);
    expect(aba.registro.terminou).toBe(true);

    vi.restoreAllMocks();
  });
});

/**
 * ARMADILHA 3 — O QUE CONTA COMO "MEXER NA TELA", E O CUSTO DISSO.
 */
describe("sessão ociosa — o que conta como mexer na tela, e o custo", () => {
  let registro: RegistroDeFases;
  let watch: IdleSessionWatch;

  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(INICIO);
    registro = new RegistroDeFases();
    watch = new IdleSessionWatch(
      new IdleSessionMonitor(
        new IdleSessionBudget(9, 10),
        new CrossTabIdleActivity(),
        registro.registrar,
      ),
    );
  });

  afterEach(() => {
    watch.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it.each([
    ["mousemove", () => document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))],
    ["mousedown", () => document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))],
    ["keydown", () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }))],
    ["touchstart", () => document.dispatchEvent(new Event("touchstart", { bubbles: true }))],
    ["scroll", () => document.dispatchEvent(new Event("scroll"))],
    ["wheel", () => document.dispatchEvent(new Event("wheel", { bubbles: true }))],
    ["focus na janela", () => window.dispatchEvent(new Event("focus"))],
  ])("%s dissolve o aviso", (_nome, mexer) => {
    watch.start();
    vi.advanceTimersByTime(9 * MINUTO);
    expect(registro.ultima).toBe("warning");

    mexer();
    vi.advanceTimersByTime(1_000);

    expect(registro.ultima).toBe("active");
  });

  /**
   * Escrever carimbo compartilhado a cada `mousemove` é desperdício: um por
   * segundo basta, com folga de sobra num orçamento de 9 minutos. O carimbo
   * LOCAL continua exato — o que é estrangulado é a escrita compartilhada.
   */
  it("estrangula a escrita do carimbo compartilhado: um por segundo, não um por mousemove", () => {
    const escrever = vi.spyOn(Storage.prototype, "setItem");
    watch.start();
    escrever.mockClear();

    for (let evento = 0; evento < 200; evento += 1) {
      document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    }

    expect(escrever.mock.calls.length).toBeLessThanOrEqual(1);
  });

  /** Ouvinte vazado num `document` de teste vira flake para outra pessoa. */
  it("ao parar, devolve TODOS os ouvintes que pegou — nenhum vaza", () => {
    const pegos: string[] = [];
    const devolvidos: string[] = [];
    const anotar = (lista: string[], alvo: string) => (tipo: string) => {
      lista.push(`${alvo}:${tipo}`);
    };

    vi.spyOn(document, "addEventListener").mockImplementation(anotar(pegos, "document"));
    vi.spyOn(document, "removeEventListener").mockImplementation(anotar(devolvidos, "document"));
    vi.spyOn(window, "addEventListener").mockImplementation(anotar(pegos, "window"));
    vi.spyOn(window, "removeEventListener").mockImplementation(anotar(devolvidos, "window"));

    watch.start();
    watch.stop();

    expect(pegos.length).toBeGreaterThan(0);
    expect([...devolvidos].sort()).toEqual([...pegos].sort());
  });

  it("ao parar, o relógio para junto: nenhuma fase nova depois do stop", () => {
    watch.start();
    watch.stop();

    vi.advanceTimersByTime(30 * MINUTO);

    expect(registro.terminou).toBe(false);
    expect(registro.avisou).toBe(false);
  });
});
