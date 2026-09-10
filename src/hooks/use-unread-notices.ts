import { useQuery } from "@tanstack/react-query";

import { noticesApi, type SessionUser } from "@/lib/api";

/**
 * A CHAVE DA CAIXA DE AVISOS. Ela morava no `NoticeBell`, e o sino morreu
 * (dono, 2026-09-10: *"Vamos remover também o ícone de notificações"*). Quem
 * escreve na caixa — a tela de Avisos, o aviso de boas-vindas, a decisão de
 * uma transferência — continua invalidando por aqui, num prefixo só.
 */
export const NOTICES_QUERY_KEY = ["notices"] as const;

const UNREAD_REFRESH_MS = 60_000;

/**
 * QUANTOS AVISOS NÃO LIDOS quem está logado tem (dono, 2026-09-10, com
 * captura): *"o próprio Central do Usuário → Avisos deve contabilizar, com um
 * número bem ao lado"*.
 *
 * A contagem é a do SERVIDOR (`unreadCount`), a mesma que o sino lia — a tela
 * não soma nada, e por isso não existe uma segunda verdade sobre o número. A
 * consulta pede a caixa não lida com limite 1: o que interessa aqui é o
 * contador, não a lista, e ele não depende do recorte nem do limite.
 *
 * Sem sessão a consulta nem sai, e sem resposta o número é zero — o selo não
 * inventa contagem quando a leitura falha.
 */
export function useUnreadNoticeCount(user: SessionUser | null | undefined): number {
  const query = useQuery({
    queryKey: [...NOTICES_QUERY_KEY, "unread"],
    queryFn: () => noticesApi.notices({ status: "unread", limit: 1 }),
    enabled: user != null,
    refetchInterval: UNREAD_REFRESH_MS,
  });
  return query.data?.unreadCount ?? 0;
}
