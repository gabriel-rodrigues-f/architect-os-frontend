import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";

import {
  CommandWithReasonDialog,
  OutOfReachScreen,
  PageHeader,
  QuerySection,
  RoleSelect,
  SectionCard,
  StatusBadge,
} from "@/components/app";
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
import { api, authApi, teamsApi, type SessionUser, type UserRole } from "@/lib/api";
import type { TeamMemberRole } from "@/lib/gateways/auth.gateway";
import { useAsyncSubmit, useSuccessToast } from "@/hooks";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import {
  AdmissionRefusal,
  defaultPersonAdmissionPolicy,
  PersonAdmission,
  type AdmissionField,
  type PersonAdmissionValues,
} from "@/lib/person-admission";
import { requireLeadershipReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useCareerLevelsByRank } from "@/lib/store";

export const Route = createFileRoute("/users")({
  beforeLoad: requireLeadershipReach,
  head: () => ({
    meta: [
      { title: "Usuários — Synapse" },
      {
        name: "description",
        content:
          "Cadastro de pessoas: cargo (administrador, gestor, Tech Lead, membro), senioridade, time e status da conta.",
      },
      { property: "og:title", content: "Usuários — Synapse" },
      {
        property: "og:description",
        content: "O único lugar onde uma pessoa é cadastrada: conta e profissional num ato só.",
      },
    ],
  }),
  component: UsersPage,
});

const USERS_QUERY_KEY = ["auth-users"] as const;

function UsersPage() {
  const { t } = useI18n();
  const help = usePageHelp("users");
  const isLeadership = defaultUiAuthorizationPolicy.isLeadership(useCurrentUser());

  if (!isLeadership) {
    return (
      <OutOfReachScreen
        title={t("users.title")}
        help={help}
        reason={t("users.leadershipOnly")}
        hint={t("users.leadershipOnlyHint")}
      />
    );
  }

  return <UsersDirectory />;
}

