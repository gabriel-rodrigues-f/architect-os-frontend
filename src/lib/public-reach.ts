/**
 * AS ROTAS QUE A APLICAÇÃO ABRE SEM SESSÃO.
 *
 * Até esta fatia não existia nenhuma, e a catraca `alcance-por-rota` dizia
 * isso por escrito: enquanto o `AuthGate` do `__root` embrulhasse o
 * `<Outlet />`, declarar uma rota `publica` era mentira. A recuperação de
 * acesso quebra essa premissa por necessidade — quem clica no link do convite
 * NÃO TEM sessão, e é justamente por isso que está clicando.
 *
 * A lista mora aqui, e não solta dentro do `__root`, porque duas coisas
 * precisam concordar sobre ela: o portão (que decide o que desenhar) e a
 * matriz de alcance (que declara quem alcança cada rota). A catraca compara
 * as duas nos DOIS sentidos — rota declarada `publica` que não está nesta
 * lista é declaração sem código, e rota nesta lista que não se declara
 * `publica` é código sem declaração. Uma rota não escapa do portão em
 * silêncio.
 *
 * O caminho é comparado inteiro, sem prefixo: `/set-password` abre, e nada
 * abaixo dela abre junto. Escapar do portão é exceção nomeada, não uma
 * subárvore.
 */
export class PublicReach {
  static readonly ROUTES: readonly string[] = ["/set-password"];

  covers(pathname: string): boolean {
    return PublicReach.ROUTES.includes(PublicReach.withoutTrailingSlash(pathname));
  }

  /** `/set-password/` é o mesmo endereço que `/set-password`. */
  private static withoutTrailingSlash(pathname: string): string {
    return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  }
}

export const defaultPublicReach = new PublicReach();
