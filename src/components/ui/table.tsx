import { createContext, useContext, type ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

/**
 * A tabela da casa (revisão mestre 2026-09-08, [F-05]): 18 `<table>` cruas
 * repetiam o mesmo cabeçalho 14 vezes, com `py-2` numa tela e `py-3` na
 * outra. Aqui a linha tem altura por densidade (`data-density` na tabela:
 * `compact` 44 px, `comfortable` 52 px), o cabeçalho é o `eyebrow` da escala,
 * a célula numérica alinha à direita em tabular (`Td numeric`) e o hover da
 * linha lê o token `--surface-hover`. O `SortableHeader` compõe `Th`.
 */
export type TableDensity = "compact" | "comfortable";

const ROW_HEIGHT: Record<TableDensity, string> = {
  compact: "h-11",
  comfortable: "h-13",
};

const DensityContext = createContext<TableDensity>("comfortable");
const SectionContext = createContext<"head" | "body">("body");

export function Table({
  density = "comfortable",
  className,
  ...props
}: ComponentPropsWithoutRef<"table"> & { density?: TableDensity }) {
  return (
    <DensityContext.Provider value={density}>
      <div className="scroll-visible w-full overflow-x-auto">
        <table
          data-density={density}
          className={cn("w-full border-collapse text-table", className)}
          {...props}
        />
      </div>
    </DensityContext.Provider>
  );
}

export function THead({ className, ...props }: ComponentPropsWithoutRef<"thead">) {
  return (
    <SectionContext.Provider value="head">
      <thead className={cn("text-left", className)} {...props} />
    </SectionContext.Provider>
  );
}

export function TBody({ className, ...props }: ComponentPropsWithoutRef<"tbody">) {
  return (
    <SectionContext.Provider value="body">
      <tbody className={className} {...props} />
    </SectionContext.Provider>
  );
}

export function Tr({
  interactive = false,
  className,
  ...props
}: ComponentPropsWithoutRef<"tr"> & { interactive?: boolean }) {
  const density = useContext(DensityContext);
  const section = useContext(SectionContext);
  return (
    <tr
      className={cn(
        section === "head"
          ? "border-b border-border"
          : cn(
              ROW_HEIGHT[density],
              "border-b border-border-subtle transition-fast last:border-0 hover:bg-(--surface-hover)",
              interactive && "cursor-pointer",
            ),
        className,
      )}
      {...props}
    />
  );
}

export type CellAlign = "left" | "center" | "right";

const ALIGN_CLASS: Record<CellAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export function Th({
  align = "left",
  numeric = false,
  className,
  ...props
}: ComponentPropsWithoutRef<"th"> & { align?: CellAlign; numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "eyebrow h-11 px-3 align-middle whitespace-nowrap",
        ALIGN_CLASS[numeric ? "right" : align],
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  align = "left",
  numeric = false,
  className,
  ...props
}: ComponentPropsWithoutRef<"td"> & { align?: CellAlign; numeric?: boolean }) {
  return (
    <td
      className={cn(
        "px-3 py-2 align-middle",
        ALIGN_CLASS[numeric ? "right" : align],
        numeric && "tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

export function TCaption({ className, ...props }: ComponentPropsWithoutRef<"caption">) {
  return (
    <caption
      className={cn("mt-2 caption-bottom text-left text-label text-muted-foreground", className)}
      {...props}
    />
  );
}
