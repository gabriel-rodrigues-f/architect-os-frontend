import { useRef, useState, type CSSProperties, type FocusEvent, type ReactNode } from "react";

import { BrandLockup } from "@/components/app/BrandLockup";
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
 * inteira; com o refino de 2026-09-07 ela ganhou estrutura. O dono: "a
 * distância entre branding e forms e o fato de estarem nas extremidades me
 * incomoda". A resposta é composição, não redesenho:
 *
 *   - a rede continua na viewport inteira (é irmã do container, não filha);
 *   - o conteúdo vive num container central (`auth-stage`: largura com
 *     respiro lateral por clamp, máximo de 1320 px, margem automática);
 *   - dentro dele, um grid (`auth-grid`) de duas colunas com gap limitado —
 *     em 1920 e 2560 os blocos não vão para os cantos, e a distância entre
 *     eles para de crescer; abaixo de 768 é uma coluna: marca, frase, login;
 *   - o centro visual fica um pouco acima do meio (o respiro de baixo é
 *     maior do que o de cima). Nada de `justify-content: space-between` na
 *     viewport, nada de posição absoluta, translate ou margem negativa.
 *
 * A rede recebe a zona de composição — os retângulos da marca (`brandRef`) e
 * do cartão (`cardRef`) — e concentra os nós entre os dois blocos, costurando
 * os lados (`CompositionZone`).
 *
 * A composição é sempre escura (`dark`), qualquer que seja o tema do resto
 * da aplicação: o fundo azul-escuro é a assinatura, e a rede lê as cores dos
 * tokens do próprio elemento — por isso recebe as do escuro. Dentro do
 * container, porém, o primário volta a ser o azul da identidade (o escuro
 * tem primário quase branco): o CTA é azul, e a rede fica com o branco.
 *
 * Ela não sabe de sessão de propósito. `SetPasswordScreen` é alcançada SEM
 * sessão — escapa do `AuthGate` do `__root` —, então a casca não pode
 * depender de nada que só exista do lado autenticado.
 *
 * Os `signals` são o canal da tela para a rede (foco no cartão acende os nós
 * próximos; Entrar dispara um pulso) e da rede para a marca (o pulso
 * coletivo faz o lockup piscar — `BrandLockup`). Quem não os passa recebe
 * uns próprios.
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
  const brandRef = useRef<HTMLDivElement>(null);

  const onCardFocus = () => network.emphasize(true);
  const onCardBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!cardRef.current?.contains(event.relatedTarget)) network.emphasize(false);
  };

  return (
    <div className="dark relative min-h-screen overflow-hidden bg-background text-foreground">
      <SynapseBackground signals={network} focalRef={cardRef} brandRef={brandRef} />

      <div data-testid="auth-stage" className="auth-stage">
        <div data-testid="auth-grid" className="auth-grid">
          <section
            aria-label="Synapse"
            className="auth-rise flex flex-col justify-center"
            style={{ "--auth-delay": "120ms" } as CSSProperties}
          >
            {/* A medida da marca é o bloco de texto (w-fit), não a coluna inteira: o vão real começa onde o texto acaba. */}
            <div ref={brandRef} className="w-fit">
              <BrandLockup signals={network} descriptor={t("login.subtitle")} />
            </div>
          </section>

          <div
            ref={cardRef}
            onFocus={onCardFocus}
            onBlur={onCardBlur}
            data-testid="auth-card"
            className="auth-rise auth-card justify-self-center md:justify-self-start"
            style={{ "--auth-delay": "220ms" } as CSSProperties}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
