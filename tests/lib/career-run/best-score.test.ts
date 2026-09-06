import { beforeEach, describe, expect, it } from "vitest";

import { BestScore } from "@/lib/career-run";

describe("BestScore — o recorde fica só neste navegador", () => {
  beforeEach(() => window.localStorage.clear());

  it("começa em zero e guarda só quando supera", () => {
    expect(BestScore.read()).toBe(0);
    expect(BestScore.keep(120)).toBe(120);
    expect(BestScore.keep(80)).toBe(120);
    expect(BestScore.read()).toBe(120);
  });

  it("lixo guardado vale zero", () => {
    window.localStorage.setItem(BestScore.STORAGE_KEY, "abc");
    expect(BestScore.read()).toBe(0);
  });
});
