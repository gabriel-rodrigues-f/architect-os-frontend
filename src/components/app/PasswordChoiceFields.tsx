import { Check, Circle, Minus } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PasswordChoice } from "@/hooks";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { PASSWORD_CHECKS, PASSWORD_CHECK_ITEM } from "@/lib/password-safety";
import { cn } from "@/lib/utils";

/**
 * OS DOIS CAMPOS DA SENHA NOVA, com as exigências à vista antes de errar.
 *
 * Saiu inteiro de `FirstAccessScreen`, onde nasceu, quando a criação de senha
 * pelo link do convite virou a segunda tela a pedir a mesma coisa. Copiar as
 * exigências para lá seria garantir que um dia elas divergissem — a lista já
 * é derivada de `PASSWORD_CHECKS` (as oito de `PASSWORD_REQUIREMENTS`, que é
 * o contrato medido do backend, mais a conferência das duas caixas), e agora
 * o DESENHO dela também tem um dono só.
 *
 * Dono (2026-09-08): *"deve haver um bullet validando senha nova e repita a
 * senha nova. hoje isso não existe."* O bullet fecha a lista, e ele é o único
 * item que só esta tela mede — o serviço nunca vê a repetição.
 *
 * As três escolhas que vieram junto, e que valem para as duas telas:
 *
 *  1. **As exigências antes do erro.** A lista está na tela desde o começo e
 *     se marca enquanto a pessoa digita. Descobrir a régua depois de apanhar
 *     do formulário é o que ela existe para não fazer.
 *
 *  2. **A palavra do serviço vale sobre a leitura local.** Apontada pelo
 *     backend (`PasswordChoice.pointed`), a exigência volta a faltar mesmo
 *     que aqui parecesse de pé — o serviço é a autoridade.
 *
 *  3. **O que não dá para medir aqui não ganha tique verde.** Sem o e-mail da
 *     pessoa — o caso de quem chega pelo link — a exigência do próprio e-mail
 *     aparece como "confere ao salvar", nunca como atendida.
 */
/**
 * O MOTIVO DE O BOTÃO ESTAR TRANCADO, para quem não vê a cor da lista.
 *
 * Ele mora aqui, e não em cada tela, porque as duas telas fazem a mesma
 * pergunta ao mesmo estado — e porque o motivo é a LISTA, que é desta casa.
 * As telas só apontam para ele com `aria-describedby`; a régua da casa não
 * deixa nascer `title` novo, e um botão desabilitado sem motivo legível seria
 * uma porta sem placa.
 */
export const PASSWORD_SUBMIT_BLOCKED_ID = "password-submit-blocked";

export function PasswordChoiceFields({ choice }: { choice: PasswordChoice }) {
  const { t } = useI18n();

  return (
    <>
      <div>
        <Label htmlFor="new-password">{t("password.newPassword")}</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          aria-describedby="password-requirements"
          value={choice.newPassword}
          onChange={(event) => choice.setNewPassword(event.target.value)}
        />
      </div>

      <div className="surface-inset px-3 py-2">
        <p id="password-requirements" className="text-label font-medium text-foreground">
          {t("password.requirements")}
        </p>
        {/* `aria-live` discreto: quem ouve a tela acompanha o item que acabou
            de fechar, sem precisar reler a lista inteira a cada tecla. */}
        <ul className="mt-1.5 space-y-1" aria-live="polite">
          {PASSWORD_CHECKS.map((check) => (
            <PasswordRequirementItem
              key={check}
              label={t(PASSWORD_CHECK_ITEM[check])}
              met={choice.checklist.meets(check)}
              unmeasured={choice.checklist.cannotMeasure(check)}
              pointed={choice.checklist.pointed(check)}
            />
          ))}
        </ul>
      </div>

      <div>
        <Label htmlFor="confirm-password">{t("password.confirmation")}</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={choice.confirmation}
          onChange={(event) => choice.setConfirmation(event.target.value)}
        />
      </div>

      {!choice.ready && (
        <p id={PASSWORD_SUBMIT_BLOCKED_ID} className="sr-only">
          {t("password.submitBlocked")}
        </p>
      )}
    </>
  );
}

function PasswordRequirementItem({
  label,
  met,
  unmeasured,
  pointed,
}: {
  label: string;
  met: boolean;
  unmeasured: boolean;
  pointed: boolean;
}) {
  const { t } = useI18n();
  const state = PasswordRequirementState.of(met, unmeasured, pointed);

  return (
    <li
      className={cn(
        "flex items-start gap-2 text-label",
        met ? "text-foreground" : "text-muted-foreground",
        pointed && "font-medium text-destructive",
      )}
    >
      {/* Dono (2026-09-06): a bolinha nasce vermelha e fica verde quando a exigência é atendida. */}
      <state.Mark
        className={cn("mt-px size-3.5 shrink-0", state.tone)}
        aria-hidden="true"
        data-requirement-state={state.name}
      />
      <span>{label}</span>
      <span className="sr-only">{t(state.reading)}</span>
    </li>
  );
}

/**
 * O estado de UMA exigência na lista — o ícone e o que o leitor de tela diz.
 * A ordem das perguntas é a ordem da autoridade: a exigência apontada pelo
 * serviço vem primeiro, depois a que esta tela não consegue medir, e só
 * então a leitura local.
 */
class PasswordRequirementState {
  private constructor(
    readonly Mark: typeof Check,
    readonly reading: MessageKey,
    /** A cor da marca: vermelha enquanto falta, verde quando atendida, neutra quando esta tela não mede. */
    readonly tone: string,
    readonly name: "pending" | "unmeasured" | "met",
  ) {}

  static of(met: boolean, unmeasured: boolean, pointed: boolean): PasswordRequirementState {
    if (pointed) {
      return new PasswordRequirementState(
        Circle,
        "password.requirement.pending",
        "text-destructive",
        "pending",
      );
    }
    if (unmeasured) {
      return new PasswordRequirementState(
        Minus,
        "password.requirement.unmeasured",
        "text-muted-foreground",
        "unmeasured",
      );
    }
    if (met) {
      return new PasswordRequirementState(
        Check,
        "password.requirement.met",
        "text-success-fg",
        "met",
      );
    }
    return new PasswordRequirementState(
      Circle,
      "password.requirement.pending",
      "text-destructive",
      "pending",
    );
  }
}
