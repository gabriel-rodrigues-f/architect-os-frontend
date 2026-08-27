import type { ReactNode } from "react";

import { SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

interface QuerySectionQuery<T> {
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
  query: QuerySectionQuery<T>;

  title?: string;
  description?: string;

  className?: string;

  skeleton: ReactNode;

  errorMessage: string;

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
