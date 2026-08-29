import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

const EDGE_TOLERANCE_PX = 1;

export interface HorizontalOverflow<T extends HTMLElement> {
  scrollRef: RefObject<T | null>;
  overflowStart: boolean;
  overflowEnd: boolean;
}

export function useHorizontalOverflow<T extends HTMLElement>(): HorizontalOverflow<T> {
  const scrollRef = useRef<T | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const maxScroll = element.scrollWidth - element.clientWidth;
    const next = {
      start: element.scrollLeft > EDGE_TOLERANCE_PX,
      end: maxScroll - element.scrollLeft > EDGE_TOLERANCE_PX,
    };
    setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
  }, []);

  useEffect(() => {
    measure();
    const element = scrollRef.current;
    if (!element) return;
    element.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      element.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [measure]);

  return { scrollRef, overflowStart: edges.start, overflowEnd: edges.end };
}
