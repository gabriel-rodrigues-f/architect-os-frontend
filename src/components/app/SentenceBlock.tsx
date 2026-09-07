import { Fragment } from "react";

import { SentenceLines } from "@/lib/sentence-lines";

/**
 * Frases curtas, uma por linha (referência FIAP 2026-09-06, §2 item 9). O
 * texto continua nós de texto diretos do pai — quem procura pelo texto inteiro
 * ainda o encontra: a quebra é `<br>`, e o espaço original abre a linha seguinte.
 */
export function SentenceBlock({ text }: { text: string }) {
  const linhas = new SentenceLines(text).lines;
  return (
    <>
      {linhas.map((linha, indice) => (
        <Fragment key={linha + String(indice)}>
          {indice > 0 && <br />}
          {indice > 0 ? ` ${linha}` : linha}
        </Fragment>
      ))}
    </>
  );
}
