import type { KeyboardEvent } from "react";

/**
 * O ENTER QUE ENVIA — explícito, e não confiado à submissão implícita.
 *
 * Dono (2026-09-07 e de novo em 2026-09-08): *"na tela de login ainda não
 * consigo enviar o formulário com a tecla Enter"*. O formulário tem botão
 * `submit`, nenhum ouvinte previne a tecla, e ainda assim o navegador do dono
 * não submeteu. A submissão implícita depende de condições que a tela não
 * controla (o botão padrão, o `keypress` que o navegador decide ou não gerar,
 * extensões de senha que interceptam a tecla). Este objeto tira a tela dessa
 * dependência: Enter num campo de texto do formulário chama `requestSubmit`,
 * que passa pela validação nativa e pelo `onSubmit` de sempre.
 *
 * Fora do alcance, de propósito: `textarea` (Enter é quebra de linha) e
 * botões (Enter é o clique deles).
 */
export class FormKeyboard {
  static submitsOnEnter(event: KeyboardEvent<HTMLFormElement>): void {
    if (event.key !== "Enter" || event.defaultPrevented) return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    event.preventDefault();
    event.currentTarget.requestSubmit();
  }
}
