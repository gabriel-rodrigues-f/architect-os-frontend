import { useEffect, useState } from "react";

export function useNarrowViewport(breakpointPx = 640): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    setNarrow(media.matches);

    const aoMudar = (e: MediaQueryListEvent) => setNarrow(e.matches);
    media.addEventListener("change", aoMudar);
    return () => media.removeEventListener("change", aoMudar);
  }, [breakpointPx]);

  return narrow;
}
