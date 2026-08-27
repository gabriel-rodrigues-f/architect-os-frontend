import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { authErrorMessage, useAuth } from "@/lib/auth";

export function LoginScreen() {
  const { login, register } = useAuth();
  const { t } = useI18n();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [hasUsers, setHasUsers] = useState(true);
  const [checkedInstance, setCheckedInstance] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    authApi
      .status()
      .then(({ hasUsers: instanceHasUsers }) => {
        setHasUsers(instanceHasUsers);
        setMode(instanceHasUsers ? "login" : "register");
      })
      .catch(() => setError(t("login.offline")))
      .finally(() => setCheckedInstance(true));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
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
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const firstAccess = mode === "register";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 leading-tight">
          <p className="font-display text-xl font-semibold">Synapse</p>
          <p className="text-xs text-muted-foreground">{t("login.subtitle")}</p>
        </div>

        <div className="surface-card p-6">
          <h1 className="font-display text-lg font-semibold">
            {firstAccess ? "Primeiro acesso" : "Entrar"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {firstAccess
              ? "Nenhuma conta cadastrada ainda. Crie a conta de administrador da instância."
              : "Informe suas credenciais para acessar o painel."}
          </p>

          <form className="mt-5 space-y-3" onSubmit={submit}>
            {firstAccess && (
              <div>
                <Label htmlFor="name">{t("login.name")}</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
            )}

            <div>
              <Label htmlFor="email">{t("login.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="password">{t("login.password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete={firstAccess ? "new-password" : "current-password"}
                required
                minLength={firstAccess ? 12 : 1}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              {firstAccess && (
                <p className="mt-1 text-xs text-muted-foreground">Mínimo de 12 caracteres.</p>
              )}
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting || !checkedInstance}>
              {submitting ? "Enviando…" : firstAccess ? "Criar conta e entrar" : "Entrar"}
            </Button>
          </form>

          {checkedInstance && !hasUsers && (
            <button
              type="button"
              onClick={() => {
                setMode(firstAccess ? "login" : "register");
                setError(null);
              }}
              className="mt-4 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              {firstAccess ? "Já tenho conta" : "Criar uma nova conta"}
            </button>
          )}
          {checkedInstance && hasUsers && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {t("login.closedRegistration")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
