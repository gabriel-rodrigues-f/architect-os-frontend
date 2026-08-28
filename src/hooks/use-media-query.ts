import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [corresponde, setCorresponde] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setCorresponde(media.matches);

    const aoMudar = (evento: MediaQueryListEvent) => setCorresponde(evento.matches);
    media.addEventListener("change", aoMudar);
    return () => media.removeEventListener("change", aoMudar);
  }, [query]);

  return corresponde;
}
