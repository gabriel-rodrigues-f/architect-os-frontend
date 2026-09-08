import { useCallback, useState } from "react";

import { PasswordChecklist, SafePassword, type PasswordRequirement } from "@/lib/password-safety";

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
 *
 * Dono (2026-09-08): *"Somente é possível enviar o formulário de senha depois
 * do usuário preencher ambos os campos corretamente."* Quem responde isso é
 * `ready`, e ele é a lista inteira — as exigências e a conferência das duas
 * caixas. Digitar em qualquer um dos dois campos APAGA a exigência que o
 * serviço apontou: ela falava do texto anterior, e mantê-la vermelha sobre um
 * texto novo trancaria o botão numa recusa que já não vale.
 */
export interface PasswordChoice {
  readonly newPassword: string;
  readonly confirmation: string;
  /** A exigência que o SERVIÇO apontou na última recusa, ou `null`. */
  readonly pointed: PasswordRequirement | null;
  /** A lista inteira: as exigências do servidor e a conferência das duas caixas. */
  readonly checklist: PasswordChecklist;
  /** Nenhum item da lista está vermelho — o formulário pode sair. */
  readonly ready: boolean;
  readonly safety: SafePassword;
  readonly setNewPassword: (value: string) => void;
  readonly setConfirmation: (value: string) => void;
  readonly point: (requirement: PasswordRequirement | null) => void;
}

export function usePasswordChoice(email: string | null): PasswordChoice {
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pointed, setPointed] = useState<PasswordRequirement | null>(null);

  const typeNewPassword = useCallback((value: string) => {
    setNewPassword(value);
    setPointed(null);
  }, []);

  const typeConfirmation = useCallback((value: string) => {
    setConfirmation(value);
    setPointed(null);
  }, []);

  const safety =
    email === null
      ? SafePassword.withoutKnownEmail(newPassword)
      : SafePassword.of(newPassword, email);
  const checklist = PasswordChecklist.of(safety, newPassword, confirmation, pointed);

  return {
    newPassword,
    confirmation,
    pointed,
    checklist,
    ready: checklist.ready,
    safety,
    setNewPassword: typeNewPassword,
    setConfirmation: typeConfirmation,
    point: setPointed,
  };
}
