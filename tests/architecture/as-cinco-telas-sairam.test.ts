import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import pt from "@/locales/pt.json";

/**
 * AS CINCO REMOÇÕES DO DONO (2026-09-10) — e nenhuma delas volta pela porta
 * dos fundos.
 *
 * No molde da regra 17 de `direcao/papeis-2026-09-06.md`, que foi como a
 * Evidência saiu (`a-evidencia-saiu-do-produto.test.ts`) e como as duas
 * leituras de apoio saíram (`as-duas-leituras-de-apoio-sairam.test.ts`):
 *
 * 1. **Plano de Capacitação** (`/training-needs`) — *"remova a tela. front,
 *    back e banco."* MEDIDO: não havia tabela, rota nem módulo próprio. A tela
 *    era DERIVADA — `Selectors.teamTrainingNeeds` agregava, no navegador, as
 *    competências em evolução das pessoas ao alcance. Front-only, portanto, e
 *    a ausência de migração é medição, não esquecimento.
 * 2. **Perfis lado a lado** (`/compare`) — *"remova a tela."* Mesma medição:
 *    sem rota de backend e sem tabela. Lia o mesmo estado das outras telas e
 *    desenhava radar e tabela por `RadarRows.of`.
 * 3. **Calibração de Líderes** (`/calibration`) — *"remova do front, back e
 *    banco toda a estrutura relacionada."* Esta tinha backend (`GET
 *    /calibration`), que saiu na mesma fatia; banco próprio, não — a varredura
 *    do `information_schema` da instância consolidada não achou tabela nem
 *    coluna com `calibr` no nome.
 * 4. **Estrutura de Times → Pendências de Configuração** — nasceu em
 *    2026-09-09, zero backend e zero banco: `TeamConfiguration` contava, no
 *    navegador, sobre o que a tela já tinha em mãos.
 * 5. **Estrutura de Times → Transições por times** — *"remova do front, back e
 *    banco."* Morre o RELATÓRIO agregado (`POST /analytics/team-transitions` e
 *    o bloco da tela). O §FRONTEIRA abaixo diz, pelo lado positivo, o que
 *    fica — e é a parte que mais importa deste arquivo.
 */
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * A EXCEÇÃO DO CATÁLOGO MORREU NA INTEGRAÇÃO, e este comentário é a lápide.
 *
 * Enquanto a fatia rodava, `navigation-catalog.ts` era de outro agente, e as
 * três entradas órfãs — `/training-needs`, `/compare`, `/calibration` — mais as
 * chaves de rótulo delas ficavam de pé aqui para não virar conflito. O
 * orquestrador derrubou as três linhas ao integrar, junto com os ícones que
 * ficaram sem uso e com a política `canCalibrate`, que só a entrada do menu
 * consultava.
 *
 * Sem exceção nenhuma: a varredura cobra o catálogo como cobra o resto.
 */
const DA_FATIA_DA_CASCA: string[] = [];

const CHAVES_DO_MENU_ORFAO: string[] = [];

/**
 * As grafias de cada tela. `awaitingCalibration` e `dash.lead.
 * awaitingCalibration` NÃO entram — são a fila do Painel Executivo, que é
 * outra coisa (§FRONTEIRA). `teamTransitionsOf` e `statement.source.
 * teamTransitions` também não: são o Extrato da pessoa.
 */
const AS_GRAFIAS: ReadonlyArray<readonly [string, RegExp]> = [
  ["Plano de Capacitação", /training-needs|trainingNeeds?|TrainingNeed|teamTrainingNeeds/],
  /*
   * O `(?<![\w.])` do `compare.` é a fronteira que separa esta tela dos
   * CICLOS: `cycle.compare.*` é a comparação entre ciclos, que fica. Sem ele
   * a varredura acusava `src/routes/cycles.tsx`, que não tem nada com isto.
   */
  [
    "Perfis lado a lado",
    /RadarRows\.of\b|routes\/compare|(?<![\w.])compare\.(title|subtitle|radar|table|view|selector|empty)|help\.compare/,
  ],
  [
    "Calibração de Líderes",
    /CalibrationViewModel|EvaluatorCalibration|calibrationApi|calibration\.gateway|CalibrationSnapshot|CalibrationEvaluator|requireCalibrationReach|calibrationReservedToManager|pane\.calibrationCharts/,
  ],
  [
    "Pendências de Configuração",
    /TeamConfiguration|TeamPendency|team-configuration|teams\.pending/,
  ],
  [
    "Transições por times",
    /TeamTransitionsViewModel|TeamTransitionsRow|TeamTransitionsSection|TeamTransitionsTable|teamTransitionsApi|compareTeamTransitions|team-transitions\.gateway|team-transitions-view-model|teams\.transitions/,
  ],
];

/**
 * O que a régua mede é CÓDIGO: símbolo, rota, chave de i18n, texto de tela.
 * Comentário que EXPLICA por que uma tela saiu é justamente o que se quer ler
 * daqui a um ano — sai da conta antes da busca, como nas catracas irmãs.
 */
const semComentarios = (fonte: string): string =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

