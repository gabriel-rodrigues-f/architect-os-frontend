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
 */
export function ReadingRefusal({ sentence, onRetry }: { sentence: string; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <>
      <p className="text-body text-destructive" role="alert">
        {sentence}
      </p>
      <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}>
        {t("common.retry")}
      </Button>
    </>
  );
}
