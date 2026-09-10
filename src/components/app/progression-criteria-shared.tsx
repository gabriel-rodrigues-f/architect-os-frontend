import type { ReactNode } from "react";

import { OutOfReachScreen } from "@/components/app/OutOfReachScreen";
import { PageHeader } from "@/components/app/ui-bits";
import { usePageHelp } from "@/lib/page-help";

/**
 * A CASCA ÚNICA DAS SEIS FATIAS DE CRITÉRIOS DE PROGRESSÃO.
 *
 * Dono (2026-09-10): *"'Critérios de Progressão' deixa de ser um menu e
 * torna-se um grupo… organizamos o que antes seriam abas em menus do grupo"*.
 * Uma tela de 1390 linhas virou seis rotas, e cada uma precisa de cabeçalho,
 * `?` e recusa. Seis cópias do mesmo cabeçalho seria a segunda ocorrência da
 * mesma coisa — e a régua da casa é a de sempre: o que serve a dois lugares
 * vira componente, o que serve a seis com mais razão ainda.
 *
 * O que NÃO mora aqui, de propósito: o ramo `if (!sinal)`. Cada rota pergunta
 * o PRÓPRIO alcance à política e decide, na própria fonte, se desenha ou
 * recusa — é isso que a catraca `alcance-por-rota` lê e o que faz a fatia que
 * a pessoa não alcança sumir da coluna em vez de aparecer capada.
 */
type FatiaDosCriterios =
  | "eligibility"
  | "scoringRulers"
  | "textTemplates"
  | "catalogPolicy"
  | "vocabularies"
  | "modelReference";

export function ProgressionCriteriaScreen({
  slice,
  title,
  description,
  children,
}: {
  slice: FatiaDosCriterios;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const help = usePageHelp(slice);
  return (
    <>
      <PageHeader title={title} description={description} help={help} />
      {children}
    </>
  );
}

/**
 * A recusa da fatia — a metade que o menu não cobre. Quem chega por URL
 * salva, por aviso ou por aba aberta precisa ouvir "isto não é seu", e não
 * ver caixa vazia: era exatamente o que a tela única fazia com quem alcançava
 * um dos três alcances e não os outros dois.
 */
export function ProgressionCriteriaRefusal({
  slice,
  title,
  reason,
  hint,
}: {
  slice: FatiaDosCriterios;
  title: string;
  reason: string;
  hint: string;
}) {
  const help = usePageHelp(slice);
  return <OutOfReachScreen title={title} help={help} reason={reason} hint={hint} />;
}
