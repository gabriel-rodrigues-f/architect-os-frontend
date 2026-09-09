import { useI18n, type MessageKey } from "@/lib/i18n";

/**
 * O QUE A TELA DIZ NO LUGAR DE UM ESTADO VAZIO QUE ELA NÃO PODE AFIRMAR.
 *
 * Estado vazio é uma afirmação: "não há nenhuma". Desde que as listagens por
 * pessoa passaram a responder `200 []` a quem não alcança a pessoa, essa
 * afirmação pode ser falsa — a lista veio vazia porque não é sua para ver. Onde
 * a tela não distingue as duas histórias, ela não conta nenhuma das duas, e
 * diz isso com todas as letras.
 *
 * O ASSUNTO carrega a própria concordância ("As mentorias", "As trilhas"), como
 * em `EmptySubject`: quem chama escolhe a chave, nunca escreve a frase.
 */
export function OutOfReachNote({ subject }: { subject: MessageKey }) {
  const { t } = useI18n();
  return (
    <p className="text-body text-muted-foreground">
      {t("arch.outOfReach.listing", { assunto: t(subject) })}
    </p>
  );
}
