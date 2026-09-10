import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { raizDoFrontend } from "../helpers/catraca";

/**
 * Dono (2026-09-09, com duas capturas): *"O bloco acima é uma grande
 * padronização. A ideia aqui é mantermos os títulos das páginas sempre
 * visíveis. Utilize orientação a objeto para aplicar essa refatoração
 * reutilizando componentes."*
 *
 * Isto NÃO são treze pedidos: é um só, aplicado em treze telas. O objetivo é
 * que o título da página pare de sair da janela — a PÁGINA deixa de rolar e
 * quem rola é o bloco de dentro. A receita nasceu no conserto das Maiores
 * Distâncias do PDI (`ShellHeader.sideRailClass`, commit `7c283c0`); com
 * quinze ocorrências ela deixou de ser classe e virou COMPONENTE
 * (`ScrollPane`), que é o reuso que o dono pediu.
 *
 * Esta régua é a lista do dono virada em asserção: cada bloco que ele apontou
 * tem de estar DENTRO do componente único. Prova do vermelho no dia:
 * nenhum dos onze arquivos importava `ScrollPane`.
 *
 * O bloco 8 (Mentoria e 1:1 → Linha do Tempo) entrou depois, quando o arquivo
 * ficou livre: a fatia que tirava a IA daquela tela estava dentro dele.
 *
 * TRÊS BLOCOS SAÍRAM em 2026-09-10, com as telas deles (pedido do dono): os
 * dois do Plano de Capacitação (5 e 6) e o da Calibração de Líderes (12). A
 * numeração do PEDIDO fica como estava de propósito — ela é a referência da
 * lista que o dono escreveu, não um índice de array, e renumerar apagaria a
 * conversa. A régua não mudou; o que sumiu foram três exemplos dela.
 */
const fonte = (caminho: string) => readFileSync(join(raizDoFrontend, caminho), "utf8");

/** Um bloco da lista do dono: onde ele mora e por qual rótulo a caixa se anuncia. */
const BLOCOS: readonly { pedido: string; arquivo: string; rotulo: string }[] = [
  {
    pedido: "1 — Talentos do Time, a lista, nas duas visões",
    arquivo: join("src", "components", "app", "team-shared.tsx"),
    rotulo: "pane.teamRoster.label",
  },
  {
    pedido: "2 — Prioridades de Desenvolvimento, o Radar de Capacidades",
    arquivo: join("src", "routes", "gap-analysis.tsx"),
    rotulo: "pane.gapRadar.label",
  },
  {
    pedido: "3 — Prioridades de Desenvolvimento, a lista de prioridades",
    arquivo: join("src", "routes", "gap-analysis.tsx"),
    rotulo: "pane.gapPriorities.label",
  },
  {
    pedido: "4 — Prontidão para Progressão, a tabela das competências em evolução",
    arquivo: join("src", "components", "app", "gap-analysis-shared.tsx"),
    rotulo: "pane.gapTable.label",
  },
  {
    pedido: "7 — Trilhas de Aprendizagem, a lista de trilhas",
    arquivo: join("src", "routes", "learning-paths.tsx"),
    rotulo: "pane.learningPaths.label",
  },
  {
    pedido: "8 — Mentoria e 1:1, Linha do Tempo",
    arquivo: join("src", "components", "app", "mentoring-shared.tsx"),
    rotulo: "pane.mentoringTimeline.label",
  },
  {
    pedido: "9 — Ciclos de Avaliação, Comparação de Competências",
    arquivo: join("src", "routes", "cycles.tsx"),
    rotulo: "pane.cycleCompare.label",
  },
  {
    pedido: "10 — Perfil de Competências do Time, Competências",
    arquivo: join("src", "routes", "team-rules.tsx"),
    rotulo: "pane.teamRuleCompetencies.label",
  },
  {
    pedido: "11 — Catálogo de Competências, a lista",
    arquivo: join("src", "routes", "competency-matrix.tsx"),
    rotulo: "pane.competencyCatalog.label",
  },
  {
    pedido: "13 — Estrutura de Times, Times Cadastrados",
    arquivo: join("src", "routes", "teams.tsx"),
    rotulo: "pane.teamsRegistry.label",
  },
  {
    pedido: "14 — Contas e Acessos, Contas Cadastradas",
    arquivo: join("src", "routes", "users.tsx"),
    rotulo: "pane.usersRegistry.label",
  },
  {
    pedido: "15 — Central do Usuário, Avisos",
    arquivo: join("src", "routes", "notices.tsx"),
    rotulo: "pane.notices.label",
  },
  /*
   * O bloco 16 — "Catálogo de Competências, Arquivadas" — entrou de manhã em
   * 2026-09-10 e SAIU à tarde do mesmo dia, com o conceito de arquivado (dono:
   * *"remova o conceito de arquivado"*). A caixa que ocupava o resto da página
   * naquela tela não existe mais; quem ocupa o resto lá é a caixa do bloco 11,
   * que voltou a ser `restOfPage()` porque perdeu a vizinha de baixo.
   *
   * O bloco 17 é a AVALIAÇÃO DE DESEMPENHO (dono, 2026-09-10): *"um bloco com
   * capacidades › competências ocupando a tela em 100%, com folga no rodapé e
   * rolagem por dentro"*.
   */
  {
    pedido: "17 — Avaliação de Desempenho, capacidades › competências",
    arquivo: join("src", "routes", "assessments.tsx"),
    rotulo: "asmt.allCapabilities",
  },
];

