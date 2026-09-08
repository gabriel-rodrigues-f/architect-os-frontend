import type { SessionUser } from "./api";
import type { MessageKey } from "./i18n";
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
 * O `search` existe porque levar à TELA não basta (pedido do dono, item 12):
 * o botão do time vazio abre o FORMULÁRIO de cadastro de times, não a lista
 * de times. Quem não tem formulário para abrir — o ciclo — não declara
 * nenhum, e o botão leva à tela e pronto.
 */
export interface RegistrationSearch {
  readonly cadastrar: "profissional" | "time" | "capacidade";
}

type ReachQuestion = (policy: UiAuthorizationPolicy, user: SessionUser) => boolean;

export class Registration {
  /** A pessoa nasce em Contas e Acessos — conta e profissional num ato só. */
  static readonly PROFESSIONAL = new Registration(
    "people",
    "/users",
    { cadastrar: "profissional" },
    "team.empty.cta",
    (policy, user) => policy.canAdministerPeople(user),
  );

  /** O time nasce em Estrutura de Times, pelo formulário de cadastro. */
  static readonly TEAM = new Registration(
    "teams",
    "/teams",
    { cadastrar: "time" },
    "teams.create.action",
    (policy, user) => policy.canAdministerPeople(user),
  );

  /** O ciclo nasce em Ciclos de Avaliação — a tela inteira é o cadastro. */
  static readonly CYCLE = new Registration(
    "cycles",
    "/cycles",
    undefined,
    "cycle.new",
    (policy, user) => policy.isLeadership(user),
  );

  /** A capacidade nasce no Catálogo de Competências, pelo diálogo de cadastro. */
  static readonly CAPABILITY = new Registration(
    "capabilities",
    "/competency-matrix",
    { cadastrar: "capacidade" },
    "matrix.newCapability",
    (policy, user) => policy.operatesTheSystem(user),
  );

  private constructor(
    /** O assunto, que também nomeia as chaves de texto: `<assunto>.selector.*`. */
    readonly subject: string,
    readonly to: string,
    readonly search: RegistrationSearch | undefined,
    /**
     * O rótulo do BOTÃO de cadastro — a palavra que o dono ditou tela a tela
     * ("Cadastrar Profissional", "Cadastrar Capacidade", "Cadastrar Ciclo",
     * "Cadastrar Time"). Aponta para a chave que a tela DONA do assunto já
     * usa no canto: um assunto, uma palavra, escrita uma vez só.
     */
    private readonly actionKey: MessageKey,
    private readonly reaches: ReachQuestion,
  ) {}

  /** "Não há profissionais cadastrados" — o que o filtro bloqueado diz. */
  get emptyKey(): MessageKey {
    return `${this.subject}.selector.empty` as MessageKey;
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
