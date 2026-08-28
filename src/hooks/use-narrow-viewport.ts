import { useMediaQuery } from "./use-media-query";

export function useNarrowViewport(breakpointPx = 640): boolean {
  return useMediaQuery(`(max-width: ${String(breakpointPx)}px)`);
}
