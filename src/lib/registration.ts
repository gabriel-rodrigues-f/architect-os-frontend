import type { SessionUser } from "./api";
import type { MessageKey } from "./i18n";
import { defaultUiAuthorizationPolicy, UiAuthorizationPolicy } from "./scope";

/**
 * ONDE A PRIMEIRA OPÇÃO DE UM SELETOR NASCE.
 *
 * Dono (2026-09-08), literal: *"o filtro hoje obscurecido passa a poder ser
 * aberto, mostrando 'Nenhum profissional cadastrado — clique para cadastrar',
 * que leva ao cadastro"*.
 *
 * Antes, cada tela repetia à mão as três coisas que um seletor vazio precisa
 * saber: a FRASE do domínio, a TELA de cadastro e QUEM alcança essa tela. Três
 * telas já repetiam isso (o seletor de ciclo do cabeçalho, o de time e o de
 * pessoa) — e a terceira esqueceu a pergunta de alcance. A régua mora aqui,
 * num objeto por assunto, e cada tela só diz QUAL assunto está vazio.
 *
 * O `search` existe porque levar à TELA não basta (pedido do dono, item 12):
 * o hiperlink do time vazio abre o FORMULÁRIO de cadastro de times, não a
 * lista de times. Quem não tem formulário para abrir — o ciclo — não declara
 * nenhum, e o link leva à tela e pronto.
 */
export interface RegistrationSearch {
  readonly cadastrar: "profissional" | "time";
}

type ReachQuestion = (policy: UiAuthorizationPolicy, user: SessionUser) => boolean;

export class Registration {
  /** A pessoa nasce em Contas e Acessos — conta e profissional num ato só. */
  static readonly PROFESSIONAL = new Registration(
    "people",
    "/users",
    { cadastrar: "profissional" },
    (policy, user) => policy.canAdministerPeople(user),
  );

  /** O time nasce em Estrutura de Times, pelo formulário de cadastro. */
  static readonly TEAM = new Registration(
    "teams",
    "/teams",
    { cadastrar: "time" },
    (policy, user) => policy.canAdministerPeople(user),
  );

  /** O ciclo nasce em Ciclos de Avaliação — a tela inteira é o cadastro. */
  static readonly CYCLE = new Registration("cycles", "/cycles", undefined, (policy, user) =>
    policy.isLeadership(user),
  );

  private constructor(
    /** O assunto, que também nomeia as chaves de texto: `<assunto>.selector.*`. */
    readonly subject: string,
    readonly to: string,
    readonly search: RegistrationSearch | undefined,
    private readonly reaches: ReachQuestion,
  ) {}

  /** "Nenhum profissional cadastrado — clique para cadastrar". */
  get emptyKey(): MessageKey {
    return `${this.subject}.selector.empty` as MessageKey;
  }

  /** "Cadastrar primeiro profissional" — o rótulo do hiperlink. */
  get registerKey(): MessageKey {
    return `${this.subject}.selector.register` as MessageKey;
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
