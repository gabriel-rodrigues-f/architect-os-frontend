<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Nomes de uma letra (CQ-03)

`id-length` reprova identificador de uma letra em código **novo**. As ocorrências
que já existiam — quase todas parâmetros de callback em cadeias `.map`/`.filter` —
estão registradas em `eslint-suppressions.json`, um livro-razão com contagem por
arquivo. Ele só encolhe: se a sua mudança **remove** um nome curto de um arquivo,
`npm run lint` avisa que sobrou supressão e o conserto é `npm run lint:prune`
(commite o `eslint-suppressions.json` atualizado junto). Adicionar um nome curto
novo deixa o gate vermelho, e é isso que a regra existe para fazer.

Exceções: `t` (tradutor do i18n), `_` (descarte explícito) e, só em
`src/lib/design/color.ts` e `src/lib/accessibility/color-vision.ts`, as letras dos
canais de cor (`l`/`c`/`h` do OKLCH, `a`/`b` do OKLab, `l`/`m`/`s` dos cones,
`r`/`g`/`b` lineares) — ali a letra é o vocabulário da especificação.
