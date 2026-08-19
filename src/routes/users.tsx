import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader, SectionCard } from "@/components/app/ui-bits";
import { authApi, ApiError, isLeadCapable, type SessionUser, type UserRole } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "Usuários — Synapse" },
      {
        name: "description",
        content: "Contas de acesso: papel (administrador, Tech Lead, membro) e vínculo com o time.",
      },
      { property: "og:title", content: "Usuários — Synapse" },
      {
        property: "og:description",
        content:
          "Quem administra o sistema, quem revisa como Tech Lead, e a quem cada conta pertence.",
      },
    ],
  }),
  component: UsersPage,
});

const USERS_QUERY_KEY = ["auth-users"] as const;

function UsersPage() {
  const { t } = useI18n();
  const store = useStore();
  const isAdmin = useCurrentUser().role === "admin";
  const queryClient = useQueryClient();
  /**
   * `GET /api/auth/users` é admin-only no backend (diretório completo de
   * contas é dado administrativo, não catálogo público) — a query nem
   * dispara para quem não é admin, senão a tela mostraria um erro genérico
   * de rede em vez de deixar claro que é uma tela restrita. Ver AUDITORIA-
   * QUARTA-REVISAO-ESTADO-ATUAL-SYNAPSE.md, EPIC 0.
   */
  const { data, isPending, isError } = useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: authApi.users,
    staleTime: 30_000,
    enabled: isAdmin,
  });

  const updatePatch = async (
    user: SessionUser,
    patch: Partial<{ role: UserRole; architectId: string | null }>,
  ) => {
    try {
      await authApi.updateUser(user.id, patch);
      await queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      toast.success(t("users.toast.updated", { nome: user.name }));
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Não foi possível salvar a alteração.";
      toast.error(message);
    }
  };

  return (
    <>
      <PageHeader title={t("users.title")} description={t("users.subtitle")} />

      <SectionCard title={t("users.list.title")} description={t("users.list.subtitle")}>
        {!isAdmin && <p className="text-sm text-muted-foreground">{t("users.adminOnly")}</p>}
        {isAdmin && isPending && (
          <p className="text-sm text-muted-foreground">{t("users.loading")}</p>
        )}
        {isAdmin && isError && <p className="text-sm text-destructive">{t("users.error.load")}</p>}
        {data && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2">{t("users.col.name")}</th>
                  <th className="py-2">{t("users.col.email")}</th>
                  <th className="py-2">{t("users.col.role")}</th>
                  <th className="py-2">{t("users.col.architect")}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((user) => (
                  <tr key={user.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 font-medium">{user.name}</td>
                    <td className="py-2 text-muted-foreground">{user.email}</td>
                    <td className="py-2">
                      {isAdmin ? (
                        <select
                          className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
                          value={user.role}
                          aria-label={`${t("users.col.role")} — ${user.name}`}
                          onChange={(e) =>
                            void updatePatch(user, { role: e.target.value as UserRole })
                          }
                        >
                          <option value="member">{t("users.role.member")}</option>
                          <option value="lead">{t("users.role.lead")}</option>
                          <option value="admin">{t("users.role.admin")}</option>
                        </select>
                      ) : (
                        <RoleBadge role={user.role} label={t(`users.role.${user.role}`)} />
                      )}
                    </td>
                    <td className="py-2">
                      {isAdmin ? (
                        <select
                          className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
                          value={user.architectId ?? ""}
                          aria-label={`${t("users.col.architect")} — ${user.name}`}
                          onChange={(e) =>
                            void updatePatch(user, { architectId: e.target.value || null })
                          }
                        >
                          <option value="">{t("users.architect.none")}</option>
                          {store.architects.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-muted-foreground">
                          {store.architects.find((a) => a.id === user.architectId)?.name ??
                            t("users.architect.none")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}

function RoleBadge({ role, label }: { role: UserRole; label: string }) {
  const tone =
    role === "admin" ? "bg-level-5/60" : isLeadCapable(role) ? "bg-level-3/60" : "bg-secondary";
  return <span className={`rounded-md px-2 py-0.5 text-xs ${tone}`}>{label}</span>;
}
