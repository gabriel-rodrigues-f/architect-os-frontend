import { useState } from "react";

import { initialSearchParam, replaceSearchParam } from "@/lib/search-params";

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
