export const initialSearchParam = (name: string): string | undefined => {
  if (typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get(name) ?? undefined;
};

export const replaceSearchParam = (name: string, value: string | undefined): void => {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (value === undefined) {
    params.delete(name);
  } else {
    params.set(name, value);
  }
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", url);
};
