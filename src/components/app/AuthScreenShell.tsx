import { useRef, useState, type CSSProperties, type FocusEvent, type ReactNode } from "react";

import { SynapseBackground } from "@/components/app/SynapseBackground";
import { useI18n } from "@/lib/i18n";
import { SynapseSignals } from "@/lib/synapse-network";

/**
 * A CASCA DAS TELAS DE PORTA — a rede de sinapses ao fundo, a marca em
 * hierarquia e o cartão em volta do formulário.
 *
 * Ela já existia três vezes copiada: `LoginScreen`, `FirstAccessScreen` e
 * `SetPasswordScreen`. Regra da casa: o que serve a 2 lugares vira componente.
 * Com o login "Synapse Network" (direção 2026-09-06) ela virou a composição
 * inteira: desktop ~55/45 com a marca à esquerda e o cartão à direita; mobile
 * empilhado, com o cartão logo abaixo da marca compacta.
 *
 * A composição é sempre escura (`dark`), qualquer que seja o tema do resto
 * da aplicação: o fundo azul-escuro é a assinatura, e a rede lê as cores dos
 * tokens do próprio elemento — por isso recebe as do escuro.
 *
 * Ela não sabe de sessão de propósito. `SetPasswordScreen` é alcançada SEM
 * sessão — escapa do `AuthGate` do `__root` —, então a casca não pode
 * depender de nada que só exista do lado autenticado.
 *
 * Os `signals` são o canal da tela para a rede (foco no cartão acende os nós
 * próximos; Entrar dispara um pulso). Quem não os passa recebe uns próprios.
 */
export function AuthScreenShell({
  children,
  signals,
}: {
  children: ReactNode;
  signals?: SynapseSignals;
}) {
  const { t } = useI18n();
  const [ownSignals] = useState(() => new SynapseSignals());
  const network = signals ?? ownSignals;
  const cardRef = useRef<HTMLDivElement>(null);

  const onCardFocus = () => network.emphasize(true);
  const onCardBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!cardRef.current?.contains(event.relatedTarget)) network.emphasize(false);
  };

  return (
    <div className="dark relative min-h-screen overflow-hidden bg-background text-foreground">
      <SynapseBackground signals={network} focalRef={cardRef} />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1400px] flex-col gap-8 px-6 py-10 sm:px-10 lg:flex-row lg:items-center lg:gap-12 lg:px-16">
        <section
          aria-label="Synapse"
          className="auth-rise flex flex-col justify-center lg:basis-[55%]"
          style={{ "--auth-delay": "120ms" } as CSSProperties}
        >
          <p className="font-display text-3xl font-semibold uppercase tracking-[0.28em] text-foreground sm:text-4xl lg:text-5xl">
            Synapse
          </p>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground sm:text-base sm:tracking-[0.16em]">
            {t("login.subtitle")}
          </p>
          <p className="mt-6 hidden max-w-md text-balance text-lg leading-relaxed text-foreground/80 sm:block lg:text-xl">
            {t("login.brand.phrase")}
          </p>
        </section>

        <div className="flex justify-center lg:basis-[45%] lg:justify-end">
          <div
            ref={cardRef}
            onFocus={onCardFocus}
            onBlur={onCardBlur}
            data-testid="auth-card"
            className="auth-rise auth-card w-full max-w-[440px] p-8 sm:p-10"
            style={{ "--auth-delay": "220ms" } as CSSProperties}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
