import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAsyncSubmit } from "@/hooks";
import { authApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

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
 */
export function AccessRecoveryRequestPanel({
  onBack,
  backLabel,
}: {
  onBack: () => void;
  backLabel: string;
}) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [requested, setRequested] = useState(false);
  const { submitting, error, run } = useAsyncSubmit(t("accessRecovery.request.error"));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await run(() => authApi.requestAccessRecovery(email.trim()));
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

        {error !== null && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

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
