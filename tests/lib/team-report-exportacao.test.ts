import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { T, TeamReportInput } from "@/lib/presenters";
import type { ConsolidatedGapRow } from "@/lib/selectors";
import { exportTeamReportCsv, TeamReportCsvBuilder } from "@/lib/team-report-csv";
import { exportTeamReportPdf, TeamReportPdfBuilder } from "@/lib/team-report-pdf";

import ouro from "./team-report-exportacao.fixture.json";

/**
 * Onda 20/R3 — rede de caracterização dos relatórios do time. Onda 36
 * (ADR-0082): a obrigatoriedade morreu — as seções "bloqueantes" e
 * "oportunidades" viraram UMA seção de prioridades, sem a coluna Tipo, e a
 * fixture ao lado foi recapturada desta versão (o formato mudou de
 * propósito; o byte a byte volta a valer daqui em diante).
 *
 * Por que o PDF entra por sha256 e não por bytes literais: o único trecho
 * não determinístico do jsPDF é o `/ID [ <...> <...> ]` do trailer (60 bytes
 * de aleatório, medidos), normalizado aqui; o `CreationDate` obedece ao
 * relógio falso. Fora isso o arquivo é idêntico rodada a rodada.
 */

const entregues: { blob: Blob; filename: string }[] = [];

vi.mock("@/lib/download", async (original) => ({
  ...(await original<typeof import("@/lib/download")>()),
  downloadBlob: (blob: Blob, filename: string) => {
    entregues.push({ blob, filename });
  },
}));

const fakeT: T = (key, params) => (params ? `${key}|${JSON.stringify(params)}` : String(key));

const gapRow = (overrides: Partial<ConsolidatedGapRow> = {}): ConsolidatedGapRow => ({
  competencyId: "c1",
  name: 'Kubernetes, "prod"\nmulti-linha',
  capabilityId: "cloud",
  people: 2,
  architectNames: ["Ana", "Bruno"],
  totalGap: 3,
  maxGap: 2,
  avgGap: 1.5,
  avgFinal: 2.5,
  avgTarget: 4,
  ...overrides,
});

const cloud = { id: "cloud", name: "Cloud", short: "Cld" };
const sec = { id: "security", name: "Security", short: "Sec" };

const entradaCompleta = (): TeamReportInput => ({
  scopeLabel: "Time inteiro",
  generatedAt: new Date("2026-08-26T02:00:00Z"),
  architects: [
    { id: "ana", name: "Ana" },
    { id: "bruno", name: 'Bruno "B", o Grande' },
  ],
  capabilities: [cloud, sec],
  capabilityAveragesFor: (id) =>
    id === "ana"
      ? [
          { capability: cloud as never, avg: 3.6, target: 4 },
          { capability: sec as never, avg: undefined, target: undefined },
        ]
      : [],
  priorities: [
    gapRow(),
    gapRow({ competencyId: "c2", name: "Terraform", capabilityId: "x" }),
    gapRow({ competencyId: "c3", name: "Kafka" }),
  ],
  mastery: [gapRow({ competencyId: "c4", name: "Go", maxGap: -2 })],
});

const entradaSemMastery = (): TeamReportInput => ({ ...entradaCompleta(), mastery: [] });

const entradaVazia = (): TeamReportInput => ({
  ...entradaCompleta(),
  priorities: [],
  mastery: [],
});

async function bytesDe(blob: Blob): Promise<Uint8Array> {
  return await new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(new Uint8Array(leitor.result as ArrayBuffer));
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsArrayBuffer(blob);
  });
}

async function textoDe(blob: Blob): Promise<string> {
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(await bytesDe(blob));
}

async function impressaoDigitalDo(blob: Blob): Promise<{ sha256: string; bytes: number }> {
  const conteudo = Buffer.from(await bytesDe(blob))
    .toString("latin1")
    .replace(/\/ID \[ <[0-9A-F]+> <[0-9A-F]+> \]/, "/ID [ <ID> <ID> ]");
  return {
    sha256: createHash("sha256").update(conteudo, "latin1").digest("hex"),
    bytes: conteudo.length,
  };
}

