import { Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { AccessRecoveryRequestPanel } from "@/components/app/AccessRecoveryRequestPanel";
import { AuthScreenShell } from "@/components/app/AuthScreenShell";
import { PasswordInput } from "@/components/app/PasswordInput";
import { AuthAlert } from "@/components/app/AuthAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { authErrorMessage, useAuth } from "@/lib/auth";
import { SynapseSignals } from "@/lib/synapse-network";

/**
 * ONDA DA RECUPERAÇÃO DE ACESSO (2026-09-04) — quem não consegue entrar sai
 * daqui pelo "esqueci minha senha". Ele é um MODO desta tela, e não uma rota:
 * a `LoginScreen` já é o que a aplicação desenha sem sessão, então pedir o
 * acesso de volta não precisa de endereço próprio nem de uma segunda porta
 * pública. O formulário em si é o `AccessRecoveryRequestPanel`, compartilhado
 * com a tela de criação de senha — lá ele atende quem chegou com um link que
 * não serve mais.
 *
 * LOGIN "SYNAPSE NETWORK" (direção 2026-09-06): a casca (`AuthScreenShell`)
 * põe a rede de sinapses ao fundo e a marca ao lado; esta tela só fala com a
 * rede por `SynapseSignals` — clicar em Entrar dispara um pulso EM PARALELO
 * à autenticação, que nunca espera pela animação.
 */
export function LoginScreen() {
  const { login, register } = useAuth();
  const { t } = useI18n();
  const [signals] = useState(() => new SynapseSignals());
  const [mode, setMode] = useState<"login" | "register" | "recovery">("login");
  const [hasUsers, setHasUsers] = useState(true);
  const [checkedInstance, setCheckedInstance] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Só uma tentativa recusada marca os campos — o serviço fora do ar não é culpa do que foi digitado. */
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    authApi
      .status()
      .then(({ hasUsers: instanceHasUsers }) => {
        setHasUsers(instanceHasUsers);
        setMode(instanceHasUsers ? "login" : "register");
      })
      .catch(() => setError(import.meta.env.DEV ? t("login.offline.dev") : t("login.offline")))
      .finally(() => setCheckedInstance(true));
  }, []);

  /**
   * O erro anterior FICA na tela enquanto a nova tentativa está em voo. Limpar
   * ao submeter fazia o aviso sumir e voltar a cada clique — e, como a tela é
   * centrada verticalmente, o cartão inteiro subia e descia junto (dono,
   * 2026-09-05: "a tela toda treme"). Só o resultado da tentativa troca o
   * aviso: sucesso o apaga, falha o substitui.
   *
   * O botão trava enquanto a tentativa está em voo — não há submissão dupla.
   */
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    signals.pulse();
    try {
      if (mode === "register") {
        await register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        });
      } else {
        await login(form.email.trim(), form.password);
      }
      setError(null);
      setRejected(false);
    } catch (err) {
      setError(authErrorMessage(err));
      setRejected(true);
    } finally {
      setSubmitting(false);
    }
  };

  const firstAccess = mode === "register";

  if (mode === "recovery") {
    return (
      <AuthScreenShell signals={signals}>
        <AccessRecoveryRequestPanel
          onBack={() => {
            setMode("login");
            setError(null);
          }}
          backLabel={t("accessRecovery.request.back")}
        />
      </AuthScreenShell>
    );
  }

  const invalid = rejected && error !== null && !submitting;

  return (
    <AuthScreenShell signals={signals}>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {firstAccess ? t("login.firstAccess.title") : t("login.title")}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {firstAccess ? t("login.firstAccess.lead") : t("login.lead")}
      </p>

      <form className="mt-6 space-y-4" onSubmit={submit}>
        {firstAccess && (
          <div className="space-y-1.5">
            <Label htmlFor="name">{t("login.name")}</Label>
            <Input
              id="name"
              autoComplete="name"
              required
              className="auth-field"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">{t("login.email")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={invalid || undefined}
            className="auth-field"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">{t("login.password")}</Label>
          <PasswordInput
            id="password"
            autoComplete={firstAccess ? "new-password" : "current-password"}
            required
            minLength={firstAccess ? 12 : 1}
            aria-invalid={invalid || undefined}
            className="auth-field"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          {firstAccess && (
            <p className="text-xs text-muted-foreground">{t("login.firstAccess.minLength")}</p>
          )}
        </div>

        {error && <AuthAlert>{error}</AuthAlert>}

        <Button
          type="submit"
          className="auth-cta w-full"
          disabled={submitting || !checkedInstance}
          aria-busy={submitting || undefined}
        >
          {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {submitting
            ? firstAccess
              ? t("login.firstAccess.submitting")
              : t("login.submitting")
            : firstAccess
              ? t("login.firstAccess.submit")
              : t("login.submit")}
        </Button>
      </form>

      {!firstAccess && (
        <button
          type="button"
          onClick={() => {
            setMode("recovery");
            setError(null);
          }}
          className="auth-link mt-3 w-full text-center text-xs text-muted-foreground"
        >
          {t("accessRecovery.request.link")}
        </button>
      )}

      {checkedInstance && !hasUsers && (
        <button
          type="button"
          onClick={() => {
            setMode(firstAccess ? "login" : "register");
            setError(null);
          }}
          className="auth-link mt-4 w-full text-center text-xs text-muted-foreground"
        >
          {firstAccess ? t("login.haveAccount") : t("login.createAccount")}
        </button>
      )}
    </AuthScreenShell>
  );
}
