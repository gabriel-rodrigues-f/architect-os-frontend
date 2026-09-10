import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * AS ABAS DE DENTRO DE UMA TELA — as que trocam o corpo sem trocar de rota.
 *
 * Não confundir com as abas da FICHA (`ProfileTabs`), que são LINKS: lá cada
 * aba é um endereço, tem guarda própria e entra no histórico do navegador.
 * Aqui a tela é uma só e o que muda é a seção à vista.
 *
 * Nasceu de duas ocorrências, que é a régua de reuso da casa: a Evolução da
 * ficha (Resumo · Competências) desenhava a tira à mão desde a onda dela, e
 * Minha Conta (Perfil · Segurança · Preferências) seria a segunda cópia das
 * mesmas quinze classes e do mesmo par `role="tab"`/`role="tabpanel"`. Duas
 * cópias de uma régua de acessibilidade divergem — e quem paga é quem navega
 * por teclado.
 *
 * O que ele sabe, e que cada tela deixaria escapar sozinha:
 *
 *  - **A ligação entre a aba e o painel.** O `role="tabpanel"` não tem nome
 *    próprio: quem o nomeia é o `aria-labelledby` apontando para a aba. Sem
 *    isso, quem ouve a tela troca de aba e cai num painel anônimo. Os dois
 *    identificadores saem do mesmo prefixo, então não há como um sair sem o
 *    outro ({@link TabIdentifiers}).
 *  - **O painel escondido some de verdade.** `hidden` tira o conteúdo da
 *    ordem de foco; deixar as três seções montadas e só invisíveis poria
 *    campos alcançáveis por Tab dentro de uma aba fechada.
 *  - **A cor é do token, e a classe é literal.** Tailwind v4 só compila o que
 *    enxerga inteiro no fonte — nada aqui é montado por template.
 */
export interface TabChoice<Id extends string> {
  readonly id: Id;
  readonly label: string;
}

/*
 * POR QUE ESTA CLASSE NÃO PASSA POR `cn`.
 *
 * `cn` é `twMerge(clsx(...))`, e o `tailwind-merge` não conhece a escala da
 * casa: ele lê `text-body` como classe de COR (o grupo de `text-foreground`),
 * não de tamanho. Numa mesma chamada, a cor condicional que vem depois vence e
 * o TAMANHO some — medido: `cn("text-body font-medium", "text-foreground")`
 * devolve `font-medium text-foreground`. Com as medidas do próprio framework
 * isso não acontece — essas o `tailwind-merge` reconhece como tamanho —, mas
 * elas são justamente o que a catraca [T-01] tira das telas.
 *
 * Aqui não há nada a mesclar — a lista é decidida inteira neste arquivo, e
 * ninguém sobrescreve de fora —, então a composição é literal e o token
 * sobrevive. O defeito de fundo é maior que esta fatia (79 usos dos tokens da
 * casa em `src/`, vários no mesmo formato) e está no relatório: quem conserta
 * de vez é a configuração do `tailwind-merge` em `lib/utils.ts`, numa fatia
 * que possa medir o efeito nas telas que hoje perdem o tamanho em silêncio.
 */
export function TabStrip<Id extends string>({
  label,
  idPrefix,
  tabs,
  active,
  onChoose,
  className,
}: {
  /** O que este conjunto de abas escolhe, para quem navega por teclado. */
  label: string;
  /** O prefixo dos identificadores — o mesmo que os painéis usam. */
  idPrefix: string;
  tabs: readonly TabChoice<Id>[];
  active: Id;
  onChoose: (id: Id) => void;
  className?: string;
}) {
  const identifiers = new TabIdentifiers(idPrefix);
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("mb-6 flex gap-1 border-b border-border", className)}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={identifiers.tab(tab.id)}
          aria-selected={active === tab.id}
          aria-controls={identifiers.panel(tab.id)}
          onClick={() => onChoose(tab.id)}
          className={`-mb-px border-b-2 px-3 py-2 text-body font-medium transition-base ${
            active === tab.id
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** O que um painel de aba veste para ser encontrado e nomeado pela aba que o abre. */
export interface TabPanelAttributes {
  readonly role: "tabpanel";
  readonly id: string;
  readonly "aria-labelledby": string;
  readonly hidden: boolean;
  readonly tabIndex: number;
}

/**
 * OS IDENTIFICADORES DE UM CONJUNTO DE ABAS — a aba e o painel, do mesmo
 * prefixo, para que não exista um sem o outro.
 *
 * É classe, e não três funções soltas no módulo, porque a casa lê categoria
 * antes de nome (`idioma-por-categoria`): o par `tab`/`tabpanel` é UM conceito
 * com uma regra — o painel se chama pela aba —, e três funções ao lado uma da
 * outra deixam essa regra implícita no chamador.
 */
export class TabIdentifiers {
  constructor(readonly prefix: string) {}

  tab(id: string): string {
    return `${this.prefix}-tab-${id}`;
  }

  panel(id: string): string {
    return `${this.prefix}-panel-${id}`;
  }

  /**
   * O painel de UMA aba, nomeado pela aba que o abre. Devolve atributos e não
   * um componente para que a tela continue dona do próprio corpo — ela espalha
   * o resultado na `<div>` que já ia escrever, sem mais um nível de caixa.
   *
   * `hidden` tira o painel fechado da ordem de foco; `tabIndex` põe o aberto
   * nela, senão ler o conteúdo depois de escolher a aba exigiria mouse.
   */
  panelAttributes<Id extends string>(id: Id, active: Id): TabPanelAttributes {
    return {
      role: "tabpanel",
      id: this.panel(id),
      "aria-labelledby": this.tab(id),
      hidden: active !== id,
      tabIndex: 0,
    };
  }
}

/** O corpo de uma aba, já com o painel nomeado — açúcar para quem não precisa da `<div>` própria. */
export function TabPanel<Id extends string>({
  idPrefix,
  id,
  active,
  className,
  children,
}: {
  idPrefix: string;
  id: Id;
  active: Id;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      {...new TabIdentifiers(idPrefix).panelAttributes(id, active)}
      className={cn("focus-visible:focus-ring", className)}
    >
      {children}
    </div>
  );
}
