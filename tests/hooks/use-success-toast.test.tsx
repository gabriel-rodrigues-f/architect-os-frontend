import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSuccessToast } from "@/hooks/use-async-submit";
import { ApiClient } from "@/lib/api-client";
import { I18nProvider } from "@/lib/i18n";

const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }));

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function wrapper({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

describe("useSuccessToast — toast pelo message code do servidor (RF-05)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    toastSuccess.mockReset();
    vi.unstubAllGlobals();
  });

  it("prefere o code do servidor quando presente no resultado", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { data: { id: "c1" }, message: { code: "people.careerLevelTransition.success" } },
        201,
      ),
    );
    const client = new ApiClient("http://api.local");
    const result = await client.post<{ id: string }>("/api/architects/c1/career-level", {});

    const { result: hook } = renderHook(() => useSuccessToast(), { wrapper });
    act(() => hook.current("team.reactivate.toast", { nome: "Ana" }, result));
    expect(toastSuccess).toHaveBeenCalledWith("Nível de carreira de Ana atualizado.");
  });

  it("cai no texto local quando o servidor não manda code", () => {
    const { result: hook } = renderHook(() => useSuccessToast(), { wrapper });
    act(() => hook.current("team.reactivate.toast", { nome: "Ana" }));
    expect(toastSuccess).toHaveBeenCalledWith("Ana reativado(a)");
  });

  it("cai no texto local quando o code não tem chave semeada", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { id: "x" }, message: { code: "algum.code.desconhecido" } }),
    );
    const client = new ApiClient("http://api.local");
    const result = await client.post<{ id: string }>("/api/misc", {});

    const { result: hook } = renderHook(() => useSuccessToast(), { wrapper });
    act(() => hook.current("team.reactivate.toast", { nome: "Ana" }, result));
    expect(toastSuccess).toHaveBeenCalledWith("Ana reativado(a)");
  });
});
