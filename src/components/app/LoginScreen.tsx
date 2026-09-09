import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { AccessRecoveryRequestPanel } from "@/components/app/AccessRecoveryRequestPanel";
import { AuthScreenShell } from "@/components/app/AuthScreenShell";
import { PasswordInput } from "@/components/app/PasswordInput";
import { AuthAlert } from "@/components/app/AuthAlert";
import { Callout } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { DoorRefusal } from "@/lib/door-refusal";
import { FormKeyboard } from "@/lib/form-keyboard";
import { SessionEndReason, sessionEndMemory } from "@/lib/session-end-reason";
import { instanceStatusQuery } from "@/lib/session-query";
import { useReducedMotion } from "@/hooks";
import { SynapseSignals } from "@/lib/synapse-network";
import { EntrancePulseCeremony, SynapseOutcomeRule } from "@/lib/synapse-outcome";

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
 * rede por `SynapseSignals`.
 *
 * A COR DO PULSO ACOMPANHA O RESULTADO (dono, 2026-09-08): "se o login for
 * rejeitado, a sinapse deve ser vermelha, no mesmo tom do vermelho de erro do
 * contorno dos campos; só pode ser azul quando o usuário conseguir se logar
 * com sucesso". Por isso o pulso NÃO dispara no envio — dispara com a
 * resposta: aceita → azul (`onAccepted`, antes de a sessão abrir, para a rede
 * ainda estar na tela); credencial recusada → vermelho; qualquer outra coisa
 * → nada, porque não é culpa do que foi digitado
 * (`SynapseOutcomeRule.toneOfDoorResult`).
 *
 * A PORTA ESCOLHE POR CÓDIGO (dono, 2026-09-09): *"os erros do frontend
 * precisam ser o mais genéricos possível. No login, por exemplo, precisamos
 * mostrar 'Não é possível acessar a aplicação agora. Entre em contato com um
 * administrador.'"* A `DoorRefusal` é quem decide o que fala e o que cala — a
 * frase é NOSSA e existe nos dois idiomas, e a do serviço nunca chega aqui.
 * O pulso vermelho e o `aria-invalid` seguem a mesma partição: só a recusa do
 * que foi DIGITADO pinta o campo.
 *
 * A ENTRADA ESPERA A PISCADA (dono, 2026-09-08): "ao inserir a senha correta
 * eu quero ver a rede de sinapse piscando em azul […]. Se necessário, atrase
 * 1 segundo a entrada do usuário para que seja possível ver a piscada em
 * azul". O pulso azul já disparava, mas a sessão abria no mesmo instante e a
 * tela trocava antes de a onda cruzar. Agora a `EntrancePulseCeremony` segura
 * a abertura pelo tempo da onda (a duração vem do motor, não daqui); com
 * movimento reduzido, entra na hora. A RECUSA continua sem espera — o
 * vermelho pulsa e a pessoa já está onde vai corrigir a senha.
 *
 * A PORTA EXPLICA POR QUE VOCÊ SAIU (PR 9, [FA-01]/[FA-02]): inatividade e
 * expiração chegam como `SessionEndReason` — pelo portão, na mesma aba, ou
 * pela memória da aba depois de um F5 — e viram um aviso INFORMATIVO dentro
 * do cartão, acima dos campos. Não é erro da pessoa, então não é vermelho.
 * Some ao começar a digitar ou ao entrar; "Sair" nunca o mostra.
 */
