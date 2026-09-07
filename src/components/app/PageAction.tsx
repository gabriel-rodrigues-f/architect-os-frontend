import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  type ComponentPropsWithRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { Plus } from "lucide-react";

import { Button, type ButtonVariant } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Dono (2026-09-08), literal: *"o botão 'Nova trilha' em Trilhas de
 * Aprendizagem tem a mesma identidade visual de 'Ciclos de Avaliação > Novo
 * ciclo' e 'Catálogo de Competências > Nova capacidade'. Mas 'Estrutura de
 * Times > Criar time' e 'Contas e Acessos > Cadastrar pessoas' não seguem o
 * mesmo padrão. Normalize aplicando orientação a objeto e reaproveitando
 * componentes."*
 *
 * A régua da ação de cabeçalho vive AQUI, num objeto com três instâncias — e
 * não numa pilha de props soltas espalhada por vinte telas:
 *
 *   - `main`: a ação principal da página. Primary, altura do controle, ícone
 *     de somar, à direita do `PageHeader`. É uma por tela.
 *   - `supporting`: a que corre ao lado dela (importar, por exemplo).
 *     Secondary, MESMA altura — o que muda é a tinta, não o tamanho.
 *   - `section`: a ação de cabeçalho de seção (`SectionCard actions`).
 *     Secondary e menor, porque a seção é menor que a página.
 *
 * Quem escreve tela escolhe o PAPEL; variante, tamanho e ícone padrão vêm
 * daqui. A catraca `acao-de-pagina-por-componente` guarda a porta.
 */
export type PageActionRankName = "main" | "supporting" | "section";

/** O ícone de uma ação — a assinatura dos ícones lucide, como no `Callout`. */
type ActionIcon = typeof Plus;

export class PageActionRank {
  static readonly MAIN = new PageActionRank("main", "primary", "default");
  static readonly SUPPORTING = new PageActionRank("supporting", "secondary", "default");
  static readonly SECTION = new PageActionRank("section", "secondary", "sm");

  private constructor(
    readonly name: PageActionRankName,
    readonly variant: ButtonVariant,
    readonly size: "default" | "sm",
  ) {}

  static of(name: PageActionRankName): PageActionRank {
    return {
      main: PageActionRank.MAIN,
      supporting: PageActionRank.SUPPORTING,
      section: PageActionRank.SECTION,
    }[name];
  }

  /** A fila de ações do cabeçalho: uma linha, um respiro só, sempre a mesma. */
  static readonly rowClass = "flex flex-wrap items-center gap-2";
}

/**
 * O papel que o GRUPO empresta a quem está dentro dele. Fora de `PageActions`,
 * uma ação de página é a principal — a tela que só tem uma, tem a principal.
 */
const PageActionRankContext = createContext<PageActionRank>(PageActionRank.MAIN);

export type PageActionProps = Omit<ComponentPropsWithRef<"button">, "children"> & {
  /** O rótulo na tela — e o nome acessível da ação. */
  label: string;
  /** O ícone do ato; `null` para a ação que não pede ícone nenhum. */
  icon?: ActionIcon | null;
  /** O papel declarado vence o que o grupo empresta. */
  rank?: PageActionRankName;
  /** Veste o elemento de quem chama (um `Link`) com a identidade da ação. */
  asChild?: boolean;
  children?: ReactElement;
};

/**
 * A ação principal do cabeçalho de página. Serve de gatilho de diálogo sem
 * invólucro nenhum — `<DialogTrigger asChild><PageAction … /></DialogTrigger>`
 * —, porque as props (e o `ref`) do gatilho descem inteiras para o botão.
 */
export function PageAction({
  label,
  icon,
  rank,
  asChild = false,
  className,
  children,
  ...rest
}: PageActionProps) {
  const doGrupo = useContext(PageActionRankContext);
  const regua = rank === undefined ? doGrupo : PageActionRank.of(rank);
  const Icone = icon === null ? null : (icon ?? Plus);
  const conteudo = (
    <>
      {Icone && <Icone aria-hidden="true" />}
      {label}
    </>
  );
  return (
    <Button
      data-page-action={regua.name}
      variant={regua.variant}
      size={regua.size}
      asChild={asChild}
      className={className}
      {...rest}
    >
      {asChild && isValidElement(children) ? cloneElement(children, undefined, conteudo) : conteudo}
    </Button>
  );
}

/**
 * O grupo de ações do cabeçalho, quando há mais de uma: a ÚLTIMA é a
 * principal (é a que fica à direita, no fim da linha) e as outras são de
 * apoio. Quem não é ação de página — um seletor de pessoa, um filtro —
 * atravessa o grupo intacto, porque só quem lê o papel o recebe.
 */
export function PageActions({ children, className }: { children: ReactNode; className?: string }) {
  const itens = Children.toArray(children);
  const ultimo = itens.length - 1;
  return (
    <div className={cn(PageActionRank.rowClass, className)}>
      {itens.map((item, indice) => (
        <PageActionRankContext.Provider
          key={isValidElement(item) ? (item.key ?? indice) : indice}
          value={indice === ultimo ? PageActionRank.MAIN : PageActionRank.SUPPORTING}
        >
          {item}
        </PageActionRankContext.Provider>
      ))}
    </div>
  );
}

export type SectionActionProps = Omit<PageActionProps, "rank">;

/**
 * A ação de cabeçalho de SEÇÃO — a mesma identidade da página, um degrau
 * abaixo. Também é o papel da ação que já mora no corpo da tela e continua
 * lá: o que se normaliza é a aparência, não o lugar.
 */
export function SectionAction(props: SectionActionProps) {
  return <PageAction {...props} rank="section" />;
}
