import { useEffect, useState } from "react";

export function useReducedMotion(): boolean {
  const [reduzido, setReduzido] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduzido(media.matches);

    const aoMudar = (e: MediaQueryListEvent) => setReduzido(e.matches);
    media.addEventListener("change", aoMudar);
    return () => media.removeEventListener("change", aoMudar);
  }, []);

  return reduzido;
}
