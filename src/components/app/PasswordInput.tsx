import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * O campo de senha com mostrar/ocultar acessível: o botão tem nome ("Mostrar
 * senha"/"Ocultar senha"), estado (`aria-pressed`) e responde ao teclado por
 * ser um botão de verdade. Serve ao login e à senha temporária do primeiro
 * acesso — duas telas, um campo (regra de reuso).
 */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<typeof Input>, "type">) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-10", className)} />
      <button
        type="button"
        aria-label={visible ? t("password.hide") : t("password.show")}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 flex min-h-8 w-10 cursor-pointer items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:focus-ring"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
