import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommandWithReasonDialog } from "@/components/app/CommandWithReasonDialog";
import { ApiError } from "@/lib/api";
import { I18nProvider } from "@/lib/i18n";

/**
 * OO3-11c — o ciclo `reason` + `submitting` + `error` que
 * `CareerLevelTransitionDialog`/`DeactivateDialog` (e agora
 * `ReopenPlanDialog`) repetiam vira invariante unitário aqui; os testes de
 * tela (`team-deactivate.test.tsx`) mantêm só os invariantes de integração
 * (comando com motivo+versão, roster, reativação).
 */

type DialogProps = ComponentProps<typeof CommandWithReasonDialog>;

function renderDialog(overrides: Partial<DialogProps> = {}) {
  const onSubmit = vi.fn<(reason: string) => Promise<unknown>>(() => Promise.resolve());
  const onClose = vi.fn();
  const props: DialogProps = {
    title: "Confirmar comando",
    body: "Descrição do comando.",
    reasonInputId: "test-reason",
    reasonLabel: "Motivo",
    reasonPlaceholder: "Explique o porquê",
    confirmLabel: "Confirmar",
    submittingLabel: "Enviando…",
    fallbackError: "Falhou de um jeito genérico.",
    onSubmit,
    onClose,
    ...overrides,
  };
  render(
    <I18nProvider>
      <CommandWithReasonDialog {...props} />
    </I18nProvider>,
  );
  return { onSubmit: props.onSubmit as typeof onSubmit, onClose: props.onClose as typeof onClose };
}

const confirmButton = () => screen.getByRole("button", { name: "Confirmar" }) as HTMLButtonElement;

describe("CommandWithReasonDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("confirmar nasce desabilitado sem motivo e habilita ao escrever", async () => {
    renderDialog();
    expect(confirmButton().disabled).toBe(true);
    await userEvent.type(screen.getByLabelText("Motivo"), "porque sim");
    expect(confirmButton().disabled).toBe(false);
  });

  it("canSubmit=false mantém desabilitado mesmo com motivo preenchido", async () => {
    renderDialog({ canSubmit: false });
    await userEvent.type(screen.getByLabelText("Motivo"), "porque sim");
    expect(confirmButton().disabled).toBe(true);
  });

  it("rejeição com ApiError mostra err.message e NÃO fecha o diálogo (409 visível)", async () => {
    const { onClose } = renderDialog({
      onSubmit: () => Promise.reject(new ApiError("Cadastro alterado por outra pessoa.", 409)),
    });
    await userEvent.type(screen.getByLabelText("Motivo"), "porque sim");
    await userEvent.click(confirmButton());

    expect(await screen.findByText("Cadastro alterado por outra pessoa.")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("rejeição com Error genérico mostra o fallbackError", async () => {
    renderDialog({ onSubmit: () => Promise.reject(new Error("boom")) });
    await userEvent.type(screen.getByLabelText("Motivo"), "porque sim");
    await userEvent.click(confirmButton());

    expect(await screen.findByText("Falhou de um jeito genérico.")).toBeTruthy();
  });

  it("sucesso envia o motivo trimado e chama onClose uma única vez", async () => {
    const { onSubmit, onClose } = renderDialog();
    await userEvent.type(screen.getByLabelText("Motivo"), "  porque sim  ");
    await userEvent.click(confirmButton());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith("porque sim");
  });

  it("enquanto envia, cancelar fica desabilitado e o confirmar troca de rótulo", async () => {
    let resolveSubmit: (value: unknown) => void = () => {};
    renderDialog({
      onSubmit: () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        }),
    });
    await userEvent.type(screen.getByLabelText("Motivo"), "porque sim");
    await userEvent.click(confirmButton());

    const submitting = (await screen.findByRole("button", {
      name: "Enviando…",
    })) as HTMLButtonElement;
    expect(submitting.disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    resolveSubmit(undefined);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Enviando…" })).toBeNull());
  });
});
