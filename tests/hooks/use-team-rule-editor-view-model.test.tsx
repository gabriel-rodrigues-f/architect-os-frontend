import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTeamRuleEditorViewModel } from "@/hooks";
import type { TeamRuleView } from "@/lib/gateways/career.gateway";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * O adaptador é FINO de propósito: a lógica toda mora em
 * `TeamRuleEditorViewModel`. O que este teste pina é a única coisa que o hook
 * decide — o rascunho nasce da régua do servidor e sobrevive à edição, no
 * mesmo contrato de `useServerDraft` (semear de novo é remount, nunca efeito
 * empurrando por cima do que o líder acabou de mexer).
 */

const RULE: TeamRuleView = {
  id: "regra-1",
  teamId: "time-plataforma",
  careerLevelId: "pleno",
  minimumQualifiedCapabilities: 4,
  capabilityIds: [],
  competencies: [],
};

function ProvaDaRegua({ rule }: { rule: TeamRuleView | null }) {
  const { editor, setEditor } = useTeamRuleEditorViewModel(rule);
  return (
    <>
      <p>{`piso ${editor.minimumQualifiedCapabilities}`}</p>
      <p>{editor.isDirty ? "sujo" : "limpo"}</p>
      <button type="button" onClick={() => setEditor(editor.withMinimum(9))}>
        subir piso
      </button>
    </>
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("useTeamRuleEditorViewModel", () => {
  it("nasce com a régua que o servidor entregou, e limpo", async () => {
    renderWithApp(<ProvaDaRegua rule={RULE} />);

    expect(await screen.findByText("piso 4")).toBeTruthy();
    expect(screen.getByText("limpo")).toBeTruthy();
  });

  it("sem régua, nasce no piso mínimo da organização", async () => {
    renderWithApp(<ProvaDaRegua rule={null} />);

    expect(await screen.findByText("piso 3")).toBeTruthy();
  });

  it("guarda a edição do líder em vez de voltar ao valor do servidor", async () => {
    renderWithApp(<ProvaDaRegua rule={RULE} />);
    fireEvent.click(await screen.findByRole("button", { name: "subir piso" }));

    expect(screen.getByText("piso 9")).toBeTruthy();
    expect(screen.getByText("sujo")).toBeTruthy();
  });
});
