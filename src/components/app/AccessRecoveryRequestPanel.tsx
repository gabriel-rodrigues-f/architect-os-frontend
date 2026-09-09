import { useState, type FormEvent } from "react";

import { AuthAlert } from "@/components/app/AuthAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAsyncSubmit } from "@/hooks";
import { authApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { SynapseSignals } from "@/lib/synapse-network";
import { SynapseOutcomeRule } from "@/lib/synapse-outcome";

/**
 * PEDIR O ACESSO DE VOLTA — o "esqueci minha senha".
 *
 * Dois lugares chamam esta mesma tela: a `LoginScreen`, para quem não
 * consegue entrar, e a `SetPasswordScreen`, para quem chegou com um link que
 * não serve mais. Regra da casa: o que serve a 2 lugares vira componente.
 *
 * **A CONFIRMAÇÃO É SEMPRE A MESMA.** O serviço responde 202 exista a conta
 * ou não — de propósito, e o CONTRATO diz isso com todas as letras: a
 * resposta não pode revelar quem tem conta aqui. Por isso não existe ramo de
 * "e-mail não encontrado" neste arquivo, e não existe nada para escrever nele:
 * a tela não tem como distinguir os dois casos, e é essa a garantia. Um
 * `if` a mais aqui seria um oráculo de contas para quem estiver do lado de
 * fora chutando endereços.
 *
 * O que a confirmação diz é o que a pessoa precisa saber para agir: se houver
 * conta, o LINK chega, e ele vale por uma hora. Nunca que uma senha foi
 * enviada — o dono corrigiu o próprio pedido nesse ponto (2026-09-04), e
 * senha não viaja por e-mail nesta aplicação.
 *
 * A rede ao fundo (dono, 2026-09-08) recebe o resultado do pedido pelos
 * `signals` da porta que abriu este painel: aceito → azul; recusado → vermelho;
 * serviço fora → nada.
 */
export function AccessRecoveryRequestPanel({
  onBack,
  backLabel,
  signals,
}: {
  onBack: () => void;
  backLabel: string;
  signals?: SynapseSignals;
}) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [requested, setRequested] = useState(false);
  /*
   * A FRASE É NOSSA, SEMPRE (dono, 2026-09-09). O contrato desta rota responde
   * 202 exista a conta ou não, então TODA falha aqui é de infraestrutura — e a
   * frase que o serviço escreve nessas horas conta o estado interno da casa,
   * em pt-BR, numa tela que também existe em inglês. Por isso o fallback é uma
   * função: ela ignora `error.message` em vez de só cobrir o silêncio dele.
   */
  const { submitting, error, run } = useAsyncSubmit(() => t("accessRecovery.request.error"));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await run(() => authApi.requestAccessRecovery(email.trim()));
    const tone = SynapseOutcomeRule.toneOfDoorResult(result.ok ? null : result.error);
    if (tone) signals?.pulseWith(tone);
    if (result.ok) setRequested(true);
  };

  if (requested) {
    return (
      <>
        <h1 className="font-display text-lg font-semibold">
          {t("accessRecovery.request.doneTitle")}
        </h1>
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {t("msg.auth.accessRecovery.requested")}
        </p>
        <Button type="button" variant="outline" className="mt-5 w-full" onClick={onBack}>
          {backLabel}
        </Button>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-lg font-semibold">{t("accessRecovery.request.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("accessRecovery.request.lead")}</p>

      <form className="mt-5 space-y-3" onSubmit={submit}>
        <div>
          <Label htmlFor="recovery-email">{t("login.email")}</Label>
          <Input
            id="recovery-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        {error !== null && <AuthAlert>{error}</AuthAlert>}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? t("accessRecovery.request.submitting") : t("accessRecovery.request.submit")}
        </Button>
      </form>

      <Button type="button" variant="ghost" size="sm" className="mt-3 w-full" onClick={onBack}>
        {backLabel}
      </Button>
    </>
  );
}
