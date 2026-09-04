import { Check, Circle, Minus } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PasswordChoice } from "@/hooks";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { PASSWORD_REQUIREMENTS, PASSWORD_REQUIREMENT_ITEM } from "@/lib/password-safety";
import { cn } from "@/lib/utils";

/**
 * OS DOIS CAMPOS DA SENHA NOVA, com as exigências à vista antes de errar.
 *
 * Saiu inteiro de `FirstAccessScreen`, onde nasceu, quando a criação de senha
 * pelo link do convite virou a segunda tela a pedir a mesma coisa. Copiar as
 * sete exigências para lá seria garantir que um dia elas divergissem — a
 * lista já é derivada de `PASSWORD_REQUIREMENTS`, que é o contrato medido do
 * backend, e agora o DESENHO dela também tem um dono só.
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

      <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
        <p id="password-requirements" className="text-xs font-medium text-foreground">
          {t("password.requirements")}
        </p>
        <ul className="mt-1.5 space-y-1">
          {PASSWORD_REQUIREMENTS.map((requirement) => (
            <PasswordRequirementItem
              key={requirement}
              label={t(PASSWORD_REQUIREMENT_ITEM[requirement])}
              met={choice.safety.meets(requirement) && choice.pointed !== requirement}
              unmeasured={choice.safety.cannotMeasure(requirement)}
              pointed={choice.pointed === requirement}
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
        "flex items-start gap-2 text-xs",
        met ? "text-foreground" : "text-muted-foreground",
        pointed && "font-medium text-destructive",
      )}
    >
      <state.Mark className="mt-px size-3.5 shrink-0" aria-hidden="true" />
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
  ) {}

  static of(met: boolean, unmeasured: boolean, pointed: boolean): PasswordRequirementState {
    if (pointed) return new PasswordRequirementState(Circle, "password.requirement.pending");
    if (unmeasured) return new PasswordRequirementState(Minus, "password.requirement.unmeasured");
    if (met) return new PasswordRequirementState(Check, "password.requirement.met");
    return new PasswordRequirementState(Circle, "password.requirement.pending");
  }
}
