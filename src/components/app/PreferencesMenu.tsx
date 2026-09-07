import { Monitor, Moon, Settings, Sun } from "lucide-react";

import { SingleSelectFilter } from "@/components/app/SingleSelectFilter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const THEME_OPTIONS: { value: Theme; labelKey: MessageKey; icon: typeof Sun }[] = [
  { value: "light", labelKey: "prefs.theme.light", icon: Sun },
  { value: "dark", labelKey: "prefs.theme.dark", icon: Moon },
  { value: "system", labelKey: "prefs.theme.system", icon: Monitor },
];

/** Tema e idioma, no cabeçalho do shell — saiu do `AppShell` ([N-01]). */
export function PreferencesMenu() {
  const { theme, setTheme } = useTheme();
  const { locale, locales, loading, setLocale, t } = useI18n();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("prefs.title")}
          title={t("prefs.title")}
          className="rounded-md border border-input bg-card p-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Settings className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("prefs.theme")}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                aria-pressed={theme === option.value}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md border px-2 py-3 text-sm transition-colors",
                  theme === option.value
                    ? "border-primary bg-secondary font-medium text-foreground"
                    : "border-input text-muted-foreground hover:bg-secondary",
                )}
              >
                <option.icon className="size-4" />
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="locale"
            className="block text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {t("prefs.language")}
          </label>
          <SingleSelectFilter
            id="locale"
            ariaLabel={t("prefs.language")}
            value={locale}
            disabled={loading}
            onChange={setLocale}
            options={locales.map((known) => ({ value: known.code, label: known.label }))}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
