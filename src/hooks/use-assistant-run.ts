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
 */
export function useAssistantRun<P, T>(
  queryKey: readonly unknown[],
  ask: (request: P) => Promise<T>,
): AssistantRunState<P, T> {
  const [requested, setRequested] = useState<P | null>(null);
  const query = useQuery({
    queryKey: [...queryKey, requested],
    queryFn: () => ask(requested as P),
    enabled: requested !== null,
    retry: false,
    staleTime: Infinity,
  });
  return new AssistantRunState<P, T>(query, requested, (request) => {
    setRequested(request);
  });
}
