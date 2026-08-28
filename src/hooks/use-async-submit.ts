import { useCallback, useState } from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import { authErrorMessage } from "@/lib/auth";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { successMessageOf } from "@/lib/success-message";

export type AsyncSubmitResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

export type SubmitErrorFallback = string | ((error: unknown) => string);

export function submitErrorMessage(error: unknown, fallback: SubmitErrorFallback): string {
  if (typeof fallback === "function") return fallback(error);
  return error instanceof ApiError ? error.message : fallback;
}

export function useAsyncSubmit(fallback: SubmitErrorFallback) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async <T>(action: () => Promise<T>): Promise<AsyncSubmitResult<T>> => {
    setError(null);
    setSubmitting(true);
    try {
      return { ok: true, value: await action() };
    } catch (e) {
      setError(submitErrorMessage(e, fallback));
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
  const [submitting, setSubmitting] = useState(false);

  const run = async <T>(action: () => Promise<T>): Promise<AsyncSubmitResult<T>> => {
    setSubmitting(true);
    try {
      return { ok: true, value: await action() };
    } catch (e) {
      toast.error(submitErrorMessage(e, fallback));
      return { ok: false, error: e };
    } finally {
      setSubmitting(false);
    }
  };

  return { submitting, run };
}