export function LoginScreen({
  signals: givenSignals,
  sessionEnd = null,
}: { signals?: SynapseSignals; sessionEnd?: SessionEndReason | null } = {}) {
  const { login, register } = useAuth();
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const [ownSignals] = useState(() => new SynapseSignals());
  const signals = givenSignals ?? ownSignals;
  const [mode, setMode] = useState<"login" | "register" | "recovery">("login");
  const [endReason, setEndReason] = useState<SessionEndReason | null>(
    () => sessionEnd ?? sessionEndMemory.recall(),
  );
  const forgetEndReason = () => {
    if (endReason === null) return;
    setEndReason(null);
    sessionEndMemory.clear();
  };
  const fieldChange = (field: "name" | "email" | "password") => (value: string) => {
    forgetEndReason();
    setForm((current) => ({ ...current, [field]: value }));
  };
  // [FA-11]: a instância é server-state — a mesma leitura da tela de queda.
  const instance = useQuery({ ...instanceStatusQuery, refetchOnWindowFocus: false });
  const hasUsers = instance.data?.hasUsers ?? true;
  const checkedInstance = !instance.isPending;
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /**
   * Só a recusa DO QUE FOI DIGITADO marca os campos. Antes, qualquer falha
   * marcava — e o leitor de tela dizia que o campo estava errado quando o
   * problema era da casa (banco fora, balde cheio, rota errada).
   */
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    if (instance.data) setMode(instance.data.hasUsers ? "login" : "register");
  }, [instance.data]);
  useEffect(() => {
    if (instance.isError)
      setError(import.meta.env.DEV ? t("login.offline.dev") : t(DoorRefusal.SILENCE));
  }, [instance.isError, t]);

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
    // O acerto pulsa azul e SEGURA a entrada até a onda terminar.
    const ceremony = new EntrancePulseCeremony(signals, reducedMotion);
    const accepted = () => ceremony.celebrate();
    try {
      if (mode === "register") {
        await register(
          { name: form.name.trim(), email: form.email.trim(), password: form.password },
          accepted,
        );
      } else {
        await login(form.email.trim(), form.password, accepted);
      }
      setError(null);
      setRejected(false);
    } catch (err) {
      // A porta escolhe por CÓDIGO: credencial recusada, conta desabilitada,
      // balde cheio e senha fraca falam; todo o resto recebe a frase do dono.
      const refusal = DoorRefusal.of(err);
      setError(t(refusal.messageKey));
      setRejected(refusal.blamesWhatWasTyped);
      const tone = SynapseOutcomeRule.toneOfDoorResult(err);
      if (tone) signals.pulseWith(tone);
    } finally {
      setSubmitting(false);
    }
  };

  const firstAccess = mode === "register";
  const sessionEndNotice = !firstAccess && endReason?.messageKey ? t(endReason.messageKey) : null;

  if (mode === "recovery") {
    return (
      <AuthScreenShell signals={signals}>
        <AccessRecoveryRequestPanel
          signals={signals}
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
      <p className="mt-2 text-sm text-muted-foreground">
        {firstAccess ? t("login.firstAccess.lead") : t("login.lead")}
      </p>

      {sessionEndNotice && (
        <Callout tone="info" role="status" compact className="mt-6">
          {sessionEndNotice}
        </Callout>
      )}

      {/* Ritmo do cartão (2026-09-07): apoio → 28 → campos a 20 entre si → 16 → botão → 16 → Esqueci. */}
      <form
        className={sessionEndNotice ? "mt-4" : "mt-7"}
        onSubmit={submit}
        onKeyDown={FormKeyboard.submitsOnEnter}
      >
        <div data-testid="auth-fields" className="space-y-5">
          {firstAccess && (
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("login.name")}</Label>
              <Input
                id="name"
                autoComplete="name"
                required
                className="auth-field"
                value={form.name}
                onChange={(event) => fieldChange("name")(event.target.value)}
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
              onChange={(event) => fieldChange("email")(event.target.value)}
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
              onChange={(event) => fieldChange("password")(event.target.value)}
            />
            {firstAccess && (
              <p className="text-xs text-muted-foreground">{t("login.firstAccess.minLength")}</p>
            )}
          </div>
        </div>

        {error && <AuthAlert className="mt-4">{error}</AuthAlert>}

        <Button
          type="submit"
          className="auth-cta mt-4 w-full"
          // Dono (2026-09-07): Enter envia o formulário — o botão só espera a
          // consulta da instância quando a tela ainda pode virar "primeiro acesso".
          disabled={submitting || (!checkedInstance && mode === "register")}
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
          className="auth-link mt-4 w-full text-center text-xs text-muted-foreground"
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
