import { useEffect, useState } from "react";

const matchesNow = (query: string): boolean =>
  typeof window !== "undefined" && window.matchMedia(query).matches;

export function useMediaQuery(query: string): boolean {
  const [corresponde, setCorresponde] = useState(() => matchesNow(query));

  useEffect(() => {
    const media = window.matchMedia(query);
    setCorresponde(media.matches);

    const aoMudar = (evento: MediaQueryListEvent) => setCorresponde(evento.matches);
    media.addEventListener("change", aoMudar);
    return () => media.removeEventListener("change", aoMudar);
  }, [query]);

  return corresponde;
}
