import { useState } from "react";

import { ApiError } from "@/lib/api";

/** Resultado explícito — `ok` distingue sucesso de falha mesmo quando a ação resolve `void`/`undefined`. */
export type AsyncSubmitResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

/**
 * OO3-11/D-6 (reuso final) — o ciclo `setError(null) → setSubmitting(true) →
 * await ação → catch (ApiError.message | fallback) → finally
 * setSubmitting(false)` estava repetido em ~8 lugares. O hook cobre SÓ esse
 * esqueleto comum; o que acontece no sucesso (toast, fechar diálogo, limpar
 * rascunho) e qualquer tratamento de erro específico continuam no call site,
 * decidindo em cima do `AsyncSubmitResult` (que carrega o erro CRU para quem
 * precisa inspecionar `error.code` etc.).
 *
 * `fallback` aceita a mensagem para erro não-`ApiError` (o mapeamento padrão
 * do app) ou uma função de mapeamento própria (ex.: `authErrorMessage`).
 *
 * Fora deste hook, de propósito: telas que mostram o erro em toast em vez de
 * estado local (outro esqueleto), fluxos multi-etapa que trocam de passo no
 * catch (`users.tsx`) e o re-prompt por `error.code` de assessments — ver a
 * decisão em SPEC-OO3-11-REUSO-FRONTEND.md §7/D-6.
 */
export function useAsyncSubmit(fallback: string | ((error: unknown) => string)) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async <T>(action: () => Promise<T>): Promise<AsyncSubmitResult<T>> => {
    setError(null);
    setSubmitting(true);
    try {
      return { ok: true, value: await action() };
    } catch (e) {
      setError(
        typeof fallback === "function" ? fallback(e) : e instanceof ApiError ? e.message : fallback,
      );
      return { ok: false, error: e };
    } finally {
      setSubmitting(false);
    }
  };

  return { submitting, error, clearError: () => setError(null), run };
}
