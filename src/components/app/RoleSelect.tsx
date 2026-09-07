import { Label } from "@/components/ui/label";
import type { UserRole } from "@/lib/api";
import { UserRoles } from "@/lib/gateways/auth.gateway";
import { useI18n } from "@/lib/i18n";

/**
 * O seletor oferece só os papéis que quem está logado pode ATRIBUIR
 * (`UiAuthorizationPolicy.assignableRoles`): o suporte não vê `admin`.
 */
export function RoleSelect({
  id,
  value,
  offered,
  onChange,
}: {
  id: string;
  value: UserRole;
  offered: readonly UserRole[];
  onChange: (role: UserRole) => void;
}) {
  const { t } = useI18n();

  const choose = (chosen: string) => {
    if (UserRoles.includes(chosen)) onChange(chosen);
  };

  return (
    <div>
      <Label htmlFor={id}>{t("users.col.role")}</Label>
      <select
        id={id}
        className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
        value={value}
        onChange={(event) => choose(event.target.value)}
      >
        {offered.map((role) => (
          <option key={role} value={role}>
            {t(`users.role.${role}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
