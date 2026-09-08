import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { PageAction, PageActionRank } from "@/components/app/PageAction";
import { EmptyState } from "@/components/app/ui-bits";
import { useOptionalUser } from "@/lib/auth";
import type { EmptySubject } from "@/lib/empty-subject";
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
 * DUAS LINHAS, SEMPRE (dono, 2026-09-08, item 3). A linha 1 é o título e vem
 * do `EmptySubject` — nenhuma tela a escreve, e por isso nenhuma escreve
 * "Não há…" nem "…disponível". A linha 2 é a regra de negócio DAQUELA tela e
 * é obrigatória no tipo: o estado vazio de uma linha só (a Calibração era
 * assim) não compila mais.
 *
 * Doze telas usam este bloco, e nenhuma repete régua: o RÓTULO do botão, a
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
  subject,
  hint,
  registrations = [],
  children,
}: {
  /**
   * O ASSUNTO que ainda não tem nenhum. A LINHA 1 vem dele, no formato único
   * — a tela não a escreve, e por isso não pode escrevê-la diferente.
   */
  subject: EmptySubject;
  /**
   * A LINHA 2, a regra de negócio DESTA tela. É obrigatória: um estado vazio
   * de uma linha só (a Calibração era assim) deixa de compilar.
   */
  hint: ReactNode;
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
      title={subject.title(t)}
      hint={hint}
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
