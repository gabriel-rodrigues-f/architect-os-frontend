import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AuthScreenShell } from "@/components/app/AuthScreenShell";
import {
  PasswordChoiceFields,
  PASSWORD_SUBMIT_BLOCKED_ID,
} from "@/components/app/PasswordChoiceFields";
import { PasswordInput } from "@/components/app/PasswordInput";
import { AuthAlert } from "@/components/app/AuthAlert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { usePasswordChoice } from "@/hooks";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { DoorRefusal } from "@/lib/door-refusal";
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
 *  1. **O botão tranca até a lista fechar** (dono, 2026-09-08: *"Somente é
 *     possível enviar o formulário de senha depois do usuário preencher ambos
 *     os campos corretamente"*). Ele nasceu destrancado, e por um bom motivo:
 *     quem decide é o backend. O que o dono viu foi o outro lado da moeda —
 *     um formulário que sai com as duas senhas diferentes é um erro que a
 *     tela já sabia. A trava é a lista, não uma segunda régua: o que a tela
 *     não consegue medir não tranca nada, e a exigência apontada pelo serviço
 *     se apaga assim que a pessoa mexe na senha, para a recusa de um texto
 *     antigo não trancar o texto novo. Discordando o serviço numa borda, a
 *     recusa dele continua sendo a palavra final (`PasswordRefusal`, de
 *     `details.requirement`).
 *
 *  2. **Sair funciona.** `POST /auth/logout` é uma das três rotas liberadas
 *     enquanto a marca está de pé. Quem não quiser trocar agora precisa
 *     conseguir sair — senão a tela deixaria de ser porta e viraria armadilha.
 *
 * A rede ao fundo (dono, 2026-09-08) pulsa com o resultado, nunca com o
 * envio: recusa do serviço → vermelho; senha trocada → azul; serviço fora →
 * nada. A recusa local deixou de pulsar porque deixou de existir: com o botão
 * trancado pela lista, o formulário não sai para ser recusado aqui.
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

    // A lista é a porta: o botão já está desabilitado, e isto fecha o caminho
    // do teclado. Nenhuma frase aqui — o item vermelho da lista é a frase.
    if (!choice.ready) return;

    setSubmitting(true);
    try {
      await changePassword(currentPassword, choice.newPassword);
      signals.pulseWith("primary");
      toast.success(t("firstAccess.done"));
    } catch (refused) {
      /*
       * FATIA IDIOMA (dono, 2026-09-08) — o último furo da porta.
       *
       * As outras três telas sem sessão já escolhiam a frase por CÓDIGO
       * (`DoorRefusal`, 2026-09-09); esta ainda caía em `authErrorMessage`,
       * que devolve `error.message` — a frase que o backend escreveu, e o
       * backend só escreve pt-BR. Quem chegava aqui lendo em inglês recebia
       * "Senha atual incorreta" em português, na primeira tela do produto.
       *
       * A `DoorRefusal` já sabe apontar a exigência da senha pela
       * `PasswordRefusal`, então a leitura é uma só; o que sobrou aqui é o que
       * só esta tela faz — marcar o item vermelho da lista.
       */
      const refusal = DoorRefusal.of(refused);
      choice.point(refusal.requirement);
      setError(t(refusal.messageKey));
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

        <Button
          type="submit"
          className="w-full"
          disabled={submitting || !choice.ready}
          aria-describedby={choice.ready ? undefined : PASSWORD_SUBMIT_BLOCKED_ID}
        >
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
