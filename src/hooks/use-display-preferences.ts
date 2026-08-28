import { useMediaQuery } from "./use-media-query";
import { useReducedMotion } from "./use-reduced-motion";

export function useIncreasedContrast(): boolean {
  return useMediaQuery("(prefers-contrast: more)");
}

export function useForcedColors(): boolean {
  return useMediaQuery("(forced-colors: active)");
}

export interface DisplayPreferences {
  readonly reducedMotion: boolean;

  readonly increasedContrast: boolean;

  readonly forcedColors: boolean;

  readonly needsStrongerEncoding: boolean;
}

export function useDisplayPreferences(): DisplayPreferences {
  const reducedMotion = useReducedMotion();
  const increasedContrast = useIncreasedContrast();
  const forcedColors = useForcedColors();

  return {
    reducedMotion,
    increasedContrast,
    forcedColors,
    needsStrongerEncoding: increasedContrast || forcedColors,
  };
}
