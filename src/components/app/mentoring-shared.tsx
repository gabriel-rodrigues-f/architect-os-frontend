import { AlertCircle, Check, ChevronsUpDown, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ArchitectSelectCombobox } from "@/components/app/ArchitectSelectCombobox";
import { FieldLabel, Initials } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { authErrorMessage, useCurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import type { Architect, Level, MentoringSession, ProficiencyUpdate } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useSelectors, useStore } from "@/lib/store";
import { defaultDateFormatter, defaultNameFormatter } from "@/lib/text";
import { cn } from "@/lib/utils";
import { MentoringViewModel } from "@/lib/view-models/mentoring-view-model";

/**
 * AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-34 (§12) — `/mentoring`
 * era um único componente de ~554 linhas (formulário de nova sessão + linha
 * do tempo, cada um com o próprio estado e regras). Extraído no mesmo
 * padrão de `gap-analysis-shared.tsx` (hook de dados/estado + componentes de
 * apresentação): `MentoringPage` (rota) vira só composição.
 *
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seções 58-61) — os três comandos de escrita (registrar sessão, agendar
 * follow-up, virar item de PDI) moraram para `MentoringViewModel`
 * (`lib/view-models/mentoring-view-model.ts`, que também documenta por que
 * NÃO ganhou `UiAuthorizationPolicy`); os hooks/componentes aqui viram
 * adaptadores finos, mesmo padrão de `useArchitectForm`
 * (`team-shared.tsx`)/`useMentoringSessionForm`.
 */

/** Campos que o usuário preenche e que não podem ficar vazios. */
export const REQUIRED_FIELDS = [
  "menteeId",
  "date",
  "durationMin",
  "topic",
  "notes",
  "decisions",
  "actions",
] as const;
export type RequiredField = (typeof REQUIRED_FIELDS)[number];

/**
 * ORIENTACAO-DECIMA-RODADA, Seção 17/38 — nível OBSERVADO mudado nesta
 * sessão, separado de `competencyIds` (que só significa "abordadas na
 * conversa"). `observedLevel` nasce `null`, nunca L1 (REVISAO-360-FRONTEND,
 * FE-360-002): um default silencioso de L1 deixava o Tech Lead marcar a
 * competência, não perceber o nível pré-selecionado e gravar uma observação
 * que nunca fez — é um rascunho local, não o `ProficiencyUpdate` que a API
 * espera; a conversão só acontece depois de confirmar que não há `null`
 * sobrando.
 */
export interface ProficiencyDraft {
  competencyId: string;
  observedLevel: Level | null;
  note?: string | undefined;
}

/**
 * Estado + submit do formulário de nova sessão. `menteeOptions` vem de fora
 * porque depende de `canActFor` sobre o usuário atual (MENT-001) — a mesma
 * lista também decide o valor inicial do select, então o chamador precisa
 * dela de qualquer forma para renderizar as opções.
 */
