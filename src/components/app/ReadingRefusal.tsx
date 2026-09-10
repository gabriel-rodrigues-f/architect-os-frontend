import { FailureCard } from "@/components/app/FailureCard";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

/**
 * A LEITURA QUE NÃO VEIO, contida no lugar dela.
 *
 * Duas telas precisam da mesma peça — a `QuerySection`, quando a seção não
 * carregou, e o `ConnectionError`, quando a casa RESPONDEU alguma coisa que
 * não é queda (404, 403, 409). Regra da casa: o que serve a 2 lugares vira
 * componente.
 *
 * Ela é o contrário da tela de queda (dono, 2026-09-09): a corrida de
 * carreira é para quando a aplicação não consegue falar com a casa; uma
 * recusa de UMA leitura fica onde a leitura ficaria, com o resto da tela de
 * pé e um caminho de volta. A frase vem de quem chama, porque só quem chama
 * sabe o que a pessoa estava tentando ler.
 *
 * A FRASE MORA NUM QUADRO (dono, 2026-09-09): *"Mensagem de erro não pode
 * ser texto sem fundo."* Era um `<p>` vermelho solto e um botão de contorno
 * pequeno; virou o `FailureCard` — ícone em círculo, título, a frase de quem
 * chama e o botão primário. O TÍTULO é fixo e genérico de propósito: quem
 * decide o que a situação conta é a frase, e ela vem da `ApiFailureReading`,
 * que já passa pela régua do "erro não conta nada". O título só diz que algo
 * falhou — nada que se aprenda sobre a casa por trás.
 */
export function ReadingRefusal({ sentence, onRetry }: { sentence: string; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <FailureCard title={t("failure.title")} sentence={sentence}>
      <Button onClick={onRetry}>{t("common.retry")}</Button>
    </FailureCard>
  );
}
