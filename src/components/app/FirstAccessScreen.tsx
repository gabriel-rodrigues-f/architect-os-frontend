import { Check, Circle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authErrorMessage, useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  PASSWORD_REQUIREMENTS,
  PASSWORD_REQUIREMENT_ITEM,
  PasswordRefusal,
  SafePassword,
  type PasswordRequirement,
} from "@/lib/password-safety";
import { cn } from "@/lib/utils";

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
 * Três escolhas que valem explicação:
 *
 *  1. **As exigências à vista, antes de errar.** A lista das sete está na tela
 *     desde o começo e vai se marcando enquanto a pessoa digita
 *     (`SafePassword`). Descobrir a régua só depois de apanhar do formulário
 *     é o que esta tela existe para não fazer.
 *
 *  2. **O botão não tranca.** Quem decide é o backend; a leitura local é
 *     orientação. Se as duas discordarem numa borda, a pessoa continua podendo
 *     enviar e a recusa do serviço aponta a exigência exata
 *     (`PasswordRefusal`, de `details.requirement`) — que passa a valer mesmo
 *     sobre a leitura local, porque o serviço é a autoridade.
 *
 *  3. **Sair funciona.** `POST /auth/logout` é uma das três rotas liberadas
 *     enquanto a marca está de pé. Quem não quiser trocar agora precisa
 *     conseguir sair — senão a tela deixaria de ser porta e viraria armadilha.
 */
export function FirstAccessScreen() {
  const { user, logout, changePassword } = useAuth();
  const { t } = useI18n();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pointed, setPointed] = useState<PasswordRequirement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const email = user?.email ?? "";
  const safety = SafePassword.of(newPassword, email);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPointed(null);

    if (newPassword !== confirmation) {
      setError(t("firstAccess.mismatch"));
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success(t("firstAccess.done"));
    } catch (refused) {
      const refusal = PasswordRefusal.of(refused);
      const key = refusal.messageKey;
      setPointed(refusal.requirement);
      setError(key === null ? authErrorMessage(refused) : t(key));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 leading-tight">
          <p className="font-display text-xl font-semibold">Synapse</p>
          <p className="text-xs text-muted-foreground">{t("login.subtitle")}</p>
        </div>

        <div className="surface-card p-6">
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

            <div>
              <Label htmlFor="new-password">{t("firstAccess.newPassword")}</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                aria-describedby="password-requirements"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>

            <PasswordRequirementList
              heading={t("firstAccess.requirements")}
              pointed={pointed}
              safety={safety}
            />

            <div>
              <Label htmlFor="confirm-password">{t("firstAccess.confirmation")}</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </div>

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

          <p className="mt-4 text-center text-xs text-muted-foreground">
            {t("firstAccess.leaveHint")}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 w-full"
            onClick={() => void logout()}
          >
            {t("shell.logout")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PasswordRequirementList({
  heading,
  pointed,
  safety,
}: {
  heading: string;
  pointed: PasswordRequirement | null;
  safety: SafePassword;
}) {
  const { t } = useI18n();

  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
      <p id="password-requirements" className="text-xs font-medium text-foreground">
        {heading}
      </p>
      <ul className="mt-1.5 space-y-1">
        {PASSWORD_REQUIREMENTS.map((requirement) => (
          <PasswordRequirementItem
            key={requirement}
            label={t(PASSWORD_REQUIREMENT_ITEM[requirement])}
            /* A palavra do serviço vale sobre a leitura local: apontada pelo
               backend, a exigência volta a faltar mesmo que aqui parecesse de pé. */
            met={safety.meets(requirement) && pointed !== requirement}
            pointed={pointed === requirement}
          />
        ))}
      </ul>
    </div>
  );
}

function PasswordRequirementItem({
  label,
  met,
  pointed,
}: {
  label: string;
  met: boolean;
  pointed: boolean;
}) {
  const { t } = useI18n();

  return (
    <li
      className={cn(
        "flex items-start gap-2 text-xs",
        met ? "text-foreground" : "text-muted-foreground",
        pointed && "font-medium text-destructive",
      )}
    >
      {met ? (
        <Check className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Circle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      )}
      <span>{label}</span>
      <span className="sr-only">
        {met ? t("firstAccess.requirement.met") : t("firstAccess.requirement.pending")}
      </span>
    </li>
  );
}
