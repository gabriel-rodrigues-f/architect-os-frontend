import { browserMemory } from "../browser-memory";
import { UserRoles, type SessionUser, type UserRole } from "../gateways/auth.gateway";

/**
 * A SAUDAÇÃO DO PRIMEIRO ACESSO (dono, 2026-09-08).
 *
 * Literal dele: *"a notificação de primeiro acesso do dia é realmente uma
 * notificação; depois que ela fecha não consigo vê-la na lista. Vamos mudar a
 * dinâmica: em vez de todos os dias, mostrar somente no primeiro acesso da
 * pessoa na plataforma. (...) Essa notificação deve ser visível depois, como
 * qualquer outra, ao clicar no sininho."*
 *
 * O QUE MUDOU DE LUGAR. Até aqui a saudação era só tela, com uma marca de DIA
 * no `localStorage`: ela nascia e morria no navegador, e por isso sumia para
 * sempre ao fechar. Agora quem sabe que a pessoa foi saudada é o SERVIDOR — o
 * aviso `welcome.first-access`, endereçado a ela, nasce uma vez no primeiro
 * acesso concluído e fica na caixa do sininho como qualquer outro.
 *
 * O que sobra no navegador é só a pergunta "eu já pisquei este brinde AQUI?".
 * É conveniência de quem está olhando, não estado do produto: perdê-la (janela
 * privada, dados limpos, outro aparelho) mostra o toast mais uma vez, e não
 * duplica aviso nenhum — o aviso é um só, no servidor.
 *
 * Repare no que NÃO é feito de propósito: o toast não marca o aviso como lido.
 * Quem lê e marca é a pessoa, no sininho, "como qualquer outra" — foi essa a
 * frase do dono, e ela é a diferença entre uma notificação e um pop-up.
 */
type GreetingKey =
  | "greeting.manager"
  | "greeting.techLead"
  | "greeting.member"
  | "greeting.admin"
  | "greeting.director";

/** Uma saudação por papel — a de quem mantém o sistema é do suporte (o antigo admin); o administrador tem a dela. */
const GREETING_BY_ROLE: Record<UserRole, GreetingKey> = {
  [UserRoles.ADMIN]: "greeting.director",
  [UserRoles.SUPPORT]: "greeting.admin",
  [UserRoles.MANAGER]: "greeting.manager",
  [UserRoles.TECH_LEAD]: "greeting.techLead",
  [UserRoles.MEMBER]: "greeting.member",
};

export class WelcomeGreeting {
  /** O tipo do aviso que o backend emite no primeiro acesso concluído. */
  static readonly EVENT_TYPE = "welcome.first-access";

  static readonly STORAGE_KEY = "synapse:welcome-greeting";

  static readonly VISIBLE_MS = 3000;

  /** Cabe piscar o toast NESTE navegador? Só se ele ainda não piscou para esta conta. */
  static isDueFor(user: Pick<SessionUser, "id">): boolean {
    return browserMemory.read(WelcomeGreeting.STORAGE_KEY) !== user.id;
  }

  static markShown(user: Pick<SessionUser, "id">): void {
    browserMemory.write(WelcomeGreeting.STORAGE_KEY, user.id);
  }

  /** O primeiro nome, como a pessoa é chamada. */
  static firstNameOf(name: string): string {
    return name.trim().split(/\s+/)[0] ?? name;
  }

  /** A chave da mensagem por perfil — os textos são do dono, em `greeting.*`. */
  static messageKeyFor(role: SessionUser["role"]): GreetingKey {
    return GREETING_BY_ROLE[role];
  }
}
