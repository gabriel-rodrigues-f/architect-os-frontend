import { ChevronDown } from "lucide-react";
import { useRef, useState, type FocusEvent, type KeyboardEvent } from "react";

import { FilterTriggerButton } from "@/components/app/FilterTriggerButton";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface MultiSelectFilterOption {
  id: string;
  label: string;
  /**
   * R3-007 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — marca uma opção sintética
   * (ex.: "Sem especialização"/"Sem capacidade" em `team-shared.tsx`) que
   * existe só pra dar um id filtrável a quem não tem o campo real
   * preenchido. Continua uma opção de verdade, selecionável igual às outras
   * quando existem opções reais ao lado dela — o que muda é só o cálculo de
   * `isEmpty`: se ela for a ÚNICA entrada da lista, não há nada de fato pra
   * filtrar, e o campo deve se comportar como vazio (desabilitado, mensagem
   * de vazio), não como se houvesse uma escolha real disponível.
   */
  isPlaceholder?: boolean;
}

/**
 * Filtro por composição (caixinha), reutilizável para qualquer faceta de
 * pouca cardinalidade: marcar um valor, vários, ou "selecionar tudo" (mesmo
 * alternador de verdade do `ArchitectFilter` — tudo marcado → clique
 * desmarca tudo; nada ou parte marcada → clique marca tudo). `selected`
 * vazio é um estado real e explícito (filtra pra fora todo mundo), nunca um
 * atalho escondido para "sem filtro" — quem chama decide o valor inicial
 * (normalmente todas as opções, pra a tela nascer sem filtrar nada).
 *
 * Mesmo padrão de teclado do `ArchitectFilter` (Seção 80): seta para
 * navegar entre opções com wrap nas pontas, Home/End para os extremos,
 * Escape fecha e devolve o foco pro botão, Enter/Espaço funcionam nativos
 * porque cada opção já é um `<button>` de verdade.
 *
 * R2-VIS-09 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — o painel era um `<div
 * absolute>` de posição fixa, sem detecção de colisão: perto da borda da
 * viewport ele vazava para fora da tela. `Popover` do Radix (floating-ui por
 * baixo) resolve só o POSICIONAMENTO — a navegação por teclado continua toda
 * manual aqui, porque o Radix não sabe navegar entre `<button role="option">`
 * customizados; ele só reposiciona o painel. Abrir/fechar/clique fora e
 * Escape-padrão do Radix ficam redundantes com o que este componente já
 * fazia à mão, mas não conflitam: o handler manual de Escape chama
 * `preventDefault`, então o Radix respeita e não tenta fechar de novo.
 */
export function MultiSelectFilter({
  id,
  label,
  options,
  selected,
  onChange,
  selectAllLabel,
  allSummaryLabel,
  noneSummaryLabel,
  emptyLabel,
}: {
  id: string;
  label: string;
  options: MultiSelectFilterOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  selectAllLabel: string;
  allSummaryLabel: string;
  noneSummaryLabel: string;
  /**
   * R3-007 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — sem nenhuma opção real pra
   * filtrar (ex.: ninguém tem especialização cadastrada ainda), o campo
   * mostrava "Todos os registros"/"Sem especialização" como se houvesse algo
   * pra escolher — abrir o popover só revelava as duas opções vazias
   * ("Todas"/"Sem X"), nunca um item de verdade. Com zero opções o campo
   * agora fica desabilitado e mostra esta mensagem no lugar do resumo —
   * `t("filter.multi.empty")` genérico como default; cada chamador pode
   * passar um texto específico ("Nenhuma especialização cadastrada").
   */
  emptyLabel?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const optionCount = options.length + 1;
  /**
   * R3-007 — `options.length === 0` nunca disparava aqui: o array sempre
   * tinha pelo menos a opção-placeholder ("Sem especialização"/"Sem
   * capacidade") quando alguém no roster não tem o campo preenchido, então
   * o campo aparecia habilitado com uma "escolha" que não filtra nada de
   * verdade. Contar só as opções reais (`!o.isPlaceholder`) trata "só tem
   * placeholder" igual a "não tem nada": desabilitado, mensagem de vazio.
   */
  const isEmpty = options.filter((o) => !o.isPlaceholder).length === 0;

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const focusOption = (index: number) => {
    const clamped = (index + optionCount) % optionCount;
    optionRefs.current[clamped]?.focus();
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = optionRefs.current.findIndex((el) => el === document.activeElement);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusOption(currentIndex + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusOption(currentIndex - 1);
        break;
      case "Home":
        event.preventDefault();
        focusOption(0);
        break;
      case "End":
        event.preventDefault();
        focusOption(optionCount - 1);
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
    }
  };

  /** Tab sai do widget inteiro num passo só — fecha quando o foco sai do painel por completo. */
  const onListBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (isEmpty) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
    }
  };

  const toggle = (optionId: string) =>
    onChange(
      selected.includes(optionId)
        ? selected.filter((s) => s !== optionId)
        : [...selected, optionId],
    );

  const allSelected = options.length > 0 && selected.length === options.length;
  const summary =
    selected.length === 0
      ? noneSummaryLabel
      : allSelected
        ? allSummaryLabel
        : selected.length === 1
          ? (options.find((o) => o.id === selected[0])?.label ?? t("filter.multi.count", { n: 1 }))
          : t("filter.multi.count", { n: selected.length });

  return (
    <div>
      <label className="block text-sm text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <FilterTriggerButton
            id={id}
            ref={triggerRef}
            disabled={isEmpty}
            onKeyDown={onTriggerKeyDown}
            aria-expanded={open}
            aria-haspopup="listbox"
            title={isEmpty ? (emptyLabel ?? t("filter.multi.empty")) : summary}
          >
            <span className="min-w-0 flex-1 truncate text-left">
              {isEmpty ? (emptyLabel ?? t("filter.multi.empty")) : summary}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </FilterTriggerButton>
        </PopoverTrigger>
        <PopoverContent
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
          onKeyDown={onListKeyDown}
          onBlur={onListBlur}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            optionRefs.current[0]?.focus();
          }}
          align="start"
          className="w-56 max-h-72 overflow-y-auto p-1"
        >
          <button
            ref={(el) => {
              optionRefs.current[0] = el;
            }}
            type="button"
            onClick={() => onChange(allSelected ? [] : options.map((o) => o.id))}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
          >
            <Checkbox
              checked={allSelected ? true : selected.length === 0 ? false : "indeterminate"}
              aria-hidden="true"
              tabIndex={-1}
              className="pointer-events-none"
            />
            <span className="font-medium">{selectAllLabel}</span>
          </button>
          <div className="my-1 border-t border-border" />
          {options.map((option, index) => {
            const active = selected.includes(option.id);
            return (
              <button
                key={option.id}
                ref={(el) => {
                  optionRefs.current[index + 1] = el;
                }}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => toggle(option.id)}
                title={option.label}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none",
                  active && "font-medium",
                )}
              >
                <Checkbox
                  checked={active}
                  aria-hidden="true"
                  tabIndex={-1}
                  className="pointer-events-none"
                />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </button>
            );
          })}
          {options.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("filter.multi.empty")}</p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
