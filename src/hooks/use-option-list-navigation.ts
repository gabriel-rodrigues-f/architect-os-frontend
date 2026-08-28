import { useRef, type KeyboardEvent } from "react";

export function useOptionListNavigation({
  optionCount,
  entryIndex = 0,
  openList,
}: {
  optionCount: number;
  entryIndex?: number;
  openList: () => void;
}) {
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const entry = entryIndex >= 0 && entryIndex < optionCount ? entryIndex : 0;

  const focusOption = (index: number) => {
    if (optionCount === 0) return;
    optionRefs.current[((index % optionCount) + optionCount) % optionCount]?.focus();
  };

  const optionProps = (index: number) => ({
    ref: (element: HTMLButtonElement | null) => {
      optionRefs.current[index] = element;
    },
    tabIndex: index === entry ? 0 : -1,
  });

  const onListKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const focused = optionRefs.current.findIndex((element) => element === document.activeElement);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusOption(focused + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusOption(focused - 1);
        break;
      case "Home":
        event.preventDefault();
        focusOption(0);
        break;
      case "End":
        event.preventDefault();
        focusOption(optionCount - 1);
        break;
    }
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    openList();
  };

  return { optionProps, onListKeyDown, onTriggerKeyDown };
}
