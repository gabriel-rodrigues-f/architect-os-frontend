/**
 * O SELO DE CONTAGEM DO ITEM DE MENU — um número em círculo, à direita do
 * rótulo, na cor da marca.
 *
 * Ele nasceu no item Talentos do Time, com as transferências a aprovar (dono,
 * 2026-09-06), e passa a servir também os Avisos (dono, 2026-09-10, com
 * captura: *"o próprio Central do Usuário → Avisos deve contabilizar, com um
 * número bem ao lado, conforme o print"*). Dois lugares com o mesmo desenho
 * são um componente, não duas cópias — e o `ml-auto` é o que encosta o selo na
 * direita da linha, como a captura mostra.
 *
 * ACIMA DE 99 o selo diz "99+": um número de três dígitos alargaria a coluna
 * inteira. O que ele CONTA continua dito por extenso no nome acessível, que é
 * quem carrega o número inteiro.
 */
export function NavCountBadge({ count, label }: { count: number; label: string }) {
  return (
    <span
      aria-label={label}
      title={label}
      className="ml-auto flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-meta font-semibold tabular-nums text-primary-foreground"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
