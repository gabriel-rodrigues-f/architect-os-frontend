import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * O QUADRO DO ERRO — a mensagem de falha comportada numa caixa.
 *
 * Dono (2026-09-09): *"Mensagem de erro não pode ser texto sem fundo.
 * Comporte a mensagem de erro em um quadro."* Como estava: a frase vermelha
 * solta no meio do vazio, com um botão pequeno embaixo — sem cartão, sem
 * fundo, sem ícone, sem título. Como ele quer: cartão com borda e fundo
 * próprios e, de cima para baixo, ícone de alerta em círculo, título em
 * destaque, texto explicativo e botão primário.
 *
 * SERVE A DOIS LUGARES, ENTÃO É COMPONENTE (regra da casa): a recusa de
 * leitura (`ReadingRefusal`, que já atende a `QuerySection`, o
 * `ConnectionError` do `store` e a ficha) e a página de erro da raiz. Ele é
 * o parente grande do `Callout` compacto de tom `danger` ([D-02]), que
 * continua sendo o aviso EM LINHA das telas de porta e dos diálogos: lá o
 * erro nasce ao lado do campo que a pessoa vai corrigir e um cartão inteiro
 * dentro do cartão do login seria caixa dentro de caixa. Aqui a falha ocupa
 * o lugar do conteúdo que não veio, então o quadro é o conteúdo.
 *
 * NÃO FALA i18n DE PROPÓSITO. O `errorComponent` da raiz é desenhado FORA do
 * `I18nProvider` — ele substitui o componente que monta os provedores —,
 * então título e frase entram por parâmetro, de quem tem dicionário. Quem
 * está dentro da aplicação passa `t(...)`; a raiz passa a frase dela.
 *
 * `role="alert"` no quadro inteiro: o leitor de tela anuncia título e frase
 * juntos, como o `Callout` de tom `danger` já faz.
 */
export function FailureCard({
  title,
  sentence,
  children,
  className,
}: {
  title: string;
  sentence: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      data-testid="failure-card"
      className={cn(
        "surface-card mx-auto w-full max-w-lg border border-border p-6 text-center sm:p-8",
        className,
      )}
    >
      <div
        data-testid="failure-card-icon"
        className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger-subtle text-destructive"
      >
        <CircleAlert className="size-6" aria-hidden="true" />
      </div>
      {/* [T-01]: o papel da casa (`text-subtitle`), nunca a medida do framework. */}
      <h2 className="mt-4 text-subtitle font-semibold text-foreground">{title}</h2>
      <div className="mt-2 text-body text-muted-foreground">{sentence}</div>
      {children !== undefined && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>
      )}
    </div>
  );
}