const localeOriginal = Date.prototype.toLocaleString;

describe("exportação do relatório do time — byte a byte contra a main af12f99", () => {
  beforeEach(() => {
    entregues.length = 0;
    Date.prototype.toLocaleString = function () {
      return "26/08/2026, 02:00:00";
    };
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T02:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    Date.prototype.toLocaleString = localeOriginal;
  });

  it("o CSV completo sai idêntico ao da main, do BOM ao último CRLF", () => {
    expect(new TeamReportCsvBuilder(fakeT, entradaCompleta()).build()).toBe(ouro.csv.completo);
  });

  it("sem aprofundamento, a seção de mastery não é escrita", () => {
    expect(new TeamReportCsvBuilder(fakeT, entradaSemMastery()).build()).toBe(ouro.csv.semMastery);
  });

  it("sem gap nenhum, o cabeçalho de competências em evolução continua saindo", () => {
    expect(new TeamReportCsvBuilder(fakeT, entradaVazia()).build()).toBe(ouro.csv.vazio);
  });

  it("o CSV vai para o download como text/csv;charset=utf-8 com o nome datado", async () => {
    const baixados: { blob: Blob; filename: string }[] = [];
    const construtor = new TeamReportCsvBuilder(
      fakeT,
      entradaCompleta(),
      undefined,
      (blob, filename) => baixados.push({ blob, filename }),
    );
    construtor.download();
    expect(baixados).toHaveLength(1);
    expect(baixados[0]!.filename).toBe(ouro.csv.arquivo);
    expect(baixados[0]!.blob.type).toBe(ouro.csv.tipo);
    vi.useRealTimers();
    expect(await textoDe(baixados[0]!.blob)).toBe(ouro.csv.completo);
  });

  it("o PDF completo sai idêntico ao da main, fora o ID aleatório do trailer", async () => {
    const blob = new TeamReportPdfBuilder(fakeT, entradaCompleta()).build();
    vi.useRealTimers();
    expect(await impressaoDigitalDo(blob)).toEqual(ouro.pdf.completo);
  });

  it("o PDF sem gap nenhum sai idêntico ao da main — só o mapa de calor", async () => {
    const blob = new TeamReportPdfBuilder(fakeT, entradaVazia()).build();
    vi.useRealTimers();
    expect(await impressaoDigitalDo(blob)).toEqual(ouro.pdf.vazio);
  });

  it("o PDF vai para o download como application/pdf com o nome datado", async () => {
    const baixados: { blob: Blob; filename: string }[] = [];
    const construtor = new TeamReportPdfBuilder(
      fakeT,
      entradaCompleta(),
      undefined,
      (blob, filename) => baixados.push({ blob, filename }),
    );
    construtor.download();
    expect(baixados).toHaveLength(1);
    expect(baixados[0]!.filename).toBe(ouro.pdf.arquivo);
    expect(baixados[0]!.blob.type).toBe(ouro.pdf.tipo);
    vi.useRealTimers();
    expect(await impressaoDigitalDo(baixados[0]!.blob)).toEqual(ouro.pdf.completo);
  });

  it("a tela de progressão continua exportando CSV pelo mesmo nome de operação, e entrega pelo downloadBlob", async () => {
    exportTeamReportCsv(fakeT, entradaCompleta());
    expect(entregues).toHaveLength(1);
    expect(entregues[0]!.filename).toBe(ouro.csv.arquivo);
    vi.useRealTimers();
    expect(await textoDe(entregues[0]!.blob)).toBe(ouro.csv.completo);
  });

  it("a tela de progressão continua exportando PDF pelo mesmo nome de operação, e entrega pelo downloadBlob", async () => {
    await exportTeamReportPdf(fakeT, entradaCompleta());
    expect(entregues).toHaveLength(1);
    expect(entregues[0]!.filename).toBe(ouro.pdf.arquivo);
    vi.useRealTimers();
    expect(await impressaoDigitalDo(entregues[0]!.blob)).toEqual(ouro.pdf.completo);
  });
});
