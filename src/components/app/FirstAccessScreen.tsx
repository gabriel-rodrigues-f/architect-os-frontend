import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AuthScreenShell } from "@/components/app/AuthScreenShell";
import { PasswordChoiceFields } from "@/components/app/PasswordChoiceFields";
import { PasswordInput } from "@/components/app/PasswordInput";
import { AuthAlert } from "@/components/app/AuthAlert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { usePasswordChoice } from "@/hooks";
import { authErrorMessage, useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { PasswordRefusal } from "@/lib/password-safety";
import { SynapseSignals } from "@/lib/synapse-network";
import { SynapseOutcomeRule } from "@/lib/synapse-outcome";

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
 *
 * A rede ao fundo (dono, 2026-09-08) pulsa com o resultado, nunca com o
 * envio: senha que não confere (recusa local) e recusa do serviço → vermelho;
 * senha trocada → azul; serviço fora → nada.
 */
export function FirstAccessScreen() {
  const { user, logout, changePassword } = useAuth();
  const { t } = useI18n();
  const email = user?.email ?? "";
  const choice = usePasswordChoice(email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signals] = useState(() => new SynapseSignals());

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    choice.point(null);

    if (!choice.matches) {
      setError(t("password.mismatch"));
      signals.pulseWith("danger");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, choice.newPassword);
      signals.pulseWith("primary");
      toast.success(t("firstAccess.done"));
    } catch (refused) {
      const refusal = PasswordRefusal.of(refused);
      const key = refusal.messageKey;
      choice.point(refusal.requirement);
      setError(key === null ? authErrorMessage(refused) : t(key));
      const tone = SynapseOutcomeRule.toneOfDoorResult(refused);
      if (tone) signals.pulseWith(tone);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScreenShell signals={signals}>
      <h1 className="font-display text-lg font-semibold">{t("firstAccess.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("firstAccess.lead")}</p>
      {email !== "" && <p className="mt-1 text-xs font-medium text-foreground">{email}</p>}

      <form className="mt-5 space-y-3" onSubmit={submit}>
        <div>
          <Label htmlFor="current-password">{t("firstAccess.currentPassword")}</Label>
          <PasswordInput
            id="current-password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </div>

        <PasswordChoiceFields choice={choice} />

        {error !== null && <AuthAlert>{error}</AuthAlert>}

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
