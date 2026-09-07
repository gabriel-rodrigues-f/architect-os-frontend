/**
 * A MOLDURA DO CAMPO — o que `Input`, `Select`, `Textarea`, `ReadOnlyField`
 * e o `FilterTriggerButton` vestem em comum ([F-01]): borda `input`, raio
 * md, tipografia de corpo, placeholder apagado, anel `focus-ring` por
 * `focus-visible` e o desabilitado a 50%. A altura é o token `--control-h`
 * (36 no app) ou `--control-h-lg` (44 nas telas de porta); o `Textarea`
 * cresce com o texto e não a lê.
 *
 * Uma classe, não uma string solta: quem precisa da moldura pergunta a ela,
 * e a régua da catraca `campo-nativo-fora-de-ui` conta quem ainda escreve
 * `border-input` à mão fora daqui.
 */
export type ControlSize = "md" | "lg";

export class FieldControl {
  private static readonly MOLDURA =
    "flex w-full rounded-md border border-input bg-transparent transition-colors placeholder:text-muted-foreground focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50";

  /** 16 no toque (o iOS amplia a página em campo menor que 16), corpo no desktop. */
  private static readonly TEXTO = "text-subtitle md:text-body";

  private static readonly ALTURA: Record<ControlSize, string> = {
    md: "h-(--control-h)",
    lg: "h-(--control-h-lg)",
  };

  /** A moldura sem altura — o `Textarea`. */
  static get moldura(): string {
    return `${FieldControl.MOLDURA} ${FieldControl.TEXTO}`;
  }

  /** A moldura com a altura do tamanho — `Input`, `Select`, `ReadOnlyField`. */
  static campo(size: ControlSize = "md"): string {
    return `${FieldControl.MOLDURA} ${FieldControl.TEXTO} ${FieldControl.ALTURA[size]} px-3`;
  }
}
