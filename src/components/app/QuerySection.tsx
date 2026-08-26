import type { ReactNode } from "react";

import { SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

/**
 * OO3-18/F-2 — bloco loading/erro de seção alimentada por `useQuery`,
 * unificado: os dois clones de `assessments-shared.tsx` (portfólio e
 * development-summary) e os dois tratamentos divergentes (`users.tsx`,
 * `architects.$architectId.evolution.tsx`) resolviam o mesmo problema de 3
 * maneiras — e os dois últimos SEM retry e SEM ARIA. Aqui o esqueleto é um
 * só: pendente = skeleton com `aria-busy`/`aria-live` + texto sr-only;
 * erro = `role="alert"` + botão "Tentar novamente" que refaz a consulta.
 *
 * Composição, não um componente monolítico (mesma filosofia declarada em
 * `DataView.tsx`): a FORMA do skeleton, a mensagem de erro e o conteúdo de
 * sucesso vêm do call site. Com `title`, pendente/erro rendem dentro de um
 * `SectionCard`; sem `title`, rendem crus (caso de `evolution.tsx`, cujos
 * estados vivem fora de card). O sucesso é sempre `children(data)` verbatim
 * — telas cujo conteúdo já traz o próprio card não ganham card duplicado.
 *
 * Fora daqui, de propósito: `store.tsx` (`ConnectionError`/`LoadingState`)
 * é o caso global de tela cheia — outra escala, ver SPEC-OO3-18 §3.3.
 */
export interface QuerySectionQuery<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  refetch: () => unknown;
}

export function QuerySection<T>({
  query,
  title,
  description,
  className,
  skeleton,
  errorMessage,
  isEmpty,
  children,
}: {
  /** O retorno de `useQuery` (ou um recorte estrutural dele — ex.: `isLoading` no lugar de `isPending`). */
  query: QuerySectionQuery<T>;
  /** Com `title`, pendente/erro rendem num `SectionCard`; sem, rendem crus. */
  title?: string;
  description?: string;
  /** Repassado ao `SectionCard` dos estados pendente/erro. */
  className?: string;
  /** A forma de esqueleto específica da seção (barras, blocos, texto). */
  skeleton: ReactNode;
  /** Mensagem já traduzida do estado de erro. */
  errorMessage: string;
  /** Dado presente mas fora do formato esperado conta como erro (ex.: `{}` de mock genérico). */
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}) {
  const { t } = useI18n();

  const wrap = (content: ReactNode) =>
    title !== undefined ? (
      <SectionCard
        title={title}
        {...(className !== undefined ? { className } : {})}
        {...(description !== undefined ? { description } : {})}
      >
        {content}
      </SectionCard>
    ) : (
      <>{content}</>
    );

  if (query.isPending) {
    return wrap(
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">{t("common.loading")}</span>
        {skeleton}
      </div>,
    );
  }

  const data = query.data;
  if (query.isError || data === undefined || (isEmpty ? isEmpty(data) : false)) {
    return wrap(
      <>
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => void query.refetch()}>
          {t("common.retry")}
        </Button>
      </>,
    );
  }

  return <>{children(data)}</>;
}
