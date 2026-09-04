import { useState } from "react";

import { SafePassword, type PasswordRequirement } from "@/lib/password-safety";

/**
 * A ESCOLHA DE UMA SENHA NOVA — os dois campos, a leitura de segurança e a
 * exigência que o serviço apontou.
 *
 * Três telas escolhem uma senha: o primeiro acesso (`FirstAccessScreen`), a
 * criação da senha pelo link do convite (`SetPasswordScreen`) e, no futuro,
 * qualquer troca voluntária. Regra da casa: o que serve a 2 lugares vira
 * componente. Este é o estado; `PasswordChoiceFields` é o desenho.
 *
 * `email` é o endereço da pessoa quando a tela o conhece — o primeiro acesso
 * tem sessão e o conhece. Quem chega pelo LINK do convite não: ali o token é
 * opaco e não há sessão, e é `SafePassword.withoutKnownEmail` que diz, sem
 * mentir, que aquela exigência não é conferível naquela tela.
 */
export interface PasswordChoice {
  readonly newPassword: string;
  readonly confirmation: string;
  /** A exigência que o SERVIÇO apontou na última recusa, ou `null`. */
  readonly pointed: PasswordRequirement | null;
  /** As duas caixas dizem a mesma senha. */
  readonly matches: boolean;
  readonly safety: SafePassword;
  readonly setNewPassword: (value: string) => void;
  readonly setConfirmation: (value: string) => void;
  readonly point: (requirement: PasswordRequirement | null) => void;
}

export function usePasswordChoice(email: string | null): PasswordChoice {
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pointed, setPointed] = useState<PasswordRequirement | null>(null);

  return {
    newPassword,
    confirmation,
    pointed,
    matches: newPassword === confirmation,
    safety:
      email === null
        ? SafePassword.withoutKnownEmail(newPassword)
        : SafePassword.of(newPassword, email),
    setNewPassword,
    setConfirmation,
    point: setPointed,
  };
}