function UsersDirectory() {
  const { t } = useI18n();
  const notifySuccess = useSuccessToast();
  const help = usePageHelp("users");
  const user = useCurrentUser();
  const isAdmin = defaultUiAuthorizationPolicy.isAdmin(user);
  const admits = defaultPersonAdmissionPolicy.admits(user);
  const queryClient = useQueryClient();
  const [admitting, setAdmitting] = useState(false);
  const [editing, setEditing] = useState<SessionUser | null>(null);
  const [deactivating, setDeactivating] = useState<SessionUser | null>(null);
  const [restoringAccessOf, setRestoringAccessOf] = useState<SessionUser | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: authApi.users,
    staleTime: 30_000,
    enabled: isAdmin,
  });

  const refreshAccounts = () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });

  const updatePatch = async (
    account: SessionUser,
    patch: Partial<{ role: UserRole; status: "active" | "disabled"; name: string; email: string }>,
  ) => {
    const updated = await authApi.updateUser(account.id, patch);
    await refreshAccounts();
    notifySuccess("msg.user.update.success", { nome: updated.name }, updated);
  };

  return (
    <>
      <PageHeader
        title={t("users.title")}
        description={t("users.subtitle")}
        help={help}
        actions={
          admits && (
            <Button size="sm" onClick={() => setAdmitting(true)}>
              {t("users.admit.action")}
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
          {(accounts) => (
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
                      <th scope="col" className="py-2">
                        {t("users.col.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr key={account.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2 font-medium">
                          {account.name}
                          {account.mustChangePassword && (
                            <span
                              className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-meta font-normal text-muted-foreground"
                              title={t("users.mustChangePassword.hint")}
                            >
                              {t("users.mustChangePassword.badge")}
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-muted-foreground">{account.email}</td>
                        <td className="py-2">
                          <StatusBadge
                            tone={roleTone[account.role]}
                            label={t(`users.role.${account.role}`)}
                          />
                        </td>
                        <td className="py-2">
                          <AccountStatusBadge
                            status={account.status}
                            label={t(`users.status.${account.status}`)}
                          />
                        </td>
                        <td className="py-2">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={`${t("users.edit.action")} ${account.name}`}
                              onClick={() => setEditing(account)}
                            >
                              {t("users.edit.action")}
                            </Button>
                            {defaultUiAuthorizationPolicy.canRestoreAccessOf(user, account) && (
                              <Button
                                size="sm"
                                variant="outline"
                                aria-label={`${t("users.restoreAccess.action")} ${account.name}`}
                                onClick={() => setRestoringAccessOf(account)}
                              >
                                {t("users.restoreAccess.action")}
                              </Button>
                            )}
                            {account.architectId !== null && account.status === "active" && (
                              <Button
                                size="sm"
                                variant="outline"
                                aria-label={`${t("users.deactivate.action")} ${account.name}`}
                                onClick={() => setDeactivating(account)}
                              >
                                {t("users.deactivate.action")}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </QuerySection>
      )}

      {admitting && (
        <AdmitPersonDialog
          onCancel={() => setAdmitting(false)}
          onAdmitted={() => {
            setAdmitting(false);
            void refreshAccounts();
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

      {deactivating && (
        <DeactivatePersonDialog
          account={deactivating}
          onClose={() => setDeactivating(null)}
          onDeactivated={() => {
            setDeactivating(null);
            void refreshAccounts();
          }}
        />
      )}

      {restoringAccessOf && (
        <RestoreAccessDialog
          account={restoringAccessOf}
          onClose={() => setRestoringAccessOf(null)}
          onRestored={() => {
            setRestoringAccessOf(null);
            void refreshAccounts();
          }}
        />
      )}
    </>
  );
}

const roleTone: Record<UserRole, "neutral" | "progress" | "done"> = {
  admin: "done",
  manager: "progress",
  tech_lead: "progress",
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
          <RoleSelect id="edit-user-role" value={role} onChange={setRole} />
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

/**
 * ONDA 37 — o cadastro unificado. Uma pessoa nasce aqui e em nenhum outro
 * lugar: conta, profissional e vínculo de time num ato só (backend
 * ADR-0084). O que a persona pode criar vem de `PersonAdmissionPolicy`, que
 * espelha a régua do serviço — oferecer o que termina em 403 seria desenhar
 * um caminho sem saída.
 */
function AdmitPersonDialog({
  onCancel,
  onAdmitted,
}: {
  onCancel: () => void;
  onAdmitted: () => void;
}) {
  const { t } = useI18n();
  const user = useCurrentUser();
  const cargos = defaultPersonAdmissionPolicy.admissibleCargos(user);
  const careerLevels = useCareerLevelsByRank();
  const refusalId = useId();

  const teamsQuery = useQuery({ queryKey: ["teams"], queryFn: teamsApi.teams, staleTime: 60_000 });
  const teams = defaultPersonAdmissionPolicy.admissibleTeams(user, teamsQuery.data ?? []);
  const preselectedTeamId = defaultPersonAdmissionPolicy.preselectedTeamId(
    user,
    teamsQuery.data ?? [],
  );

  const [chosen, setChosen] = useState<PersonAdmissionValues | null>(null);
  const [refusal, setRefusal] = useState<AdmissionRefusal | null>(null);
  const [admitted, setAdmitted] = useState<{ email: string; temporaryPassword: string } | null>(
    null,
  );
  const { submitting, run } = useAsyncSubmit(t("users.admit.error"));

  const firstCargo = cargos[0] ?? "member";
  const values = chosen ?? PersonAdmission.empty(firstCargo, preselectedTeamId);
  const admission = new PersonAdmission(values);
  const change = (patch: Partial<PersonAdmissionValues>) => setChosen({ ...values, ...patch });

  const blocked = refusal !== null && refusal.stillApplies(values);
  const describedBy = (field: AdmissionField) =>
    blocked && refusal?.field === field ? { "aria-describedby": refusalId } : {};

  const submit = async () => {
    setRefusal(null);
    const result = await run(() => authApi.admitPerson(admission.toRequest()));
    if (result.ok) {
      setAdmitted({
        email: values.email.trim(),
        temporaryPassword: result.value.temporaryPassword,
      });
      return;
    }
    setRefusal(AdmissionRefusal.of(result.error, values));
  };

  if (admitted) {
    return (
      <Dialog open onOpenChange={(open) => !open && onAdmitted()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.admit.successTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("users.admit.successBody")}</p>
          <div className="surface-inset space-y-1 px-3 py-2 text-sm">
            <p>
              <span className="text-muted-foreground">{t("users.col.email")}: </span>
              {admitted.email}
            </p>
            <p className="font-mono text-base">{admitted.temporaryPassword}</p>
          </div>
          <p className="text-xs text-destructive">{t("users.admit.notRecoverable")}</p>
          <DialogFooter>
            <Button onClick={onAdmitted}>{t("users.admit.done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("users.admit.title")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="admit-name">{t("users.col.name")}</Label>
            <Input
              id="admit-name"
              value={values.name}
              {...describedBy("name")}
              onChange={(event) => change({ name: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="admit-email">{t("users.col.email")}</Label>
            <Input
              id="admit-email"
              type="email"
              value={values.email}
              {...describedBy("email")}
              onChange={(event) => change({ email: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="admit-cargo">{t("users.col.role")}</Label>
            <select
              id="admit-cargo"
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={values.cargo}
              {...describedBy("cargo")}
              onChange={(event) => change({ cargo: event.target.value as TeamMemberRole })}
            >
              {cargos.map((cargo) => (
                <option key={cargo} value={cargo}>
                  {t(`users.role.${cargo}`)}
                </option>
              ))}
            </select>
          </div>
          {admission.seniorityApplies && (
            <div>
              <Label htmlFor="admit-seniority">{t("users.form.seniority")}</Label>
              <select
                id="admit-seniority"
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={values.careerLevelId ?? ""}
                {...describedBy("seniority")}
                onChange={(event) =>
                  change({ careerLevelId: event.target.value === "" ? null : event.target.value })
                }
              >
                <option value="">{t("users.form.seniority.placeholder")}</option>
                {careerLevels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label htmlFor="admit-team">{t("users.form.team")}</Label>
            <select
              id="admit-team"
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={values.teamId ?? ""}
              {...describedBy("team")}
              onChange={(event) =>
                change({ teamId: event.target.value === "" ? null : event.target.value })
              }
            >
              <option value="">{t("users.form.team.placeholder")}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            {!teamsQuery.isPending && teams.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("users.form.team.noneReachable")}
              </p>
            )}
          </div>
          {refusal && (
            <p id={refusalId} className="text-sm text-destructive" role="alert">
              {refusal.message}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            {t("users.admit.cancel")}
          </Button>
          <Button
            disabled={!admission.isComplete || submitting || blocked}
            onClick={() => void submit()}
          >
            {submitting ? t("users.admit.saving") : t("users.admit.action")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * ONDA 37, consequência declarada 4 — desativar é UM ATO: o backend revoga
 * as contas da pessoa na mesma transação do ledger de desativação. A tela de
 * contas não monta o `/state`, então lê o profissional para saber a versão
 * que a operação exige.
 */
/**
 * DEVOLVER O ACESSO — o pedido da liderança, `POST /auth/users/:id/access-recovery`.
 *
 * Pedido do dono (2026-09-04): *"quero poder resetar a senha do usuário"* —
 * com a correção que ele mesmo fez em seguida: **"a senha não deve ser
 * enviada por e-mail"**. Então o que sai daqui é um LINK, e quem escolhe a
 * senha é a pessoa, na tela `/set-password`. Ninguém nesta tela chega a ver
 * uma senha, e é de propósito.
 *
 * A confirmação vem antes porque o ato tem efeito fora da tela: um e-mail sai
 * para a pessoa. Quem pode fazê-lo é a `UiAuthorizationPolicy` que decide
 * (`canRestoreAccessOf`) — o botão nem aparece para quem o serviço recusaria.
 * Uma recusa que escape mesmo assim é dita AQUI, dentro do diálogo, com a
 * frase do serviço, e não como um erro solto depois que a tela já fechou.
 */
function RestoreAccessDialog({
  account,
  onClose,
  onRestored,
}: {
  account: SessionUser;
  onClose: () => void;
  onRestored: () => void;
}) {
  const { t } = useI18n();
  const notifySuccess = useSuccessToast();
  const { submitting, error, run } = useAsyncSubmit(t("users.restoreAccess.error"));

  const confirm = async () => {
    const result = await run(() => authApi.restoreAccessOf(account.id));
    if (!result.ok) return;
    notifySuccess("msg.auth.accessRecovery.sent", { nome: account.name });
    onRestored();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("users.restoreAccess.confirmTitle", { nome: account.name })}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("users.restoreAccess.confirmBody", { nome: account.name })}
        </p>
        {error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t("users.edit.cancel")}
          </Button>
          <Button onClick={() => void confirm()} disabled={submitting}>
            {submitting
              ? t("users.restoreAccess.submitting")
              : t("users.restoreAccess.confirmAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeactivatePersonDialog({
  account,
  onClose,
  onDeactivated,
}: {
  account: SessionUser;
  onClose: () => void;
  onDeactivated: () => void;
}) {
  const { t } = useI18n();
  const notifySuccess = useSuccessToast();
  const architectId = account.architectId ?? "";

  const professional = useQuery({
    queryKey: ["professional", architectId],
    queryFn: () => api.professional(architectId),
    enabled: architectId !== "",
  });

  return (
    <CommandWithReasonDialog
      title={t("users.deactivate.confirmTitle", { nome: account.name })}
      body={t("users.deactivate.confirmDescription")}
      reasonInputId="deactivate-person-reason"
      reasonLabel={t("users.deactivate.reasonLabel")}
      reasonPlaceholder={t("users.deactivate.reasonPlaceholder")}
      confirmLabel={t("users.deactivate.action")}
      submittingLabel={t("users.deactivate.submitting")}
      confirmVariant="destructive"
      fallbackError={t("users.deactivate.error")}
      canSubmit={professional.data !== undefined}
      onSubmit={async (reason) => {
        const version = professional.data?.version ?? 0;
        const updated = await api.deactivate(architectId, reason, version);
        notifySuccess("msg.people.deactivate.success", { nome: account.name }, updated);
        onDeactivated();
      }}
      onClose={onClose}
    />
  );
}
