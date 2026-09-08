import type { I18nApi, MessageKey } from "./i18n";

/**
 * O ASSUNTO QUE AINDA NÃO TEM NENHUM — e a única frase que a aplicação usa
 * para dizer isso.
 *
 * Dono (2026-09-08), o mesmo diagnóstico repetido três vezes: *"se isso não
 * ocorre, é porque não estamos orientados a objeto o suficiente"*. A primeira
 * linha de todo estado vazio misturava "Nenhum…", "Nenhuma…", "Não há…" e
 * "…disponível" porque cada tela a escrevia à mão. A régua saiu das telas e
 * virou este objeto.
 *
 * O formato passa a ser um só, e vem de DUAS partes que ninguém escreve
 * junto: o molde (`Nenhum {assunto} cadastrado` / `Nenhuma {assunto}
 * cadastrada`) e o SUBSTANTIVO do assunto. A concordância não é escolha de
 * quem escreve tela: é o gênero declarado aqui, uma vez por assunto, que
 * escolhe o molde. Por isso não existe "Não há capacidades cadastradas" —
 * não há como escrevê-lo passando por este objeto.
 *
 * A LINHA 2 não mora aqui de propósito: ela explica a regra de negócio
 * DAQUELA tela, e por isso é declarada junto com o resto da configuração da
 * tela. Um assunto, uma linha 1; uma tela, uma linha 2.
 */
export type SubjectGender = "masculino" | "feminino";

export class EmptySubject {
  /** "Nenhum profissional cadastrado" — Talentos, PDI, Mentoria, Perfis… */
  static readonly PROFESSIONAL = new EmptySubject("professional", "masculino");

  /** "Nenhuma capacidade cadastrada" — Catálogo, Risco de Concentração, Avaliação. */
  static readonly CAPABILITY = new EmptySubject("capability", "feminino");

  /** "Nenhuma competência cadastrada" — a competência nasce DENTRO de uma capacidade. */
  static readonly COMPETENCY = new EmptySubject("competency", "feminino");

  /** "Nenhuma trilha cadastrada" — Trilhas de Aprendizagem. */
  static readonly LEARNING_PATH = new EmptySubject("learningPath", "feminino");

  /** "Nenhum ciclo cadastrado" — Ciclos de Avaliação, Calibração, cabeçalho. */
  static readonly CYCLE = new EmptySubject("cycle", "masculino");

  /** "Nenhum time cadastrado" — Perfil de Competências do Time, Contas e Acessos. */
  static readonly TEAM = new EmptySubject("team", "masculino");

  /** "Nenhum nível de carreira cadastrado" — as réguas e os filtros de nível. */
  static readonly CAREER_LEVEL = new EmptySubject("careerLevel", "masculino");

  /** Todos os assuntos, para a régua do formato poder varrer sem lista paralela. */
  static readonly ALL: readonly EmptySubject[] = [
    EmptySubject.PROFESSIONAL,
    EmptySubject.CAPABILITY,
    EmptySubject.COMPETENCY,
    EmptySubject.LEARNING_PATH,
    EmptySubject.CYCLE,
    EmptySubject.TEAM,
    EmptySubject.CAREER_LEVEL,
  ];

  private constructor(
    /** O nome do assunto, que também nomeia a chave do substantivo. */
    readonly name: string,
    /** O gênero do SUBSTANTIVO — quem escolhe o molde da frase. */
    readonly gender: SubjectGender,
  ) {}

  /** "profissional", "capacidade", "trilha" — o substantivo, sozinho. */
  get nounKey(): MessageKey {
    return `subject.${this.name}` as MessageKey;
  }

  /** O molde da linha 1, escolhido pela concordância do próprio assunto. */
  get patternKey(): MessageKey {
    return this.gender === "masculino" ? "empty.title.masculine" : "empty.title.feminine";
  }

  /** A LINHA 1, pronta: "Nenhuma capacidade cadastrada". Sem ponto final. */
  title(t: I18nApi["t"]): string {
    return t(this.patternKey, { assunto: t(this.nounKey) });
  }
}
