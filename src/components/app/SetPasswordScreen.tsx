import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AccessRecoveryRequestPanel } from "@/components/app/AccessRecoveryRequestPanel";
import { AuthScreenShell } from "@/components/app/AuthScreenShell";
import { PasswordChoiceFields } from "@/components/app/PasswordChoiceFields";
import { Button } from "@/components/ui/button";
import { usePasswordChoice } from "@/hooks";
import { AccessInvitation, SetPasswordRefusal } from "@/lib/access-recovery";
import { authApi } from "@/lib/api";
import { authErrorMessage } from "@/lib/auth";
import { SESSION_QUERY_KEY } from "@/lib/session-query";
import { useI18n } from "@/lib/i18n";

/**
 * A PESSOA CRIA A PRÓPRIA SENHA, a partir do link do convite.
 *
 * Pedido do dono (2026-09-04), com a correção que ele mesmo fez ao escolher o
 * desenho: *"a senha não deve ser enviada por e-mail"*. O e-mail leva um
 * LINK; esta é a tela do outro lado dele, e ela é a única da aplicação onde
 * uma senha nasce sem ninguém já estar dentro.
 *
 * Por isso ela é a primeira rota PÚBLICA do Synapse (`PublicReach`): quem
 * clica no link não tem sessão — é exatamente por isso que está clicando —, e
 * o `AuthGate` desenharia o login por cima, mandando a pessoa fazer o que ela
 * não consegue.
 *
 * Três decisões:
 *
 *  1. **Sem login automático.** O serviço responde 204 e nada mais: nem
 *     sessão, nem conta. Terminada a criação, a pessoa vai para o login e
 *     entra com a senha que acabou de escolher — quem chegou pelo link é
 *     quem abriu o e-mail, e isso não é o mesmo que provar quem é.
 *
 *  2. **Link que não serve tem UMA saída, e ela não é o formulário.**
 *     Desconhecido, vencido, já usado ou substituído chegam todos como
 *     `ACCESS_INVITATION_REFUSED`, e a frase é a do serviço, que o CONTRATO
 *     diz já vir escrita para a pessoa. Corrigir a senha não resolveria nada,
 *     então o formulário sai da tela e entra o pedido de um link novo.
 *
 *  3. **A tela pergunta A QUEM é o convite** (`GET /auth/invitations/:token`,
 *     2026-09-05): com o e-mail na mão, a exigência "não ter o seu e-mail
 *     dentro dela" é conferida aqui, ao vivo — o dono viu a linha ficar
 *     indefinida e o formulário sair mesmo assim. Enquanto a resposta não
 *     chega, a exigência fica "confere ao salvar" (`withoutKnownEmail`); link
 *     recusado na chegada leva direto à tela de pedir outro, sem formulário.
 *     O serviço continua sendo a autoridade ao salvar.
 */
export function SetPasswordScreen({ token }: { token: string | undefined }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [refusal, setRefusal] = useState<SetPasswordRefusal | null>(null);
  const holder = useQuery({
    queryKey: ["access-invitation", token],
    queryFn: () => authApi.invitationHolder(token ?? ""),
    enabled: AccessInvitation.of(token) !== null,
    retry: false,
    staleTime: Infinity,
  });
  const choice = usePasswordChoice(holder.data?.email ?? null);
  useEffect(() => {
    if (holder.error) setRefusal(SetPasswordRefusal.of(holder.error));
  }, [holder.error]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [askingForANewLink, setAskingForANewLink] = useState(false);

  const invitation = AccessInvitation.of(token);
  const queryClient = useQueryClient();
  const goToLogin = () => void navigate({ to: "/" });
  // Dono (2026-09-06): a senha nova encerra a sessão que o navegador tinha
  // (o backend já fechou o cookie); a casca relê /auth/me e mostra o login.
  const goToLoginAsNewSession = async () => {
    queryClient.setQueryData(SESSION_QUERY_KEY, null);
    await queryClient.invalidateQueries();
    goToLogin();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (invitation === null) return;
    setError(null);
    setRefusal(null);
    choice.point(null);

    if (!choice.matches) {
      setError(t("password.mismatch"));
      return;
    }

    setSubmitting(true);
    try {
      await authApi.setPassword(invitation.token, choice.newPassword);
      toast.success(t("setPassword.done"));
      await goToLoginAsNewSession();
    } catch (refused) {
      const reading = SetPasswordRefusal.of(refused);
      setRefusal(reading);
      choice.point(reading.requirement);
      setError(
        reading.serviceSentence ??
          (reading.messageKey === null ? authErrorMessage(refused) : t(reading.messageKey)),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (askingForANewLink) {
    return (
      <AuthScreenShell>
        <AccessRecoveryRequestPanel onBack={goToLogin} backLabel={t("setPassword.backToLogin")} />
      </AuthScreenShell>
    );
  }

  if (invitation === null || refusal?.asksForANewLink === true) {
    return (
      <AuthScreenShell>
        <h1 className="font-display text-lg font-semibold">
          {invitation === null
            ? t("setPassword.missingLink.title")
            : t("setPassword.refusedLink.title")}
        </h1>
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {invitation === null
            ? t("setPassword.missingLink.lead")
            : (refusal?.serviceSentence ?? t("setPassword.refusedLink.lead"))}
        </p>
        <Button type="button" className="mt-5 w-full" onClick={() => setAskingForANewLink(true)}>
          {t("setPassword.askForANewLink")}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="mt-2 w-full" onClick={goToLogin}>
          {t("setPassword.backToLogin")}
        </Button>
      </AuthScreenShell>
    );
  }

  return (
    <AuthScreenShell>
      <h1 className="font-display text-lg font-semibold">{t("setPassword.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {holder.data?.firstName
          ? t("setPassword.leadFor", { nome: holder.data.firstName })
          : t("setPassword.lead")}
      </p>

      <form className="mt-5 space-y-3" onSubmit={submit}>
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
          {submitting ? t("setPassword.submitting") : t("setPassword.submit")}
        </Button>
      </form>

      <Button type="button" variant="ghost" size="sm" className="mt-3 w-full" onClick={goToLogin}>
        {t("setPassword.backToLogin")}
      </Button>
    </AuthScreenShell>
  );
}
