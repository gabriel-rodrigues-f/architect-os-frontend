import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { InMemoryNoticesGateway, type NoticesViewer } from "@/lib/gateways/notices.gateway";
import { NoticeRoutingPolicy } from "@/lib/notice-routing-policy";

/**
 * A CATRACA DA DECORAÇÃO DE AVISO — todo `eventType` decorado tem emissor.
 *
 * O defeito que este arquivo fecha é falha silenciosa por construção, igual
 * ao dos `messageCode` de sucesso (`message-codes-de-sucesso.test.ts`, ARQ-18)
 * e resolvido com o mesmo remédio. `NoticeRoutingPolicy` resolve
 * `DECORATION_BY_EVENT_TYPE[eventType] ?? FALLBACK`: uma chave que ninguém
 * emite não gera erro de compilação, não gera lint e não gera log — ela
 * simplesmente nunca é alcançada, e fica no mapa parecendo contrato.
 *
 * Foi o que aconteceu com `pdi.item.dueSoon`, removida em 2026-09-08. Ela
 * sobreviveu meses porque o único teste que a citava era ele mesmo afirmando
 * que ela existia. E o desfecho conta melhor a história do que a remoção: na
 * mesma noite a fatia de prazo do PDI nasceu e batizou o evento de verdade de
 * `development-item.deadline-approaching` — dois segmentos em kebab-case, a
 * convenção de todos os outros tipos. Se ninguém tivesse olhado, a decoração
 * velha teria ficado no mapa ao lado da nova, apontando para uma string que
 * ninguém emite, e o aviso de prazo cairia no fallback genérico, sem o ícone
 * de prazo. Falha silenciosa é isto: nada quebra, e o produto fica pior.
 *
 * Um `eventType` decorado só é legítimo se alguém o PRODUZ, e há exatamente
 * dois produtores possíveis:
 *
 *  1. o backend, em `NoticeEventType` — a caixa de avisos da organização;
 *  2. a base de demonstração, em `InMemoryNoticesGateway` — a caixa que a
 *     aplicação mostra sem backend, e cujos tipos são derivados aqui do
 *     próprio gateway, não de uma lista copiada à mão.
 *
 * ## De onde vem `TIPOS_EMITIDOS_PELO_BACKEND`
 *
 * É **cópia** dos literais de `NoticeEventType`. Existe uma cópia aqui pelo
 * motivo já julgado no ADR-0023 do backend: `backend/.git` e `frontend/.git`
 * são repositórios separados e a CI faz checkout de um só, então um teste que
 * EXIGISSE o repositório vizinho só passaria na máquina de quem tem os dois
 * clonados lado a lado.
 *
 * Cópia que envelhece calada é pior que cópia nenhuma, então a defesa é a
 * mesma de lá: a comparação oportunista contra o arquivo original, que roda
 * quando os dois repositórios estão lado a lado — o caso da máquina de quem
 * desenvolve — e se anuncia como pulada quando só este repositório está
 * clonado.
 */
const TIPOS_EMITIDOS_PELO_BACKEND: readonly string[] = [
  "assessment.completed",
  "mentoring.recorded",
  "digest.daily",
  "support.access-opened",
  "team-transfer.requested",
  "team-transfer.approved",
  "team-transfer.refused",
  "development-item.deadline-approaching",
];

const ORIGEM_DA_COPIA = "backend/src/modules/notices/domain/entities/notice-event-type.ts";

/**
 * Os tipos que o backend emite e que a policy NÃO decora. A lista é canário,
 * não permissão: um segundo nome aqui é dívida nova, e um nome que saia daqui
 * é dívida paga — as duas coisas passam por uma edição consciente.
 *
 * `digest.daily` cai no `FALLBACK` de propósito. O resumo do dia não é uma
 * notícia com temperatura própria: ele é a contagem do que já chegou, e o tom
 * neutro com ícone genérico é a leitura certa dele.
 */
const TIPOS_SEM_DECORACAO: readonly string[] = ["digest.daily"];

/** O lead do time em demonstração — a lente que enxerga a caixa inteira do mock. */
const leadDaDemonstracao: NoticesViewer = {
  role: "tech_lead",
  professionalId: null,
  memberships: [{ teamId: "time-do-lead-eef4b11a-31be-40ca-9b97-2889851e85c3", role: "tech_lead" }],
};

const tiposDaDemonstracao = async (): Promise<string[]> => {
  const page = await new InMemoryNoticesGateway(() => Promise.resolve(leadDaDemonstracao)).notices({
    status: "all",
  });
  return [...new Set(page.notices.map((notice) => notice.eventType))];
};

function arquivoOriginal(): string | undefined {
  let diretorio = dirname(fileURLToPath(import.meta.url));
  for (let subida = 0; subida < 8; subida += 1) {
    const alvo = join(diretorio, ORIGEM_DA_COPIA);
    if (existsSync(alvo)) return alvo;
    const pai = dirname(diretorio);
    if (pai === diretorio) return undefined;
    diretorio = pai;
  }
  return undefined;
}

/** `static readonly nomeDoCampo = "valor";` — a única forma que `NoticeEventType` usa. */
const literaisDeclaradosEm = (fonte: string): string[] =>
  [...fonte.matchAll(/static\s+readonly\s+\w+\s*=\s*"([^"]+)"/g)].map((achado) => achado[1]!);

const policy = new NoticeRoutingPolicy();

describe("a decoração de aviso não inventa tipo de evento", () => {
  it("todo eventType decorado é emitido pelo backend ou pela base de demonstração", async () => {
    const emissores = new Set([...TIPOS_EMITIDOS_PELO_BACKEND, ...(await tiposDaDemonstracao())]);

    const orfas = policy.decoratedEventTypes().filter((tipo) => !emissores.has(tipo));

    expect(
      orfas,
      `decoração sem emissor em src/lib/notice-routing-policy.ts — nem "${ORIGEM_DA_COPIA}" nem o InMemoryNoticesGateway produzem esses tipos`,
    ).toEqual([]);
  });

  it("os tipos emitidos que ficam sem decoração são exatamente os declarados", async () => {
    const decorados = new Set(policy.decoratedEventTypes());

    const semDecoracao = TIPOS_EMITIDOS_PELO_BACKEND.filter((tipo) => !decorados.has(tipo));

    expect(semDecoracao).toEqual([...TIPOS_SEM_DECORACAO]);
  });

  it("o que a demonstração produz é decorado — a caixa sem backend não cai no genérico", async () => {
    const decorados = new Set(policy.decoratedEventTypes());

    const semDecoracao = (await tiposDaDemonstracao()).filter((tipo) => !decorados.has(tipo));

    expect(semDecoracao).toEqual([]);
  });
});

describe("procedência da cópia de NoticeEventType", () => {
  /**
   * Oportunista de propósito. Exigir o repositório vizinho seria o teste que
   * o ADR-0023 recusou — o que só passa em quem tem os dois clonados. Como
   * aviso, porém, ele é exatamente o que impede a cópia de envelhecer calada:
   * na máquina de quem desenvolve, uma divergência aparece no `npm test`.
   */
  it.skipIf(arquivoOriginal() === undefined)(
    "a cópia lista os mesmos tipos que o backend declara, quando os dois repositórios estão lado a lado",
    () => {
      const original = arquivoOriginal();
      if (original === undefined) return;

      expect(
        literaisDeclaradosEm(readFileSync(original, "utf8")).sort(),
        `cópia defasada: releia "${original}" e ajuste TIPOS_EMITIDOS_PELO_BACKEND`,
      ).toEqual([...TIPOS_EMITIDOS_PELO_BACKEND].sort());
    },
  );
});
