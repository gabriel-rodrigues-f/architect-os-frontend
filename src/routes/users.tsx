import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [creating, setCreating] = useState(false);
  /**
   * GET /api/auth/users é admin-only no backend (diretório completo de
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
    patch: Partial<{ role: UserRole; architectId: string | null; status: "active" | "disabled" }>,
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
      <PageHeader
        title={t("users.title")}
        description={t("users.subtitle")}
        actions={
          isAdmin && (
            <Button size="sm" onClick={() => setCreating(true)}>
              {t("users.create.action")}
            </Button>
          )
        }
      />

      <SectionCard title={t("users.list.title")} description={t("users.list.subtitle")}>
        {!isAdmin && <p className="text-sm text-muted-foreground">{t("users.adminOnly")}</p>}
        {isAdmin && isPending && (
          <p className="text-sm text-muted-foreground">{t("users.loading")}</p>
        )}
        {isAdmin && isError && <p className="text-sm text-destructive">{t("users.error.load")}</p>}
        {data && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2">{t("users.col.name")}</th>
                  <th className="py-2">{t("users.col.email")}</th>
                  <th className="py-2">{t("users.col.role")}</th>
                  <th className="py-2">{t("users.col.architect")}</th>
                  <th className="py-2">{t("users.col.status")}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((user) => (
                  <tr key={user.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 font-medium">
                      {user.name}
                      {user.mustChangePassword && (
                        <span
                          className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground"
                          title={t("users.mustChangePassword.hint")}
                        >
                          {t("users.mustChangePassword.badge")}
                        </span>
                      )}
                    </td>
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
                    <td className="py-2">
                      {isAdmin ? (
                        <Button
                          size="sm"
                          variant={user.status === "disabled" ? "secondary" : "outline"}
                          aria-label={`${t("users.col.status")} — ${user.name}`}
                          onClick={() =>
                            void updatePatch(user, {
                              status: user.status === "disabled" ? "active" : "disabled",
                            })
                          }
                        >
                          {user.status === "disabled"
                            ? t("users.status.enable")
                            : t("users.status.disable")}
                        </Button>
                      ) : (
                        <StatusBadge status={user.status} label={t(`users.status.${user.status}`)} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {creating && (
        <CreateUserDialog
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
          }}
        />
      )}
    </>
  );
}

function RoleBadge({ role, label }: { role: UserRole; label: string }) {
  const tone =
    role === "admin" ? "bg-level-5/60" : isLeadCapable(role) ? "bg-level-3/60" : "bg-secondary";
  return <span className={`rounded-md px-2 py-0.5 text-xs ${tone}`}>{label}</span>;
}

function StatusBadge({ status, label }: { status: "active" | "disabled"; label: string }) {
  const tone = status === "disabled" ? "bg-destructive/15 text-destructive" : "bg-secondary";
  return <span className={`rounded-md px-2 py-0.5 text-xs ${tone}`}>{label}</span>;
}

/**
 * ENT-AUTH-001 (AUDITORIA-ENTERPRISE-SYNAPSE-SEXTA-RODADA-2026-08-19.md,
 * Seção 7.1) — self-registration fechou depois do bootstrap; esta é a
 * única forma de entrar conta nova na instância. A senha temporária só
 * aparece nesta resposta — não fica recuperável depois, só o hash é
 * persistido — então o diálogo trava aberto até o admin confirmar que
 * copiou/repassou.
 */
function CreateUserDialog({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const store = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("member");
  const [architectId, setArchitectId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; temporaryPassword: string } | null>(null);

  const canSave = name.trim().length > 1 && email.trim().length > 3;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { temporaryPassword } = await authApi.createUser({
        name: name.trim(),
        email: email.trim(),
        role,
        architectId: architectId || null,
      });
      setResult({ email: email.trim(), temporaryPassword });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("users.create.error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <Dialog open onOpenChange={(open) => !open && onCreated()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.create.successTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("users.create.successBody")}</p>
          <div className="surface-inset space-y-1 px-3 py-2 text-sm">
            <p>
              <span className="text-muted-foreground">{t("users.col.email")}: </span>
              {result.email}
            </p>
            <p className="font-mono text-base">{result.temporaryPassword}</p>
          </div>
          <p className="text-xs text-destructive">{t("users.create.notRecoverable")}</p>
          <DialogFooter>
            <Button onClick={onCreated}>{t("users.create.done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("users.create.title")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="new-user-name">{t("users.col.name")}</Label>
            <Input id="new-user-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="new-user-email">{t("users.col.email")}</Label>
            <Input
              id="new-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="new-user-role">{t("users.col.role")}</Label>
            <select
              id="new-user-role"
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <option value="member">{t("users.role.member")}</option>
              <option value="lead">{t("users.role.lead")}</option>
              <option value="admin">{t("users.role.admin")}</option>
            </select>
          </div>
          <div>
            <Label htmlFor="new-user-architect">{t("users.col.architect")}</Label>
            <select
              id="new-user-architect"
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={architectId}
              onChange={(e) => setArchitectId(e.target.value)}
            >
              <option value="">{t("users.architect.none")}</option>
              {store.architects.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            {t("users.create.cancel")}
          </Button>
          <Button disabled={!canSave || submitting} onClick={() => void submit()}>
            {submitting ? t("users.create.saving") : t("users.create.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
