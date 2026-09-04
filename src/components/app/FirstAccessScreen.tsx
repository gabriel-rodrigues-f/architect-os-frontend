import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AuthScreenShell } from "@/components/app/AuthScreenShell";
import { PasswordChoiceFields } from "@/components/app/PasswordChoiceFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePasswordChoice } from "@/hooks";
import { authErrorMessage, useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { PasswordRefusal } from "@/lib/password-safety";

/**
 * A troca de senha do primeiro acesso — a tela que segura a porta.
 *
 * Regra do dono (2026-09-03): *"ao realizar o primeiro acesso, o usuário
 * (regra universal) precisa ter que alterar sua senha."* O backend já põe a
 * marca de pé (`mustChangePassword`) e já recusa todo o resto com
 * `PASSWORD_CHANGE_REQUIRED`. Sem esta tela, quem é admitido no time entra
 * com a senha temporária, tem sessão válida — e não vai a lugar nenhum.
 *
 * Ela é irmã da `LoginScreen`, não uma rota: o `AuthGate` do `__root` a
 * desenha NO LUGAR da aplicação inteira enquanto a marca está de pé. Por isso
 * não há menu, não há navegação e não há como tropeçar num 403 — a pessoa
 * chega aqui logo depois do login, não depois de bater numa porta fechada.
 *
 * A casca e os dois campos da senha nova saíram daqui na fatia da recuperação
 * de acesso (`AuthScreenShell`, `PasswordChoiceFields`, `usePasswordChoice`):
 * a criação de senha pelo link do convite pede exatamente a mesma coisa, e
 * duas cópias das sete exigências divergiriam. O que sobrou nesta tela é o
 * que só ELA tem — a senha temporária, e a saída para quem não quer trocar
 * agora.
 *
 * Duas escolhas que valem explicação:
 *
 *  1. **O botão não tranca.** Quem decide é o backend; a leitura local é
 *     orientação. Se as duas discordarem numa borda, a pessoa continua podendo
 *     enviar e a recusa do serviço aponta a exigência exata
 *     (`PasswordRefusal`, de `details.requirement`) — que passa a valer mesmo
 *     sobre a leitura local, porque o serviço é a autoridade.
 *
 *  2. **Sair funciona.** `POST /auth/logout` é uma das três rotas liberadas
 *     enquanto a marca está de pé. Quem não quiser trocar agora precisa
 *     conseguir sair — senão a tela deixaria de ser porta e viraria armadilha.
 */
export function FirstAccessScreen() {
  const { user, logout, changePassword } = useAuth();
  const { t } = useI18n();
  const email = user?.email ?? "";
  const choice = usePasswordChoice(email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    choice.point(null);

    if (!choice.matches) {
      setError(t("password.mismatch"));
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, choice.newPassword);
      toast.success(t("firstAccess.done"));
    } catch (refused) {
      const refusal = PasswordRefusal.of(refused);
      const key = refusal.messageKey;
      choice.point(refusal.requirement);
      setError(key === null ? authErrorMessage(refused) : t(key));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScreenShell>
      <h1 className="font-display text-lg font-semibold">{t("firstAccess.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("firstAccess.lead")}</p>
      {email !== "" && <p className="mt-1 text-xs font-medium text-foreground">{email}</p>}

      <form className="mt-5 space-y-3" onSubmit={submit}>
        <div>
          <Label htmlFor="current-password">{t("firstAccess.currentPassword")}</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </div>

        <PasswordChoiceFields choice={choice} />

        {error !== null && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? t("firstAccess.submitting") : t("firstAccess.submit")}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-muted-foreground">{t("firstAccess.leaveHint")}</p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-1 w-full"
        onClick={() => void logout()}
      >
        {t("shell.logout")}
      </Button>
    </AuthScreenShell>
  );
}
