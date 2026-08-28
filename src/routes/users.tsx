import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { PageHeader, QuerySection, SectionCard, StatusBadge } from "@/components/app";
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
import { authApi, type SessionUser, type UserRole } from "@/lib/api";
import { useAsyncSubmit, useSuccessToast } from "@/hooks";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { requireAdminReach } from "@/lib/route-guards";

export const Route = createFileRoute("/users")({
  beforeLoad: requireAdminReach,
  head: () => ({
    meta: [
      { title: "Usuários — Synapse" },
      {
        name: "description",
        content: "Contas de acesso: papel (administrador, Tech Lead, membro) e status.",
      },
      { property: "og:title", content: "Usuários — Synapse" },
      {
        property: "og:description",
        content: "Quem administra o sistema e quem revisa como Tech Lead.",
      },
    ],
  }),
  component: UsersPage,
});

const USERS_QUERY_KEY = ["auth-users"] as const;

function UsersPage() {
  const { t } = useI18n();
  const notifySuccess = useSuccessToast();
  const help = usePageHelp("users");
  const isAdmin = useCurrentUser().role === "admin";
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<SessionUser | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: authApi.users,
    staleTime: 30_000,
    enabled: isAdmin,
  });

  const updatePatch = async (
    user: SessionUser,
    patch: Partial<{ role: UserRole; status: "active" | "disabled"; name: string; email: string }>,
  ) => {
    const updated = await authApi.updateUser(user.id, patch);
    await queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    notifySuccess("msg.user.update.success", { nome: updated.name }, updated);
  };

  return (
    <>
      <PageHeader
        title={t("users.title")}
        description={t("users.subtitle")}
        help={help}
        actions={
          isAdmin && (
            <Button size="sm" onClick={() => setCreating(true)}>
              {t("users.create.action")}
            </Button>
          )
        }
      />

      {!isAdmin ? (
        <SectionCard title={t("users.list.title")} description={t("users.list.subtitle")}>
          <p className="text-sm text-muted-foreground">{t("users.adminOnly")}</p>
        </SectionCard>
      ) : (
        <QuerySection
          query={{ data, isPending, isError, refetch }}
          title={t("users.list.title")}
          description={t("users.list.subtitle")}
          errorMessage={t("users.error.load")}
          skeleton={<p className="text-sm text-muted-foreground">{t("users.loading")}</p>}
        >
          {(data) => (
            <SectionCard title={t("users.list.title")} description={t("users.list.subtitle")}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-2">
                        {t("users.col.name")}
                      </th>
                      <th scope="col" className="py-2">
                        {t("users.col.email")}
                      </th>
                      <th scope="col" className="py-2">
                        {t("users.col.role")}
                      </th>
                      <th scope="col" className="py-2">
                        {t("users.col.status")}
                      </th>
                      {isAdmin && (
                        <th scope="col" className="py-2">
                          {t("users.col.actions")}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((user) => (
                      <tr key={user.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2 font-medium">
                          {user.name}
                          {user.mustChangePassword && (
                            <span
                              className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-meta font-normal text-muted-foreground"
                              title={t("users.mustChangePassword.hint")}
                            >
                              {t("users.mustChangePassword.badge")}
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-muted-foreground">{user.email}</td>
                        <td className="py-2">
                          <StatusBadge
                            tone={roleTone[user.role]}
                            label={t(`users.role.${user.role}`)}
                          />
                        </td>
                        <td className="py-2">
                          <AccountStatusBadge
                            status={user.status}
                            label={t(`users.status.${user.status}`)}
                          />
                        </td>
                        {isAdmin && (
                          <td className="py-2">
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={`${t("users.edit.action")} ${user.name}`}
                              onClick={() => setEditing(user)}
                            >
                              {t("users.edit.action")}
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </QuerySection>
      )}

      {creating && (
        <CreateUserDialog
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
          }}
        />
      )}

      {editing && (
        <EditUserDialog
          user={editing}
          onCancel={() => setEditing(null)}
          onSave={async (patch) => {
            await updatePatch(editing, patch);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

const roleTone: Record<UserRole, "neutral" | "progress" | "done"> = {
  admin: "done",
  lead: "progress",
  member: "neutral",
};

function AccountStatusBadge({ status, label }: { status: "active" | "disabled"; label: string }) {
  const tone = status === "disabled" ? "bg-destructive/15 text-destructive" : "bg-secondary";
  return <span className={`rounded-md px-2 py-0.5 text-xs ${tone}`}>{label}</span>;
}

function EditUserDialog({
  user,
  onCancel,
  onSave,
}: {
  user: SessionUser;
  onCancel: () => void;
  onSave: (
    patch: Partial<{ role: UserRole; status: "active" | "disabled"; name: string; email: string }>,
  ) => Promise<void>;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<UserRole>(user.role);
  const [status, setStatus] = useState<"active" | "disabled">(user.status);
  const [step, setStep] = useState<"edit" | "confirm-admin">("edit");
  const { submitting: saving, error, run } = useAsyncSubmit(t("users.edit.error"));

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const nameValid = trimmedName.length > 1;
  const emailValid = trimmedEmail.length > 3;

  const grantsAdmin = user.role !== "admin" && role === "admin";
  const changed =
    role !== user.role ||
    status !== user.status ||
    trimmedName !== user.name ||
    trimmedEmail !== user.email;

  const persist = async () => {
    const result = await run(() =>
      onSave({
        ...(role !== user.role ? { role } : {}),
        ...(status !== user.status ? { status } : {}),
        ...(trimmedName !== user.name ? { name: trimmedName } : {}),
        ...(trimmedEmail !== user.email ? { email: trimmedEmail } : {}),
      }),
    );
    if (!result.ok) setStep("edit");
  };

  const handleSaveClick = () => {
    if (grantsAdmin) {
      setStep("confirm-admin");
      return;
    }
    void persist();
  };

  if (step === "confirm-admin") {
    return (
      <Dialog open onOpenChange={(open) => !open && onCancel()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.edit.confirmAdminTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("users.edit.confirmAdminBody", { nome: user.name })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep("edit")} disabled={saving}>
              {t("users.edit.back")}
            </Button>
            <Button variant="destructive" onClick={() => void persist()} disabled={saving}>
              {saving ? t("users.edit.saving") : t("users.edit.confirmAdminAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("users.edit.title", { nome: user.name })}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="edit-user-name">{t("users.col.name")}</Label>
            <Input id="edit-user-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="edit-user-email">{t("users.col.email")}</Label>
            <Input
              id="edit-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="edit-user-role">{t("users.col.role")}</Label>
            <select
              id="edit-user-role"
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
            <Label htmlFor="edit-user-status">{t("users.col.status")}</Label>
            <select
              id="edit-user-status"
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as "active" | "disabled")}
            >
              <option value="active">{t("users.status.active")}</option>
              <option value="disabled">{t("users.status.disabled")}</option>
            </select>
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            {t("users.edit.cancel")}
          </Button>
          <Button
            onClick={handleSaveClick}
            disabled={!changed || saving || !nameValid || !emailValid}
          >
            {saving ? t("users.edit.saving") : t("users.edit.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateUserDialog({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("member");
  const { submitting, error, run } = useAsyncSubmit(t("users.create.error"));
  const [result, setResult] = useState<{ email: string; temporaryPassword: string } | null>(null);

  const canSave = name.trim().length > 1 && email.trim().length > 3;

  const submit = async () => {
    const created = await run(() =>
      authApi.createUser({ name: name.trim(), email: email.trim(), role }),
    );
    if (created.ok)
      setResult({ email: email.trim(), temporaryPassword: created.value.temporaryPassword });
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
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
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
