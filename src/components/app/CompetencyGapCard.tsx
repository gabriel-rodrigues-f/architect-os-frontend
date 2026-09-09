import type { ReactNode } from "react";

import { useGapReading } from "@/hooks";
import { useI18n } from "@/lib/i18n";
import { GapBadge } from "@/components/app/ui-bits";
import { HelpPopover } from "@/components/app/HelpPopover";
import { SentenceBlock } from "@/components/app/SentenceBlock";

/**
 * O "?" DO SELO: a ajuda da casa (`HelpPopover`) explicando o que aquela
 * distância significa. Abre no ponteiro, no foco e no clique — clicar fixa —
 * porque é o mesmo gatilho das outras três ajudas (dono, 2026-09-09), e não um
 * segundo balão escrito à mão. O título é a própria frase do selo; o corpo é a
 * explicação da faixa, que vem do TOM (`useGapReading`) e não do rótulo.
 */
function GapReadingHelp({ gap }: { gap: number }) {
  const { t } = useI18n();
  const reading = useGapReading(gap);
  return (
    <HelpPopover
      label={t("gap.help.ariaLabel", { selo: reading.badge })}
      title={reading.badge}
      align="end"
    >
      <p>
        <SentenceBlock text={reading.explanation} />
      </p>
    </HelpPopover>
  );
}

/**
 * O CARTÃO DA COMPETÊNCIA COM A DISTÂNCIA, organizado EM LINHAS.
 *
 * Dono, 2026-09-09, com duas capturas: *"bug visual em PDI. O texto da
 * capacidade está quase impossível de ler. Você está organizando por colunas.
 * Eu sugiro organizar por linhas. O mais importante é eu conseguir visualizar
 * o nome da capacidade elegantemente e confortavelmente."*
 *
 * O arranjo anterior (o conserto da manhã) era uma COLUNA de duas: nome à
 * esquerda com `min-w-0`, selo à direita com `shrink-0`. Aquilo parou o
 * vazamento do selo para fora do cartão, mas o preço foi este: o selo fica com
 * a largura que precisa — ele é `whitespace-nowrap` — e o NOME fica com o
 * resto. Medido na coluna de 320 px do PDI, o resto era 76 px, e
 * "Observabilidade e Confiabilidade de Plataforma" descia em cinco tiras
 * ("Observabil / idade e / Confiabilid / ade de / Plataforma").
 *
 * Agora as duas coisas não dividem mais uma linha: elas ocupam LINHAS
 * diferentes de uma grade de duas colunas. O selo mora na primeira linha, na
 * coluna da direita (`auto`, o tamanho dele); o nome mora na segunda e
 * ATRAVESSA as duas colunas, então mede o cartão inteiro — 256 px medidos, de
 * 76. Duas linhas confortáveis em vez de cinco tiras.
 *
 * Por que uma grade e não um `float`: medi as duas. O `float` estreita a
 * PRIMEIRA linha do texto (62 px sobravam ao lado do selo) e, com
 * `break-words`, o navegador parte a palavra ali mesmo — a tira de letras
 * voltava na linha 1. Na grade não há linha estreita nenhuma. E a grade deixa
 * o NOME primeiro no DOM, que é a ordem em que o leitor de tela deve ouvir o
 * cartão, mesmo com o selo desenhado acima dele.
 *
 * O nome NUNCA é truncado: `break-words` só parte uma palavra que não caberia
 * nem numa linha vazia de 256 px — a rede contra o vazamento continua de pé —,
 * e o dono já reprovou nome de competência cortado.
 *
 * Os dois cartões que o usam são os mesmos do conserto da manhã — PDI >
 * "Maiores distâncias" e "Treinamentos Recomendados para o Time" —, e o
 * arranjo serve aos dois: o que muda entre eles é o CONTEÚDO das duas últimas
 * linhas, não a ordem delas. `description` é a linha de texto corrido (a
 * capacitação tem uma; o PDI não tem descrição de competência para mostrar —
 * ela não existe no contrato) e `action` é a ação que fecha o cartão, esticada
 * à largura inteira pelo `grid` que a veste, para nenhuma tela precisar
 * lembrar de escrever `w-full`.
 */
export function CompetencyGapCard({
  name,
  gap,
  description,
  action,
}: {
  name: string;
  gap: number | undefined;
  /** O texto corrido da linha do meio; ausente quando a tela não tem o dado. */
  description?: ReactNode;
  /** A ação que fecha o cartão — um botão, um link. */
  action?: ReactNode;
}) {
  return (
    <li className="surface-inset p-3">
      <div className="grid grid-cols-[1fr_auto]">
        <p className="col-span-2 row-start-2 break-words text-body font-medium leading-6">{name}</p>
        <span className="col-start-2 row-start-1 flex items-center gap-1">
          <GapBadge gap={gap} size="sm" />
          {gap !== undefined && <GapReadingHelp gap={gap} />}
        </span>
      </div>
      {description !== undefined && (
        <p className="mt-2 text-body text-muted-foreground">{description}</p>
      )}
      {action !== undefined && <div className="mt-3 grid">{action}</div>}
    </li>
  );
}
