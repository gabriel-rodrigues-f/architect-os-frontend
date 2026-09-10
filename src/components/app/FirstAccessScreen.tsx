import { useState } from "react";

import { AuthScreenShell } from "@/components/app/AuthScreenShell";
import { PasswordChangeForm } from "@/components/app/PasswordChangeForm";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { SynapseSignals } from "@/lib/synapse-network";

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
 * duas cópias das sete exigências divergiriam.
 *
 * E o FORMULÁRIO INTEIRO saiu daqui na fatia de Minha Conta (2026-09-10):
 * a aba Segurança pede o mesmo gesto — senha de agora, senha nova conferida
 * pela lista, `POST /auth/change-password`, recusa lida por código. São duas
 * ocorrências, e a régua de reuso da casa manda extrair; num gesto de senha
 * ela pesa mais, porque duas cópias divergem justamente na borda que ninguém
 * confere à mão. Quem faz isso agora é o `PasswordChangeForm`. O que sobrou
 * nesta tela é o que só ELA tem: a casca de porta, o texto do primeiro
 * acesso, o e-mail à vista e a saída de quem não quer trocar agora.
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
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const email = user?.email ?? "";
  // A rede ao fundo (dono, 2026-09-08) pulsa com o RESULTADO, nunca com o
  // envio: recusa do serviço → vermelho; senha trocada → azul; serviço fora →
  // nada. É das telas de porta, e por isso ela nasce aqui e desce ao
  // formulário — dentro da aplicação, ninguém pulsa.
  const [signals] = useState(() => new SynapseSignals());

  return (
    <AuthScreenShell signals={signals}>
      <h1 className="font-display text-lg font-semibold">{t("firstAccess.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("firstAccess.lead")}</p>
      {email !== "" && <p className="mt-1 text-xs font-medium text-foreground">{email}</p>}

      <div className="mt-5">
        <PasswordChangeForm
          wording={{
            currentLabel: "firstAccess.currentPassword",
            submit: "firstAccess.submit",
            submitting: "firstAccess.submitting",
            done: "firstAccess.done",
          }}
          signals={signals}
        />
      </div>

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
