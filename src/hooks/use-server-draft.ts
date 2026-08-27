import { useState, type Dispatch, type SetStateAction } from "react";

export function useServerDraft<T>(serverValue: T): {
  draft: T;
  setDraft: Dispatch<SetStateAction<T>>;
  changed: boolean;
} {
  const [draft, setDraft] = useState(serverValue);
  return { draft, setDraft, changed: !Object.is(draft, serverValue) };
}
