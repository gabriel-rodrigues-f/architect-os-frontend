import { describe, expect, it, vi } from "vitest";

import type { Api } from "@/lib/store";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { emptyArchitectForm, TeamViewModel } from "@/lib/view-models";

/**
 * ENG-04 — o nível de carreira do primeiro cadastro vinha de
 * `(careerLevels[0]?.name ?? "") as RoleName`: sem nível configurado, o
 * formulário nascia com um cargo INVENTADO (string vazia disfarçada de
 * `RoleName`) e mandava isso no POST de criação. Ausência de nível é erro,
 * não default.
 */

const service = () => ({
  addArchitect: vi.fn().mockResolvedValue({}),
  updateArchitect: vi.fn(),
  transitionCareerLevel: vi.fn(),
  deactivate: vi.fn(),
});

const filledForm = () => ({
  ...emptyArchitectForm(""),
  name: "Nova Pessoa",
  email: "nova@company.com",
  years: "3",
});

describe("cadastro de arquiteto sem nível de carreira configurado", () => {
  it("não deixa submeter enquanto o nível de carreira estiver vazio", () => {
    const viewModel = new TeamViewModel(service() as unknown as Api, defaultUiAuthorizationPolicy);

    expect(viewModel.validate(filledForm()).canSubmit).toBe(false);
    expect(viewModel.validate({ ...filledForm(), role: "Arquiteto de Soluções I" }).canSubmit).toBe(
      true,
    );
  });

  it("recusa a criação em vez de mandar um cargo vazio para o servidor", async () => {
    const calls = service();
    const viewModel = new TeamViewModel(calls as unknown as Api, defaultUiAuthorizationPolicy);

    await expect(viewModel.submit(filledForm(), null)).rejects.toBeInstanceOf(Error);
    expect(calls.addArchitect).not.toHaveBeenCalled();
  });
});
