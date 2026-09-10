import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { NOTICES_QUERY_KEY } from "@/hooks";
import { noticesApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { WelcomeGreeting } from "@/lib/greeting/welcome-greeting";
import { useI18n } from "@/lib/i18n";
import { defaultNoticePhrase } from "@/lib/notice-phrase";

/**
 * O BRINDE DA SAUDAÇÃO — canto superior direito, três segundos, com um "x"
 * para fechar antes (dono, 2026-09-06); agora mostrado no primeiro acesso, e
 * não todo dia (dono, 2026-09-08).
 *
 * A verdade é do SERVIDOR: o toast só aparece se existe, na caixa de quem
 * entrou, um aviso `welcome.first-access` por ler. Fechar o toast NÃO marca
 * nada — o aviso continua no sininho, para a pessoa ler e marcar como
 * qualquer outro. Era exatamente isso que faltava: *"depois que ela fecha não
 * consigo vê-la na lista"*.
 *
 * A consulta é travada por duas portas para não virar um pedido a mais em toda
 * abertura da aplicação: ela só roda se este navegador ainda não piscou o
 * brinde para esta conta, e não se atualiza sozinha. Depois do primeiro acesso
 * de cada pessoa, o custo desta tela é zero.
 */
export function WelcomeNoticeToast() {
  // A casca ainda desenha por um instante depois do logout: sem sessão, nada a saudar.
  const { user } = useAuth();
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const relogio = useRef<number | undefined>(undefined);

  const porPiscar = user !== null && user !== undefined && WelcomeGreeting.isDueFor(user);

  const caixa = useQuery({
    queryKey: [...NOTICES_QUERY_KEY, "welcome"],
    queryFn: () => noticesApi.notices({ status: "unread" }),
    enabled: porPiscar,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });

  const saudacao = caixa.data?.notices.find(
    (notice) => notice.eventType === WelcomeGreeting.EVENT_TYPE,
  );

  useEffect(() => () => window.clearTimeout(relogio.current), []);

  /**
   * O `id` do aviso é a dependência, e não o objeto: o objeto muda de
   * identidade a cada releitura da caixa, e o brinde piscaria de novo. A marca
   * do navegador é gravada AQUI, no instante em que ele aparece — quem fecha
   * antes dos três segundos já foi saudado.
   */
  useEffect(() => {
    if (!user || saudacao === undefined || !WelcomeGreeting.isDueFor(user)) return;
    WelcomeGreeting.markShown(user);
    setVisible(true);
    relogio.current = window.setTimeout(() => setVisible(false), WelcomeGreeting.VISIBLE_MS);
  }, [user, saudacao?.id]);

  if (!visible || !user || saudacao === undefined) return null;
  const nome = WelcomeGreeting.firstNameOf(user.name);
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="welcome-notice"
      className="fixed right-4 top-16 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card p-4 pr-10 text-sm text-card-foreground shadow-lg"
    >
      <p className="font-medium">{defaultNoticePhrase.of(saudacao, t)}</p>
      <p className="mt-1">{t("greeting.hello", { nome })}</p>
      <p className="mt-1 text-muted-foreground">{t(WelcomeGreeting.messageKeyFor(user.role))}</p>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label={t("greeting.close")}
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
