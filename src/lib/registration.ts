import { Building2, CalendarRange, Layers, Target, Users } from "lucide-react";

import { EmptySubject } from "./empty-subject";
import type { SessionUser } from "./api";
import type { I18nApi, MessageKey } from "./i18n";
import { defaultUiAuthorizationPolicy, UiAuthorizationPolicy } from "./scope";

/**
 * ONDE A PRIMEIRA OPÇÃO DE UM ASSUNTO NASCE.
 *
 * Dono (2026-09-08), literal, SUBSTITUINDO o desenho do convite dentro do
 * painel do filtro: *"o usuário precisa ver, à primeira vista, o botão de
 * cadastro quando não há nada cadastrado. Ao invés de aparecer como linha
 * clicável no filtro, vamos bloquear o filtro e disponibilizamos o botão de
 * criação mais abaixo, dentro do quadro principal e centralizado na tela."*
 *
 * O objeto continua sendo o mesmo, e é isso que fez a troca caber numa fatia:
 * cada tela só diz QUAL assunto está vazio; a FRASE do domínio, o RÓTULO do
 * botão, a TELA de cadastro e a pergunta de ALCANCE moram aqui. O que mudou
 * foi quem desenha — saiu o `EmptySelectionField`, entrou o
 * `EmptyStateCallToAction`, no centro do quadro principal.
 *
 * O CARTÃO DO FILTRO BLOQUEADO (dono, 2026-09-08) reusa este mesmo objeto: o
 * ícone do assunto, a linha 1 (do `EmptySubject`), a linha 2 (`hintKey`) e o
 * botão de largura cheia (`registerKey` + `to` + `search`) já moram aqui. O
 * campo só desenha; nenhuma tela escreve nada disso.
 *
 * O `search` existe porque levar à TELA não basta (pedido do dono, item 12):
 * o botão do time vazio abre o FORMULÁRIO de cadastro de times, não a lista
 * de times. E vale para TODO assunto que tem formulário — o ciclo era a
 * exceção que sobrava, e o dono a nomeou com a captura na mão (2026-09-08):
 * *"Ao clicar em 'Cadastrar primeiro ciclo', devo ser direcionado ao
 * formulário de cadastro de ciclo."* Quem de fato não tem formulário próprio
 * para abrir — a competência, que nasce DENTRO de uma capacidade — continua
 * sem declarar `search`, e o botão leva à tela e pronto.
 */
export interface RegistrationSearch {
  readonly cadastrar: "profissional" | "time" | "capacidade" | "ciclo";
}

type ReachQuestion = (policy: UiAuthorizationPolicy, user: SessionUser) => boolean;

/** A assinatura dos ícones lucide, como no `PageAction` e no `Callout`. */
type RegistrationIcon = typeof Users;

export class Registration {
  /** A pessoa nasce em Contas e Acessos — conta e profissional num ato só. */
  static readonly PROFESSIONAL = new Registration(
    "people",
    EmptySubject.PROFESSIONAL,
    "/users",
    { cadastrar: "profissional" },
    "team.empty.cta",
    Users,
    (policy, user) => policy.canAdministerPeople(user),
  );

  /** O time nasce em Estrutura de Times, pelo formulário de cadastro. */
  static readonly TEAM = new Registration(
    "teams",
    EmptySubject.TEAM,
    "/teams",
    { cadastrar: "time" },
    "teams.create.action",
    Building2,
    (policy, user) => policy.canAdministerPeople(user),
  );

  /** O ciclo nasce em Ciclos de Avaliação, pelo diálogo de cadastro. */
  static readonly CYCLE = new Registration(
    "cycles",
    EmptySubject.CYCLE,
    "/cycles",
    { cadastrar: "ciclo" },
    "cycle.new",
    CalendarRange,
    (policy, user) => policy.isLeadership(user),
  );

  /** A capacidade nasce no Catálogo de Competências, pelo diálogo de cadastro. */
  static readonly CAPABILITY = new Registration(
    "capabilities",
    EmptySubject.CAPABILITY,
    "/competency-matrix",
    { cadastrar: "capacidade" },
    "matrix.newCapability",
    Layers,
    (policy, user) => policy.operatesTheSystem(user),
  );

  /**
   * A competência nasce DENTRO de uma capacidade (regra de domínio), e por
   * isso o convite dela é para o Catálogo de Competências — não há formulário
   * de competência solta para abrir. Sem NENHUMA capacidade, o convite certo
   * não é este: é o da capacidade, e quem escolhe é a tela.
   */
  static readonly COMPETENCY = new Registration(
    "competencies",
    EmptySubject.COMPETENCY,
    "/competency-matrix",
    undefined,
    "competency.new",
    Target,
    (policy, user) => policy.operatesTheSystem(user),
  );

  private constructor(
    /** O assunto, que também nomeia as chaves de texto: `<assunto>.selector.*`. */
    readonly subject: string,
    /**
     * QUEM SABE A LINHA 1. O `Registration` sabe onde se cadastra; o
     * `EmptySubject` sabe como se diz que ainda não há nenhum. Nenhuma tela
     * escreve essa frase, e nenhuma pode escrevê-la diferente.
     */
    readonly emptySubject: EmptySubject,
    readonly to: string,
    readonly search: RegistrationSearch | undefined,
    /**
     * O rótulo do BOTÃO de cadastro — a palavra que o dono ditou tela a tela
     * ("Cadastrar Profissional", "Cadastrar Capacidade", "Cadastrar Ciclo",
     * "Cadastrar Time"). Aponta para a chave que a tela DONA do assunto já
     * usa no canto: um assunto, uma palavra, escrita uma vez só.
     */
    private readonly actionKey: MessageKey,
    /** O ÍCONE do assunto, para o cartão do filtro bloqueado. */
    readonly icon: RegistrationIcon,
    private readonly reaches: ReachQuestion,
  ) {}

  /** "Nenhum profissional cadastrado" — a LINHA 1, vinda do assunto. */
  emptyTitle(t: I18nApi["t"]): string {
    return this.emptySubject.title(t);
  }

  /**
   * A LINHA 2 do assunto: a regra de negócio que explica por que o filtro está
   * bloqueado. Mora aqui, e não na tela, porque é a mesma em todo filtro do
   * mesmo assunto — a linha 2 DA TELA continua sendo da tela, no
   * `EmptyStateCallToAction`.
   */
  get hintKey(): MessageKey {
    return `${this.subject}.selector.hint` as MessageKey;
  }

  /** "Cadastrar primeiro profissional" — o rótulo do hiperlink em meio a texto. */
  get registerKey(): MessageKey {
    return `${this.subject}.selector.register` as MessageKey;
  }

  /** "Cadastrar Profissional" — o rótulo do botão do centro da tela. */
  get ctaKey(): MessageKey {
    return this.actionKey;
  }

  /**
   * Quem alcança a tela de cadastro. Mandar alguém para uma porta fechada é
   * pior do que não oferecer porta nenhuma — por isso a pergunta vive junto
   * do destino, e não na cabeça de quem escreve tela.
   */
  reachedBy(
    user: SessionUser | null | undefined,
    policy: UiAuthorizationPolicy = defaultUiAuthorizationPolicy,
  ): boolean {
    return user != null && this.reaches(policy, user);
  }
}
