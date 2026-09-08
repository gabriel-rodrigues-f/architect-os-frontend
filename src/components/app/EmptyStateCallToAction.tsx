import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { PageAction, PageActionRank } from "@/components/app/PageAction";
import { EmptyState } from "@/components/app/ui-bits";
import { useOptionalUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { Registration } from "@/lib/registration";
import { cn } from "@/lib/utils";

/**
 * O BOTÃO DE CADASTRO NO CENTRO DO QUADRO PRINCIPAL.
 *
 * Dono (2026-09-08), literal: *"o usuário precisa ver, à primeira vista, o
 * botão de cadastro quando não há nada cadastrado. Ao invés de aparecer como
 * linha clicável no filtro, vamos bloquear o filtro e disponibilizamos o
 * botão de criação mais abaixo, dentro do quadro principal e centralizado na
 * tela."*
 *
 * Este é o outro lado da mesma fatia: o `EmptySelectionField` virou moldura
 * muda, e o convite passou a viver AQUI — a frase, uma linha curta de apoio e
 * o(s) botão(ões) de cadastro, centralizados, na variante primária.
 *
 * Onze telas usam este bloco, e nenhuma repete régua: o RÓTULO do botão, a
 * TELA de destino, o `search` que abre o formulário e a pergunta de ALCANCE
 * vêm do `Registration`. Quem não alcança o cadastro lê a frase e não recebe
 * botão nenhum — mandar alguém para uma porta fechada é pior do que não
 * oferecer porta.
 *
 * Quando o cadastro é um DIÁLOGO da própria tela (Trilhas, Ciclos, Catálogo),
 * não há para onde navegar: a tela passa a MESMA `PageAction` do canto como
 * filho, e o bloco só a hospeda. É uma ação só, em um lugar só de cada vez.
 */
export function EmptyStateCallToAction({
  title,
  hint,
  registrations = [],
  children,
}: {
  /** A frase do vazio, no vocabulário do domínio. */
  title: string;
  /** A linha curta de apoio — por que a tela está vazia, e o que a enche. */
  hint?: ReactNode;
  /** Os assuntos que faltam cadastrar, na ordem em que a tela os declara. */
  registrations?: readonly Registration[];
  /** A ação de cadastro que mora na própria tela (um diálogo), se houver. */
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const user = useOptionalUser();
  const alcancadas = registrations.filter((registration) => registration.reachedBy(user));
  const temAcao = alcancadas.length > 0 || children !== undefined;

  return (
    <EmptyState
      title={title}
      {...(hint !== undefined ? { hint } : {})}
      {...(temAcao
        ? {
            action: (
              <div className={cn("mt-4 justify-center", PageActionRank.rowClass)}>
                {alcancadas.map((registration) => (
                  <PageAction key={registration.subject} label={t(registration.ctaKey)} asChild>
                    <Link
                      to={registration.to}
                      {...(registration.search ? { search: registration.search } : {})}
                    />
                  </PageAction>
                ))}
                {children}
              </div>
            ),
          }
        : {})}
    />
  );
}
