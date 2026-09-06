import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth";
import { DailyGreeting } from "@/lib/greeting/daily-greeting";
import { useI18n } from "@/lib/i18n";

/**
 * A saudação do primeiro acesso do dia (dono, 2026-09-06): canto superior
 * direito, três segundos, com um "x" para fechar antes. Uma por perfil.
 */
export function DailyGreetingToast() {
  // A casca ainda desenha por um instante depois do logout: sem sessão, nada a saudar.
  const { user } = useAuth();
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user || !DailyGreeting.isDueFor(user)) return;
    DailyGreeting.markShown(user);
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), DailyGreeting.VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [user]);

  if (!visible || !user) return null;
  const nome = DailyGreeting.firstNameOf(user.name);
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="daily-greeting"
      className="fixed right-4 top-16 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card p-4 pr-10 text-sm text-card-foreground shadow-lg"
    >
      <p className="font-medium">{t("greeting.hello", { nome })}</p>
      <p className="mt-1 text-muted-foreground">{t(DailyGreeting.messageKeyFor(user.role))}</p>
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
