import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AssistantRunState } from "@/lib/assistants";

/**
 * O adaptador fino do idioma da casa: assina o estado do React Query e
 * devolve a CLASSE que decide (`AssistantRunState`). Nenhuma regra mora aqui.
 *
 * `retry: false` é deliberado: a política global de repetição transformaria
 * um tempo-limite de 45 s em dois minutos de espera, e o botão "tentar
 * novamente" existe justamente para a pessoa decidir se quer gastar outra
 * chamada do provedor. `staleTime: Infinity` pelo mesmo motivo — sugestão
 * gerada não se revalida sozinha nas costas de quem está lendo.
 *
 * O PEDIDO É DO ASSUNTO (dono, 2026-09-08, item 9): a `queryKey` diz de quem
 * é a sugestão, e o pedido guardado vale só enquanto o assunto for aquele.
 * Trocar a pessoa selecionada esquece o pedido anterior — a tela volta ao
 * estado "ninguém pediu nada", em vez de manter na tela (ou refazer sozinha,
 * às custas do provedor) a sugestão de quem já saiu da seleção.
 */
export function useAssistantRun<P, T>(
  queryKey: readonly unknown[],
  ask: (request: P) => Promise<T>,
): AssistantRunState<P, T> {
  const subject = JSON.stringify(queryKey);
  const [asked, setAsked] = useState<{ subject: string; request: P } | null>(null);
  // Ajuste de estado durante a renderização (padrão do React para "estado
  // derivado que precisa zerar"): o assunto mudou, o pedido anterior morreu.
  if (asked !== null && asked.subject !== subject) setAsked(null);
  const requested = asked !== null && asked.subject === subject ? asked.request : null;
  const query = useQuery({
    queryKey: [...queryKey, requested],
    queryFn: () => ask(requested as P),
    enabled: requested !== null,
    retry: false,
    staleTime: Infinity,
  });
  return new AssistantRunState<P, T>(query, requested, (request) => {
    setAsked({ subject, request });
  });
}
