import { useCallback, useState } from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import { authErrorMessage } from "@/lib/auth";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { defaultRefusalPhrase, type RefusalTranslate } from "@/lib/refusal-phrase";
import { successMessageOf } from "@/lib/success-message";

export type AsyncSubmitResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

export type SubmitErrorFallback = string | ((error: unknown) => string);

/**
 * A FRASE QUE O SUBMIT MOSTRA — e a ordem em que ela é escolhida.
 *
 * FATIA IDIOMA (dono, 2026-09-08: *"as notificações não estão sendo traduzidas
 * para inglês no idioma inglês; aproveite e faça uma varredura do que pode ter
 * ficado de fora"*). Este era o cano de dentro da aplicação: `error.message` é
 * a frase que o BACKEND escreveu, e o backend só escreve pt-BR — quem lia o
 * Synapse em inglês recebia "profissional não encontrado" no toast.
 *
 * A ordem é a régua: primeiro a frase NOSSA, composta pela `RefusalPhrase` a
 * partir do código e das peças, no idioma de quem lê; só depois o que a tela
 * declarou como reserva. A frase do serviço é a última, e cada código que
 * ainda cai nela é dívida contada pela catraca
 * (`tests/architecture/a-recusa-fala-o-idioma-de-quem-le.test.ts`).
 */
class SubmitRefusal {
  static sentenceOf(error: unknown, fallback: SubmitErrorFallback, t: RefusalTranslate): string {
    const nossa = defaultRefusalPhrase.sentenceOf(error, t);
    if (nossa !== null) return nossa;
    if (typeof fallback === "function") return fallback(error);
    return error instanceof ApiError ? error.message : fallback;
  }
}

/**
 * A RECUSA LOCAL — campos obrigatórios vazios, senha que não confere, duração
 * inválida — é mensagem vermelha e PARA POR AÍ (dono, 2026-09-08: *"remova a
 * piscada, tanto azul quanto vermelha"* dentro da aplicação logada). Não há
 * mais `rejectLocally()`: a tela mostra a mensagem, a rede do fundo não pisca.
 */
export function useAsyncSubmit(fallback: SubmitErrorFallback) {
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async <T>(action: () => Promise<T>): Promise<AsyncSubmitResult<T>> => {
    setError(null);
    setSubmitting(true);
    try {
      return { ok: true, value: await action() };
    } catch (e) {
      setError(SubmitRefusal.sentenceOf(e, fallback, t));
      return { ok: false, error: e };
    } finally {
      setSubmitting(false);
    }
  };

  return { submitting, error, clearError: () => setError(null), run };
}

export function useSuccessToast() {
  const { t } = useI18n();
  return useCallback(
    (fallback: MessageKey, params?: Record<string, string | number>, result?: unknown) => {
      toast.success(t(successMessageOf(result, fallback), params));
    },
    [t],
  );
}

export function useToastSubmit(fallback: SubmitErrorFallback = authErrorMessage) {
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);

  const run = async <T>(action: () => Promise<T>): Promise<AsyncSubmitResult<T>> => {
    setSubmitting(true);
    try {
      return { ok: true, value: await action() };
    } catch (e) {
      toast.error(SubmitRefusal.sentenceOf(e, fallback, t));
      return { ok: false, error: e };
    } finally {
      setSubmitting(false);
    }
  };

  return { submitting, run };
}