function arquivosDe(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivosDe(caminho);
    return /\.(ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}

const fontesDoProduto = (): string[] =>
  arquivosDe(join(raiz, "src"))
    .filter((arquivo) => !arquivo.endsWith("api-contract.gen.ts"))
    .filter((arquivo) => !arquivo.endsWith("routeTree.gen.ts"))
    .filter((arquivo) => !DA_FATIA_DA_CASCA.some((excecao) => arquivo.includes(excecao)));

const catalogos = { pt, en } as Record<string, Record<string, string>>;

describe("as cinco telas saíram do produto (dono, 2026-09-10)", () => {
  for (const [tela, grafias] of AS_GRAFIAS) {
    it(`nenhum símbolo, rota ou texto de src/ nomeia ${tela}`, () => {
      const culpados = fontesDoProduto()
        .filter((arquivo) => grafias.test(semComentarios(readFileSync(arquivo, "utf8"))))
        .map((arquivo) => arquivo.slice(raiz.length + 1));

      expect(culpados).toEqual([]);
    });
  }

  it("os arquivos de rota das três telas não existem mais", () => {
    const rotas = readdirSync(join(raiz, "src", "routes"));

    expect(
      rotas.filter((arquivo) => /^(training-needs|compare|calibration)\./.test(arquivo)),
    ).toEqual([]);
  });

  for (const idioma of ["pt", "en"] as const) {
    it(`nenhuma chave de ${idioma} fala das cinco, fora os três rótulos do menu órfão`, () => {
      const catalogo = catalogos[idioma]!;
      const culpadas = Object.keys(catalogo)
        .filter((chave) => !CHAVES_DO_MENU_ORFAO.includes(chave))
        .filter((chave) => AS_GRAFIAS.some(([, grafias]) => grafias.test(chave)));

      expect(culpadas).toEqual([]);
    });
  }

  it("os dois catálogos terminam com exatamente o mesmo conjunto de chaves", () => {
    const soEmPt = Object.keys(pt).filter((chave) => !(chave in en));
    const soEmEn = Object.keys(en).filter((chave) => !(chave in pt));

    expect({ soEmPt, soEmEn }).toEqual({ soEmPt: [], soEmEn: [] });
  });

  /**
   * A FRONTEIRA QUE NÃO PODE SER ATRAVESSADA, afirmada pelo lado POSITIVO.
   *
   * Três coisas usam a palavra "transições" ou "calibração" e NÃO saem. Se um
   * dia alguém varrer essas palavras para limpar o resto, são estas asserções
   * que vão acender antes de a varredura chegar nelas.
   */
  describe("a fronteira: o que tem o mesmo nome e é outra coisa", () => {
    const ler = (...caminho: string[]): string => readFileSync(join(raiz, ...caminho), "utf8");

    it("o histórico de nível do Extrato continua sendo lido, e por outra porta", () => {
      const extrato = ler("src", "routes", "professionals.$professionalId.statement.tsx");

      expect(extrato).toContain("reportsApi.teamTransitionsOf");
      expect(pt["statement.source.teamTransitions"]).toBeTruthy();
      expect(en["statement.source.teamTransitions"]).toBeTruthy();
    });

    it("a fila 'aguardando calibração' do Painel Executivo continua de pé", () => {
      const painel = ler("src", "components", "app", "executive-panel.tsx");

      expect(painel).toContain("decisionsOnTheDesk.awaitingCalibration");
      expect(pt["dash.lead.awaitingCalibration"]).toBeTruthy();
      expect(en["dash.lead.awaitingCalibration"]).toBeTruthy();
    });

    /**
     * A ÚNICA PONTA DO PLANO DE CAPACITAÇÃO QUE NÃO SAIU NESTA FATIA, e ela é
     * declarada aqui para não virar buraco silencioso.
     *
     * O limiar de intervenção coletiva (`training.collectiveInterventionThreshold`)
     * é uma CONFIGURAÇÃO — chave em `APP_SETTING_KEYS` do backend, linha em
     * `app_settings` no banco, e campo editável na tela de Critérios de
     * Pontuação (`src/routes/scoring-rulers.tsx`). Só a tela que o LIA morreu;
     * o campo continua de pé, e sem consumidor.
     *
     * Ele fica FORA desta fatia porque `scoring-rulers.tsx` pertence a outra
     * fatia desta rodada, e porque derrubar uma configuração exige migração
     * forward-only apagando a linha do banco — decisão que merece o passo
     * dela, não o rabo deste. Esta asserção existe para que a próxima varredura
     * ache a ponta antes de declarar o Plano de Capacitação encerrado.
     */
    it("o limiar de intervenção coletiva continua de pé, e é a dívida declarada desta fatia", () => {
      const criterios = ler("src", "routes", "scoring-rulers.tsx");

      expect(criterios).toContain("trainingCollectiveInterventionThreshold");
    });

    it("o radar da ficha e o do painel próprio continuam usando as OUTRAS fábricas de RadarRows", () => {
      const modelo = ler("src", "lib", "view-models", "radar-rows.ts");

      expect(modelo).toContain("currentAgainstTarget");
      expect(ler("src", "routes", "index.tsx")).toContain("RadarRows.currentAgainstTarget");
    });
  });
});
