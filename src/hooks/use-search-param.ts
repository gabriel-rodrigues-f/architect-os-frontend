import { useState } from "react";

import { initialSearchParam, replaceSearchParam } from "@/lib/search-params";

/**
 * OO3-11b — o par `useState(() => initialSearchParam(...))` + setter que
 * escreve de volta estava copiado em 5 telas com variações mínimas. Dois
 * hooks pequenos em vez de um genérico com codec: lista CSV × escalar são
 * os dois únicos formatos reais, e a legibilidade dos call sites vale mais
 * que a unificação total.
 */

/**
 * Lista CSV na querystring, com escrita de volta em `replaceState`.
 * Ausente = default do chamador; presente e vazio (`?x=`) = seleção vazia
 * explícita. `computeDefault` só roda no inicializador preguiçoso do
 * `useState` — nunca a cada render (o default típico é a população visível,
 * que não deve ser recalculada por render).
 */
export function useSearchParamList(
  name: string,
  computeDefault: () => string[],
): readonly [string[], (ids: string[]) => void] {
  const [value, setValue] = useState<string[]>(() => {
    const fromUrl = initialSearchParam(name);
    if (fromUrl === undefined) return computeDefault();
    return fromUrl === "" ? [] : fromUrl.split(",");
  });
  const set = (ids: string[]) => {
    setValue(ids);
    replaceSearchParam(name, ids.join(","));
  };
  return [value, set] as const;
}

/**
 * Escalar lido UMA vez da URL. `writeBack` default `false` — preserva o
 * comportamento atual de `/assessments` e `/development-plans`, que leem o
 * parâmetro na montagem e nunca o reescrevem na URL ao trocar a seleção.
 */
export function useSearchParamString(
  name: string,
  computeFallback: () => string,
  options?: { writeBack?: boolean },
): readonly [string, (value: string) => void] {
  const [value, setValue] = useState<string>(() => initialSearchParam(name) ?? computeFallback());
  const set = (next: string) => {
    setValue(next);
    if (options?.writeBack) replaceSearchParam(name, next);
  };
  return [value, set] as const;
}
