import type { SessionUser } from "./api";
import type { Professional } from "./domain";
import { defaultUiAuthorizationPolicy, type UiAuthorizationPolicy } from "./scope";

type ScopedProfessional = Pick<Professional, "id" | "teamId">;

/**
 * UMA LISTAGEM POR PESSOA — E A DIFERENÇA ENTRE "NÃO TEM" E "NÃO POSSO VER".
 *
 * As quatro listagens por pessoa da ficha (avaliações, PDI, mentoria, trilhas)
 * respondiam `403` a quem não alcança a pessoa. Elas passaram a responder
 * `200 []`, e a decisão é certa: o par 403/200 era um ORÁCULO — quem
 * perguntava descobria se aquela pessoa existe.
 *
 * O preço é que a lista vazia deixou de ser prova. Antes, `[]` só chegava à
 * tela quando de fato não havia nada; agora `[]` é DUAS histórias com a mesma
 * forma — "esta pessoa não tem nenhuma" e "estas não são suas para ver". A
 * ficha vinha afirmando a primeira: "0" no cartão, "0 sessões registradas",
 * "nenhuma trilha cobre" a pessoa inteira.
 *
 * Este objeto é a pergunta que falta antes de afirmar. Onde a tela não pode
 * distinguir as duas histórias, ela não conta nenhuma das duas.
 */
export class PersonListing<Item> {
  private constructor(
    readonly items: readonly Item[],
    private readonly reached: boolean,
  ) {}

  static of<Item>(items: readonly Item[], reached: boolean): PersonListing<Item> {
    return new PersonListing(items, reached);
  }

  /**
   * A tela SABE o que há aqui? Ou porque alcança a pessoa, ou porque a lista
   * veio com linhas — servidor que entrega linha não recusou.
   */
  get isKnown(): boolean {
    return this.reached || this.items.length > 0;
  }

  /** O contador — `undefined` onde "nenhum" e "não posso ver" são a MESMA lista vazia. */
  get count(): number | undefined {
    return this.isKnown ? this.items.length : undefined;
  }

  /** Vazio COMPROVADO: não há nada, e quem olha pode dizer isso. */
  get isEmptyForSure(): boolean {
    return this.isKnown && this.items.length === 0;
  }
}

/**
 * SOBRE QUEM A FICHA LÊ DESEMPENHO — avaliações, PDI, mentoria, trilhas.
 *
 * Espelha `AuthorizationService.visibleProfessionalIds` do servidor, e é uma
 * pergunta DIFERENTE da do diretório (`directoryScope`, que responde quem
 * aparece na lista de pessoas). A diferença tem nome e está medida: quem opera
 * o sistema lê o diretório inteiro e NÃO lê o desempenho de ninguém — o
 * suporte só lê uma pessoa em modo de suporte, por ticket, e a ficha o desvia
 * para lá antes de qualquer aba.
 *
 * A guarda de navegação da ficha é a do PAPEL (`canOpenCareerTabsOf` com o id
 * na mão, que é tudo o que a rota tem antes de o estado chegar); esta é a do
 * VÍNCULO, e é a que as telas fazem depois, com a pessoa em mãos.
 */
export class CareerFileReach {
  constructor(private readonly policy: UiAuthorizationPolicy) {}

  /** Quem lê os números desta pessoa: ela mesma, quem a lidera por vínculo, o administrador. */
  readsPerformanceOf(
    user: SessionUser | null,
    professional: ScopedProfessional | undefined,
  ): boolean {
    if (!user || !professional) return false;
    if (this.policy.readsOwn(user, professional.id)) return true;
    if (this.policy.readsTheOrganization(user)) return true;
    return this.policy.leadsTeamOf(user, professional);
  }

  /** A listagem com o alcance ao lado — a forma em que a tela deve recebê-la. */
  listingOf<Item>(
    user: SessionUser | null,
    professional: ScopedProfessional | undefined,
    items: readonly Item[],
  ): PersonListing<Item> {
    return PersonListing.of(items, this.readsPerformanceOf(user, professional));
  }
}

export const defaultCareerFileReach = new CareerFileReach(defaultUiAuthorizationPolicy);
