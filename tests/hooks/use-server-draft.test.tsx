import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useServerDraft } from "@/hooks";

/**
 * F3/Grupo 1 — contrato do rascunho local, num lugar só.
 *
 * Os quatro campos que perdiam digitação (plano de ação do PDI, título e horas
 * do item de trilha, progresso da pessoa na trilha) repetiam o mesmo par
 * "rascunho local + commit quando difere do servidor". O que quebrava era a
 * sincronização por efeito: o valor do servidor era empurrado por cima do
 * rascunho a qualquer momento.
 *
 * Aqui fica gravado o contrato: o rascunho nasce do valor do servidor e só é
 * semeado de novo por remount — que é como a casa já trata versão nova
 * (`key={data.version}` em `DevelopmentSummarySection`).
 */

function CampoDeProva({ serverValue }: { serverValue: string }) {
  const { draft, setDraft, changed } = useServerDraft(serverValue);
  return (
    <>
      <input aria-label="campo" value={draft} onChange={(e) => setDraft(e.target.value)} />
      <p>{changed ? "alterado" : "igual ao servidor"}</p>
    </>
  );
}

describe("useServerDraft — rascunho semeado uma vez pelo valor do servidor", () => {
  afterEach(cleanup);

  it("nasce com o valor do servidor", () => {
    render(<CampoDeProva serverValue="original" />);

    expect((screen.getByLabelText("campo") as HTMLInputElement).value).toBe("original");
    expect(screen.getByText("igual ao servidor")).toBeTruthy();
  });

  it("não deixa um valor novo do servidor apagar o que já foi digitado", () => {
    const { rerender } = render(<CampoDeProva serverValue="original" />);

    fireEvent.change(screen.getByLabelText("campo"), { target: { value: "em digitação" } });
    rerender(<CampoDeProva serverValue="outro valor do servidor" />);

    expect((screen.getByLabelText("campo") as HTMLInputElement).value).toBe("em digitação");
    expect(screen.getByText("alterado")).toBeTruthy();
  });

  it("semeia de novo quando o campo é remontado por `key`", () => {
    const { rerender } = render(<CampoDeProva key="v1" serverValue="original" />);

    fireEvent.change(screen.getByLabelText("campo"), { target: { value: "em digitação" } });
    rerender(<CampoDeProva key="v2" serverValue="versão nova do servidor" />);

    expect((screen.getByLabelText("campo") as HTMLInputElement).value).toBe(
      "versão nova do servidor",
    );
    expect(screen.getByText("igual ao servidor")).toBeTruthy();
  });

  it("volta a `igual ao servidor` quando o servidor confirma o que foi digitado", () => {
    const { rerender } = render(<CampoDeProva serverValue="original" />);

    fireEvent.change(screen.getByLabelText("campo"), { target: { value: "texto salvo" } });
    rerender(<CampoDeProva serverValue="texto salvo" />);

    expect(screen.getByText("igual ao servidor")).toBeTruthy();
  });
});