export function useMentoringSessionForm(menteeOptions: Architect[]) {
  const store = useStore();
  const { t } = useI18n();
  const user = useCurrentUser();
  const sel = useSelectors();
  /**
   * `store` já abstrai o gateway HTTP atrás de cache/reconciliação (as três
   * ações desta tela passam por ele, nenhuma bypassa `STATE_QUERY_KEY`) —
   * mesmo raciocínio de `useArchitectForm`/`useTeamRoster`: um ViewModel que
   * bypassasse `store` duplicaria essa semântica.
   */
  const viewModel = useMemo(() => new MentoringViewModel(store), [store]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    menteeId: menteeOptions[0]?.id ?? "",
    date: defaultDateFormatter.todayIso(),
    durationMin: "",
    topic: "",
    notes: "",
    decisions: "",
    actions: "",
    nextSession: "",
  });
  const [competencyIds, setCompetencyIds] = useState<string[]>([]);
  const [proficiencyUpdates, setProficiencyUpdates] = useState<ProficiencyDraft[]>([]);
  const toggleProficiencyUpdate = (competencyId: string) =>
    setProficiencyUpdates((prev) =>
      prev.some((u) => u.competencyId === competencyId)
        ? prev.filter((u) => u.competencyId !== competencyId)
        : [...prev, { competencyId, observedLevel: null }],
    );
  const setProficiencyLevel = (competencyId: string, observedLevel: number) => {
    setProficiencyUpdates((prev) =>
      prev.map((u) =>
        u.competencyId === competencyId ? { ...u, observedLevel: observedLevel as Level } : u,
      ),
    );
    setProficiencyMissingLevel(false);
  };
  const setProficiencyNote = (competencyId: string, note: string) =>
    setProficiencyUpdates((prev) =>
      prev.map((u) => (u.competencyId === competencyId ? { ...u, note: note || undefined } : u)),
    );
  /** Marcada sem nível escolhido, depois de uma tentativa de salvar — mesmo padrão visual de `missing`. */
  const [proficiencyMissingLevel, setProficiencyMissingLevel] = useState(false);
  const toggleCompetency = (id: string) =>
    setCompetencyIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  /** Campos vazios apontados no último Salvar; some assim que o campo é preenchido. */
  const [missing, setMissing] = useState<RequiredField[]>([]);
  const [showToast, setShowToast] = useState(false);

  /** Escrever num campo destacado limpa o destaque na hora. */
  const setField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setMissing((prev) => prev.filter((f) => f !== field));
  };

  const isMissing = (field: RequiredField) => missing.includes(field);

  /** Borda vermelha nos campos que o usuário precisa revisar. */
  const invalid = (field: RequiredField) =>
    isMissing(field) ? "border-destructive ring-1 ring-destructive" : "";

  /** Duração precisa ser um número real de minutos — nunca um padrão escondendo entrada inválida. */
  const durationValue = Number(form.durationMin);
  const durationInvalid =
    form.durationMin.trim().length > 0 && (!Number.isInteger(durationValue) || durationValue <= 0);
  const [saving, setSaving] = useState(false);

  /**
   * Sem id local nem sucesso otimista: o servidor gera o id de verdade e é
   * quem decide se o registro vale — só fecha o diálogo depois da resposta.
   * Ver AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md, IDOR-002/EVD-001.
   */
  const submit = async () => {
    const vazios = REQUIRED_FIELDS.filter((f) => !form[f].trim());
    const proficiencyIncomplete = proficiencyUpdates.some((u) => u.observedLevel === null);
    if (vazios.length > 0 || durationInvalid || proficiencyIncomplete) {
      setMissing(
        durationInvalid && !vazios.includes("durationMin") ? [...vazios, "durationMin"] : vazios,
      );
      setProficiencyMissingLevel(proficiencyIncomplete);
      setShowToast(true);
      return;
    }

    // Nenhum `observedLevel` nulo sobrou (checagem acima) — a conversão pro
    // tipo que a API espera é segura.
    const confirmedUpdates: ProficiencyUpdate[] = proficiencyUpdates.map((u) => ({
      competencyId: u.competencyId,
      observedLevel: u.observedLevel as Level,
      ...(u.note ? { note: u.note } : {}),
    }));

    setSaving(true);
    try {
      await viewModel.createSession(
        user.name,
        form,
        durationValue,
        competencyIds,
        confirmedUpdates,
      );
      toast.success(
        t("mentor.create.toast", { nome: sel.architectById(form.menteeId)?.name ?? "" }),
      );
      setForm({
        ...form,
        durationMin: "",
        topic: "",
        notes: "",
        decisions: "",
        actions: "",
        nextSession: "",
      });
      setCompetencyIds([]);
      setProficiencyUpdates([]);
      setProficiencyMissingLevel(false);
      setMissing([]);
      setShowToast(false);
      setOpen(false);
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return {
    open,
    setOpen,
    form,
    setField,
    missing,
    isMissing,
    invalid,
    showToast,
    setShowToast,
    saving,
    durationInvalid,
    competencyIds,
    toggleCompetency,
    proficiencyUpdates,
    toggleProficiencyUpdate,
    setProficiencyLevel,
    setProficiencyNote,
    proficiencyMissingLevel,
    submit,
  };
}

/**
 * R2-UX-11 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — mentoria é sempre 1:1, então
 * o filtro da linha do tempo não é um recorte de time (`ArchitectFilter`).
 * Pedido do usuário revisando o app rodando: "em 'mentoria' não deve haver a
 * opção de 'todo time'. a sessão é sempre individual" — o filtro nunca mais
 * representa "todo mundo", sempre UMA pessoa específica, mesmo critério de
 * `ArchitectSelectCombobox`. O valor inicial é a primeira pessoa ativa em
 * ordem alfabética (cai para a primeira inativa só se não houver nenhuma
 * ativa) em vez de nascer vazio — mesmo raciocínio de `menteeId` em
 * `useMentoringSessionForm`, que já assume "a primeira opção da lista" como
 * default sensato em vez de exigir um clique extra antes de mostrar algo.
 */
export function useMentoringTimeline() {
  const store = useStore();
  const orderedArchitects = [...store.architects].sort(defaultNameFormatter.byName);
  const defaultMenteeId =
    orderedArchitects.find((a) => a.active)?.id ?? orderedArchitects[0]?.id ?? "";
  const [filter, setFilter] = useState<string>(defaultMenteeId);

  const sessions = [...store.mentoringSessions]
    .filter((s) => s.menteeId === filter)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return { filter, setFilter, sessions };
}

/**
 * Combobox pesquisável de seleção única para o filtro da linha do tempo —
 * mesmo padrão "sem opção 'Todo o time'" de `ArchitectSelectCombobox`; a
 * diferença é que aqui inativos aparecem sempre (com sufixo), porque o
 * histórico de mentoria de quem já saiu do time continua consultável (mesma
 * filosofia de R2-UX-08).
 */
export function MenteeFilterCombobox({
  architects,
  selected,
  onChange,
}: {
  architects: readonly Architect[];
  selected: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ordered = [...architects].sort(defaultNameFormatter.byName);
  const active = ordered.filter((a) => a.active);
  const inactive = ordered.filter((a) => !a.active);

  const summary = ordered.find((a) => a.id === selected)?.name ?? t("mentor.filter.placeholder");

  const select = (value: string) => {
    onChange(value);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label={t("mentor.filter.label")}
          aria-expanded={open}
          title={summary}
          className="flex w-64 items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm"
        >
          <span className="min-w-0 flex-1 truncate text-left">{summary}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={t("mentor.filter.searchPlaceholder")} />
          <CommandList className="max-h-72">
            <CommandEmpty>{t("mentor.filter.empty")}</CommandEmpty>
            <CommandGroup>
              {active.map((a) => (
                <CommandItem key={a.id} value={a.name} onSelect={() => select(a.id)}>
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      selected === a.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {inactive.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  {inactive.map((a) => (
                    <CommandItem key={a.id} value={a.name} onSelect={() => select(a.id)}>
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          selected === a.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {t("mentor.filter.inactiveName", { nome: a.name })}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Agendar follow-up depois que a sessão já aconteceu — antes só dava para
 * definir `nextSession` no instante da criação, sem como voltar numa sessão
 * antiga. Só quem registrou a sessão (ou admin) vê a ação. Ver AUDITORIA-
 * QUARTA-REVISAO-ESTADO-ATUAL-SYNAPSE.md, EPIC 5.
 */
export function FollowUpScheduler({ session }: { session: MentoringSession }) {
  const { t, locale } = useI18n();
  const store = useStore();
  const viewModel = useMemo(() => new MentoringViewModel(store), [store]);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(session.nextSession ?? "");
  const [saving, setSaving] = useState(false);

  const save = () => {
    setSaving(true);
    viewModel
      .scheduleFollowUp(session.id, value || null)
      .then(() => {
        toast.success(t("mentor.followUp.toast"));
        setEditing(false);
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : t("mentor.followUp.error"));
      })
      .finally(() => setSaving(false));
  };

  if (!editing) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">
          {session.nextSession
            ? t("mentor.followUp.scheduled", {
                data: defaultDateFormatter.formatDate(session.nextSession, locale) ?? "",
              })
            : t("mentor.followUp.none")}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs"
          onClick={() => setEditing(true)}
        >
          {t("mentor.followUp.action")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <Input
        type="date"
        className="h-8 w-40 text-xs"
        aria-label={t("mentor.followUp.action")}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button size="sm" disabled={saving} onClick={save}>
        {saving ? t("mentor.followUp.saving") : t("mentor.followUp.save")}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
        {t("mentor.followUp.cancel")}
      </Button>
    </div>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div className="surface-inset p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm">{text || "—"}</p>
    </div>
  );
}

/** Uma sessão da linha do tempo — extraído para não inchar `MentoringTimeline`. */
function MentoringTimelineItem({ session }: { session: MentoringSession }) {
  const { t, locale } = useI18n();
  const store = useStore();
  const viewModel = useMemo(() => new MentoringViewModel(store), [store]);
  const sel = useSelectors();
  const user = useCurrentUser();
  const [sendingSessionId, setSendingSessionId] = useState<string | null>(null);

  /**
   * Fecha o loop da mentoria: "ações" era texto morto — ninguém virava PDI
   * de verdade. Só oferece o botão quando dá para criar o item sem inventar
   * nível: precisa de uma competência da sessão com gap já avaliado, e de a
   * pessoa ainda não ter aquele item no plano. Ver AUDITORIA-TERCEIRA-
   * RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md, EPIC J.
   *
   * ORIENTACAO-NONA-RODADA, Seção 12/17.1 (ENT-09-006) — `progressionGapsFor`,
   * nunca `gapsFor` bruta: um gap de Maestria (Nível III) não tem assessment
   * oficial do qual `/from-gap` possa derivar nível/prioridade — o servidor
   * rejeitaria mesmo assim, mas o botão nem deve aparecer.
   */
  const plan = sel.planFor(session.menteeId);
  const gaps = sel.progressionGapsFor(session.menteeId);
  const eligible = viewModel.eligibleGapForPlan(session, gaps, plan);

  return (
    <li className="relative">
      <span className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
      <div className="flex flex-wrap items-center gap-2">
        <Initials name={sel.architectById(session.menteeId)?.name ?? "?"} />
        <div>
          <p className="text-sm font-medium">{session.topic}</p>
          <p className="text-xs text-muted-foreground">
            {sel.architectById(session.menteeId)?.name} · mentor {session.mentor} ·{" "}
            {defaultDateFormatter.formatDate(session.date, locale)} · {session.durationMin} min
          </p>
        </div>
      </div>
      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
        <Block title={t("mentor.block.notes")} text={session.notes} />
        <Block title={t("mentor.block.decisions")} text={session.decisions} />
        <Block title={t("mentor.block.actions")} text={session.actions} />
      </div>
      {session.actions.trim() && eligible?.competency && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          disabled={sendingSessionId === session.id}
          onClick={async () => {
            const mentee = sel.architectById(session.menteeId);
            if (!mentee || !eligible.competency) return;
            setSendingSessionId(session.id);
            try {
              // ORIENTACAO-NONA-RODADA, Seção 4/12 (ENT-09-001/006) — único
              // caminho para criar item de PDI a partir de um GAP oficial:
              // ver docstring de `MentoringViewModel.sendToPlan`.
              await viewModel.sendToPlan(session, mentee, {
                assessmentId: eligible.assessmentId,
                competencyId: eligible.competency.id,
              });
              toast.success(t("mentor.toPdi.toast", { competencia: eligible.competency.name }));
            } catch (error) {
              toast.error(error instanceof ApiError ? error.message : t("mentor.toPdi.error"));
            } finally {
              setSendingSessionId(null);
            }
          }}
        >
          {sendingSessionId === session.id
            ? t("mentor.toPdi.sending")
            : t("mentor.toPdi.action", { competencia: eligible.competency.name })}
        </Button>
      )}
      {session.competencyIds.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {session.competencyIds.map((c) => (
            <span key={c} className="rounded-md bg-secondary px-2 py-0.5">
              {sel.competencyById(c)?.name ?? c}
            </span>
          ))}
        </div>
      )}
      {(session.mentorUserId === user.id || user.role === "admin") && (
        <FollowUpScheduler session={session} />
      )}
      {session.nextSession && session.mentorUserId !== user.id && user.role !== "admin" && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("mentor.followUp.scheduled", {
            data: defaultDateFormatter.formatDate(session.nextSession, locale) ?? "",
          })}
        </p>
      )}
    </li>
  );
}

/** Linha do tempo de sessões — descrição do `SectionCard` some daqui porque depende do texto de escopo do filtro, que só a rota conhece. */
export function MentoringTimeline({ sessions }: { sessions: MentoringSession[] }) {
  const { t } = useI18n();
  return (
    <>
      {sessions.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("mentor.timeline.empty")}</p>
      )}
      <ol className="relative space-y-6 border-l border-border pl-6">
        {sessions.map((s) => (
          <MentoringTimelineItem key={s.id} session={s} />
        ))}
      </ol>
    </>
  );
}

/**
 * Diálogo de nova sessão — formulário + evolução observada. Chama
 * `useMentoringSessionForm` internamente (em vez de receber o resultado por
 * props) para a rota não precisar conhecer os ~20 campos do estado do
 * formulário; só `menteeOptions` (que também decide as opções do select)
 * cruza a fronteira.
 */
export function NewMentoringSessionDialog({ menteeOptions }: { menteeOptions: Architect[] }) {
  const { t } = useI18n();
  const store = useStore();
  const user = useCurrentUser();
  const sel = useSelectors();
  const f = useMentoringSessionForm(menteeOptions);
  /**
   * R2-ESC-07 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — dois checklists de
   * competências nesta mesma dialog (discutidas / evolução observada),
   * filtros independentes — filtrar um não deveria escondar opção do outro.
   */
  const [competencyFilter, setCompetencyFilter] = useState("");
  const [proficiencyFilter, setProficiencyFilter] = useState("");
  const activeCompetencies = store.competencies.filter((c) => c.active);
  const discussedList = activeCompetencies.filter((c) =>
    defaultNameFormatter.matchesSearch(c.name, competencyFilter.trim().toLowerCase()),
  );
  const proficiencyList = activeCompetencies.filter((c) =>
    defaultNameFormatter.matchesSearch(c.name, proficiencyFilter.trim().toLowerCase()),
  );

  return (
    <Dialog open={f.open} onOpenChange={f.setOpen}>
      <DialogTrigger asChild>
        <Button>{t("mentor.new")}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("mentor.form.title")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="mentee">{t("mentor.form.mentee")}</Label>
              <div className="mt-1">
                <ArchitectSelectCombobox
                  id="mentee"
                  architects={menteeOptions}
                  selectedId={f.form.menteeId}
                  onChange={(id) => f.setField("menteeId", id)}
                  label={t("mentor.form.mentee")}
                  invalid={f.isMissing("menteeId")}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="date">{t("mentor.form.date")}</Label>
              <Input
                id="date"
                type="date"
                max={defaultDateFormatter.todayIso()}
                aria-invalid={f.isMissing("date")}
                className={f.invalid("date")}
                value={f.form.date}
                onChange={(e) => f.setField("date", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void f.submit()}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="duration">{t("mentor.form.duration")}</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                step={1}
                aria-invalid={f.isMissing("durationMin") || f.durationInvalid}
                className={
                  f.invalid("durationMin") ||
                  (f.durationInvalid ? "border-destructive ring-1 ring-destructive" : "")
                }
                value={f.form.durationMin}
                onChange={(e) => f.setField("durationMin", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void f.submit()}
              />
            </div>
            <div>
              <Label htmlFor="next-session">{t("mentor.form.nextSession")}</Label>
              <Input
                id="next-session"
                type="date"
                value={f.form.nextSession}
                onChange={(e) => f.setField("nextSession", e.target.value)}
              />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="topic" hint={t("mentor.form.topicHint")}>
              {t("mentor.form.topic")}
            </FieldLabel>
            <Input
              id="topic"
              aria-invalid={f.isMissing("topic")}
              className={f.invalid("topic")}
              value={f.form.topic}
              onChange={(e) => f.setField("topic", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void f.submit()}
            />
          </div>
          <div>
            <FieldLabel htmlFor="notes" hint={t("mentor.form.notesHint")}>
              {t("mentor.form.notes")}
            </FieldLabel>
            <Textarea
              id="notes"
              aria-invalid={f.isMissing("notes")}
              className={f.invalid("notes")}
              value={f.form.notes}
              onChange={(e) => f.setField("notes", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="decisions" hint={t("mentor.form.decisionsHint")}>
              {t("mentor.form.decisions")}
            </FieldLabel>
            <Textarea
              id="decisions"
              aria-invalid={f.isMissing("decisions")}
              className={f.invalid("decisions")}
              value={f.form.decisions}
              onChange={(e) => f.setField("decisions", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="actions" hint={t("mentor.form.actionsHint")}>
              {t("mentor.form.actions")}
            </FieldLabel>
            <Textarea
              id="actions"
              aria-invalid={f.isMissing("actions")}
              className={f.invalid("actions")}
              value={f.form.actions}
              onChange={(e) => f.setField("actions", e.target.value)}
            />
          </div>
          <div className="min-w-0">
            <FieldLabel htmlFor="mentor-competencies" hint={t("mentor.form.competenciesHint")}>
              {t("mentor.form.competencies")}
            </FieldLabel>
            {activeCompetencies.length > 20 && (
              <Input
                aria-label={t("common.searchCompetency")}
                placeholder={t("common.searchCompetency")}
                value={competencyFilter}
                onChange={(e) => setCompetencyFilter(e.target.value)}
                className="mt-1"
              />
            )}
            <div
              id="mentor-competencies"
              className="mt-1 max-h-40 overflow-y-auto overflow-x-hidden surface-inset p-2"
            >
              {/* REVISAO-360-FRONTEND, FE-360-003 — competência arquivada não é mais
                  identidade profissional válida daqui pra frente (mesmo critério já
                  aplicado abaixo, em "Evolução observada", e no SpecializationCombobox). */}
              {discussedList.map((c) => (
                <label key={c.id} className="flex items-center gap-2 py-0.5 text-sm">
                  <input
                    type="checkbox"
                    checked={f.competencyIds.includes(c.id)}
                    onChange={() => f.toggleCompetency(c.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                </label>
              ))}
              {discussedList.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("common.noCompetencyFound")}</p>
              )}
            </div>
          </div>
          {defaultUiAuthorizationPolicy.isAssignedTechLeadOf(
            user,
            sel.architectById(f.form.menteeId),
          ) && (
            <div className="min-w-0">
              <FieldLabel htmlFor="mentor-proficiency" hint={t("mentor.form.proficiencyHint")}>
                {t("mentor.form.proficiency")}
              </FieldLabel>
              {activeCompetencies.length > 20 && (
                <Input
                  aria-label={t("common.searchCompetency")}
                  placeholder={t("common.searchCompetency")}
                  value={proficiencyFilter}
                  onChange={(e) => setProficiencyFilter(e.target.value)}
                  className="mt-1"
                />
              )}
              <div
                id="mentor-proficiency"
                className="mt-1 max-h-48 overflow-y-auto overflow-x-hidden surface-inset p-2"
              >
                {proficiencyList.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("common.noCompetencyFound")}</p>
                )}
                {proficiencyList.map((c) => {
                  const update = f.proficiencyUpdates.find((u) => u.competencyId === c.id);
                  return (
                    <div key={c.id} className="py-1">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!update}
                          onChange={() => f.toggleProficiencyUpdate(c.id)}
                        />
                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      </label>
                      {update && (
                        <div className="ml-6 mt-1">
                          <div className="flex items-center gap-2">
                            <select
                              className={`rounded-md border bg-card px-2 py-1 text-xs ${
                                f.proficiencyMissingLevel && update.observedLevel === null
                                  ? "border-destructive ring-1 ring-destructive"
                                  : "border-input"
                              }`}
                              value={update.observedLevel ?? ""}
                              aria-invalid={
                                f.proficiencyMissingLevel && update.observedLevel === null
                              }
                              onChange={(e) => f.setProficiencyLevel(c.id, Number(e.target.value))}
                              aria-label={t("mentor.form.proficiencyLevel", { nome: c.name })}
                            >
                              <option value="" disabled>
                                {t("mentor.form.proficiencySelectLevel")}
                              </option>
                              {[1, 2, 3, 4, 5].map((level) => (
                                <option key={level} value={level}>
                                  L{level}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder={t("mentor.form.proficiencyNote")}
                              className="flex-1 rounded-md border border-input bg-card px-2 py-1 text-xs"
                              value={update.note ?? ""}
                              onChange={(e) => f.setProficiencyNote(c.id, e.target.value)}
                            />
                          </div>
                          {f.proficiencyMissingLevel && update.observedLevel === null && (
                            <p className="mt-1 text-xs text-destructive">
                              {t("mentor.form.proficiencyLevelRequired")}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {f.showToast && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="flex-1 text-sm">{t("mentor.required")}</p>
            <button
              type="button"
              onClick={() => f.setShowToast(false)}
              aria-label={t("mentor.closeWarning")}
              className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <DialogFooter>
          <Button disabled={f.saving} onClick={() => void f.submit()}>
            {f.saving ? t("mentor.followUp.saving") : t("mentor.form.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
