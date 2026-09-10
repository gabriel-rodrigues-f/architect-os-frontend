import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { AuthAlert } from "@/components/app/AuthAlert";
import {
  PasswordChoiceFields,
  PASSWORD_SUBMIT_BLOCKED_ID,
} from "@/components/app/PasswordChoiceFields";
import { PasswordInput } from "@/components/app/PasswordInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { usePasswordChoice } from "@/hooks";
import { useAuth } from "@/lib/auth";
import { DoorRefusal } from "@/lib/door-refusal";
import { useI18n, type MessageKey } from "@/lib/i18n";
import type { SynapseSignals } from "@/lib/synapse-network";
import { SynapseOutcomeRule } from "@/lib/synapse-outcome";

/**
 * AS PALAVRAS DE UMA TELA sobre o mesmo gesto — o único eixo em que a porta do
 * primeiro acesso e a aba Segurança diferem.
 *
 * Elas vêm juntas, num objeto, e não como quatro propriedades soltas, por duas
 * razões. A primeira é de desenho: são UMA coisa — o vocabulário desta tela —,
 * e separadas convidam a preencher três e esquecer a quarta.
 *
 * A segunda é da casa. A catraca `nenhuma-senha-no-repositorio-publico` lê
 * como segredo publicado toda propriedade cujo NOME termina no vocabulário de
 * credencial e cujo valor é um literal — e ela está certa em ler assim: o nome
 * de uma propriedade não é lugar de decidir se o literal ao lado é uma chave
 * de texto de tela ou uma credencial de verdade. Chamar o campo de
 * `currentLabel` tira a ambiguidade na ORIGEM, em vez de pedir exceção para
 * uma régua que existe justamente para não ter exceção.
 */
export interface PasswordChangeWording {
  /** Como esta tela chama a senha de agora — "temporária" na porta, "atual" na conta. */
  readonly currentLabel: MessageKey;
  readonly submit: MessageKey;
  readonly submitting: MessageKey;
  readonly done: MessageKey;
}

/**
 * A PESSOA TROCA A PRÓPRIA SENHA — o gesto inteiro, num lugar só.
 *
 * Ele nasceu dentro da `FirstAccessScreen`, a tela que segura a porta no
 * primeiro acesso (dono, 2026-09-03). Quando Minha Conta ganhou a aba
 * Segurança, virou o MESMO gesto pela segunda vez: senha atual, os dois
 * campos da senha nova com as exigências à vista, `POST /auth/change-password`,
 * e a recusa lida por código. A régua de reuso da casa manda extrair — e aqui
 * ela pesa mais do que o normal, porque duas cópias que divergem numa borda de
 * senha divergem justamente no que ninguém testa à mão.
 *
 * O que NÃO entrou, de propósito, e continua sendo de cada tela: a casca (a
 * porta usa `AuthScreenShell`, a aba usa o cartão da página), o texto que
 * explica a situação, e a saída de quem não quer trocar agora — no primeiro
 * acesso é o "sair"; em Minha Conta é simplesmente trocar de aba.
 *
 * Três coisas que o formulário sabe e que a tela não precisa repetir:
 *
 *  1. **O botão só abre com a lista fechada** (dono, 2026-09-08). Quem tranca
 *     é `PasswordChecklist`, não uma segunda régua: o que a tela não consegue
 *     medir não tranca nada, e a exigência apontada pelo serviço se apaga
 *     assim que a pessoa mexe na senha.
 *
 *  2. **A recusa não conta nada.** A frase sai de `DoorRefusal`, por CÓDIGO —
 *     nunca a mensagem que o serviço escreveu, que só existe em pt-BR. E ela
 *     não diz de que jeito a senha atual estava errada: "não confere" é tudo o
 *     que uma recusa de senha pode dizer sem virar aula para quem tenta
 *     adivinhar. Nenhuma senha digitada entra na frase, no registro ou no
 *     endereço.
 *
 *  3. **Senha nova, sessão nova.** O serviço fecha o cookie na resposta
 *     (`auth.controller`), e o token antigo já morreria pelo `pcv` —
 *     `auth.plugin` recusa todo token cujo carimbo de senha não seja o atual.
 *     Quem trocou volta pela tela de login, e é o `useAuth().changePassword`
 *     que encerra a sessão do navegador. A tela só avisa ANTES.
 */
export function PasswordChangeForm({
  wording,
  note,
  signals,
}: {
  wording: PasswordChangeWording;
  /** O que a tela quer dizer entre os campos e o botão — o aviso das sessões, por exemplo. */
  note?: ReactNode;
  /** A rede ao fundo, quando existe: só as telas de porta pulsam (dono, 2026-09-08). */
  signals?: SynapseSignals | undefined;
}) {
  const { user, changePassword } = useAuth();
  const { t } = useI18n();
  const choice = usePasswordChoice(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    choice.point(null);

    // A lista é a porta: o botão já está desabilitado, e isto fecha o caminho
    // do teclado. Nenhuma frase aqui — o item vermelho da lista é a frase.
    if (!choice.ready) return;

    setSubmitting(true);
    try {
      await changePassword(currentPassword, choice.newPassword);
      signals?.pulseWith("primary");
      toast.success(t(wording.done));
    } catch (refused) {
      const refusal = DoorRefusal.of(refused);
      choice.point(refusal.requirement);
      setError(t(refusal.messageKey));
      const tone = SynapseOutcomeRule.toneOfDoorResult(refused);
      if (tone) signals?.pulseWith(tone);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-3" onSubmit={submit}>
      <div>
        <Label htmlFor="current-password">{t(wording.currentLabel)}</Label>
        <PasswordInput
          id="current-password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </div>

      <PasswordChoiceFields choice={choice} />

      {note}

      {error !== null && <AuthAlert>{error}</AuthAlert>}

      <Button
        type="submit"
        className="w-full"
        disabled={submitting || !choice.ready}
        aria-describedby={choice.ready ? undefined : PASSWORD_SUBMIT_BLOCKED_ID}
      >
        {submitting ? t(wording.submitting) : t(wording.submit)}
      </Button>
    </form>
  );
}