describe("o título da página fica sempre visível — quem rola é o bloco", () => {
  it("cada bloco da lista do dono está dentro do componente único", () => {
    const faltando = BLOCOS.filter(({ arquivo, rotulo }) => {
      const conteudo = fonte(arquivo);
      return !conteudo.includes("<ScrollPane") || !conteudo.includes(rotulo);
    }).map(({ pedido }) => pedido);
    expect(faltando).toEqual([]);
  });

  it("nenhuma tela monta a caixa à mão: o teto e a rolagem vêm do componente", () => {
    const aMao = BLOCOS.map(({ arquivo }) => arquivo)
      .filter((arquivo, indice, todos) => todos.indexOf(arquivo) === indice)
      .filter((arquivo) => /className="[^"]*\bmax-h-\[\d+px\]/.test(fonte(arquivo)));
    expect(aMao).toEqual([]);
  });

  it("os dois dicionários batem no rótulo de cada caixa", () => {
    const pt = JSON.parse(fonte(join("src", "locales", "pt.json"))) as Record<string, string>;
    const en = JSON.parse(fonte(join("src", "locales", "en.json"))) as Record<string, string>;
    const semTraducao = BLOCOS.filter(
      ({ rotulo }) => pt[rotulo] === undefined || en[rotulo] === undefined,
    ).map(({ rotulo }) => rotulo);
    expect(semTraducao).toEqual([]);
  });
});

/**
 * O pedido extra do mesmo dono, no mesmo dia, sobre o bloco *Capacidades da
 * Régua* (Modelo de Carreira → Perfil de Competências do Time): *"apagar a
 * fileira de chips de capacidade logo abaixo de 'Piso de capacidades
 * qualificadas'"* — ela não filtra nada, é repetição do que o seletor
 * "Capacidades exigidas" já diz.
 *
 * Só que cada chip carregava um selo quando aquela capacidade precisava de
 * curadoria, e o aviso logo abaixo acendia SEM dizer qual. Então a fileira sai
 * e o aviso passa a NOMEAR as capacidades: nada se perde, e o que faltava
 * passa a existir.
 *
 * Prova do vermelho contra o código antigo: a fileira estava lá
 * (`teamRules.capability.requiresCuration` na tela) e o aviso não tinha
 * interpolação nenhuma.
 */
describe("as capacidades da régua: a fileira sai, o aviso passa a nomear", () => {
  const tela = fonte(join("src", "routes", "team-rules.tsx"));
  const AVISO = "teamRules.capability.curationNotice";

  it("a fileira de chips de capacidade não existe mais na tela", () => {
    expect(tela).not.toContain("teamRules.capability.requiresCuration");
  });

  it("o aviso recebe os nomes das capacidades que aguardam curadoria", () => {
    expect(tela).toMatch(new RegExp(`${AVISO}["'],\\s*\\{\\s*\\n?\\s*capacidades:`));
  });

  it("os dois dicionários pedem o nome das capacidades no aviso", () => {
    for (const idioma of ["pt.json", "en.json"]) {
      const dicionario = JSON.parse(fonte(join("src", "locales", idioma))) as Record<
        string,
        string
      >;
      expect(dicionario[AVISO]).toContain("{capacidades}");
    }
  });
});
