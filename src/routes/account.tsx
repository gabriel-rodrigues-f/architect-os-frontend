import { createFileRoute } from "@tanstack/react-router";
import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";

import { PasswordChangeForm } from "@/components/app/PasswordChangeForm";
import { TabStrip, TabPanel, type TabChoice } from "@/components/app/TabStrip";
import { Callout, Initials, PageHeader, SectionCard, SingleSelectFilter } from "@/components/app";
import { useCurrentUser } from "@/lib/auth";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { useTheme, type Theme } from "@/lib/theme";

/**
 * MINHA CONTA — o autosserviço, e o segundo item do grupo Central do Usuário.
 *
 * É o item 7 da proposta de governança de 2026-09-09, na ordem que o dono
 * aprovou: segunda da fila, atrás da Auditoria. E é a ÚNICA tela nova daquele
 * lote que o profissional alcança — por isso ela não tem régua de alcance
 * nenhuma, nem no menu nem aqui: quem tem conta tem esta tela.
 *
 * O que cada aba é, e por que ela é assim:
 *
 * **Perfil — SÓ LEITURA.** Conflito 4 da avaliação, decidido pelo dono com
 * estas palavras: *"correto, ninguém age sobre si"*. A matriz de papéis dá
 * "alterar nome, e-mail e cargo de conta" só ao Administrador, e o adendo 6
 * fecha a porta até para ele: ninguém altera a própria conta. "Cargo" aqui é o
 * PAPEL DE ACESSO — um campo editável seria a pessoa se promovendo —, e o
 * e-mail é a identidade de login. Então a aba mostra os três e leva a quem
 * administra. **Sem foto**: decisão do dono, *"não precisamos agora de fotos
 * de perfil"*; é dado pessoal novo (regra 10) e não há onde guardar arquivo.
 * As iniciais em círculo (`Initials`) resolvem o visual com zero dado novo.
 *
 * **Segurança — a troca da própria senha.** É o ganho real da fatia. A rota
 * existe no servidor desde a regra do primeiro acesso (dono, 2026-09-03) e o
 * único uso dela era a tela que segura a porta: quem já tinha trocado a senha
 * uma vez não tinha como trocar de novo dentro do produto. Nada de rota nova —
 * o gesto inteiro é o `PasswordChangeForm`, o mesmo do primeiro acesso.
 * **Sessões ativas ficaram de fora**, e não por esquecimento: o servidor
 * guarda só os acessos MORTOS, sem dono, sem aparelho e sem data de uso — a
 * lista de aparelhos seria uma promessa sem dado atrás. O que existe de
 * verdade, medido, é o efeito da própria troca: o serviço fecha o cookie e o
 * `pcv` derruba todo token anterior. A tela diz isso, que é o meio-termo
 * honesto, em vez de prometer o que não temos.
 *
 * **Preferências — o que já funcionava, agora com endereço.** Tema e idioma
 * saíram do menu da engrenagem do cabeçalho e passaram a morar aqui; a
 * engrenagem virou o atalho para cá, para ninguém perder o caminho curto.
 * **Preferência de notificação não entra**: não existe objeto para configurar
 * — sem canal, sem opt-out, sem horário. Está no relatório como dependência.
 */
export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Minha Conta — Synapse" },
      {
        name: "description",
        content: "Seus dados de conta, a troca da sua senha e as suas preferências de uso.",
      },
      { property: "og:title", content: "Minha Conta — Synapse" },
      {
        property: "og:description",
        content: "Perfil em leitura, troca da própria senha, tema e idioma.",
      },
    ],
  }),
  component: AccountPage,
});

type AccountTab = "perfil" | "seguranca" | "preferencias";

const TAB_PREFIX = "conta";

const TAB_LABEL: Readonly<Record<AccountTab, MessageKey>> = {
  perfil: "account.tab.profile",
  seguranca: "account.tab.security",
  preferencias: "account.tab.preferences",
};

const THEME_OPTIONS: { value: Theme; labelKey: MessageKey; icon: typeof Sun }[] = [
  { value: "light", labelKey: "prefs.theme.light", icon: Sun },
  { value: "dark", labelKey: "prefs.theme.dark", icon: Moon },
  { value: "system", labelKey: "prefs.theme.system", icon: Monitor },
];

function AccountPage() {
  const { t } = useI18n();
  const help = usePageHelp("account");
  const [tab, setTab] = useState<AccountTab>("perfil");

  const tabs: TabChoice<AccountTab>[] = (["perfil", "seguranca", "preferencias"] as const).map(
    (id) => ({ id, label: t(TAB_LABEL[id]) }),
  );

  return (
    <>
      <PageHeader help={help} title={t("account.title")} description={t("account.description")} />

      <TabStrip
        label={t("account.tabs.label")}
        idPrefix={TAB_PREFIX}
        tabs={tabs}
        active={tab}
        onChoose={setTab}
      />

      <TabPanel idPrefix={TAB_PREFIX} id="perfil" active={tab}>
        <ProfilePanel />
      </TabPanel>
      <TabPanel idPrefix={TAB_PREFIX} id="seguranca" active={tab}>
        <SecurityPanel />
      </TabPanel>
      <TabPanel idPrefix={TAB_PREFIX} id="preferencias" active={tab}>
        <PreferencesPanel />
      </TabPanel>
    </>
  );
}

/**
 * O PERFIL, em leitura. Nenhum `input`, nenhum `select`, nenhum botão de
 * salvar — e isso é a regra, não a falta de tempo: quem corrige nome, e-mail
 * ou papel de acesso é quem administra, em Contas e Acessos. A aba diz para
 * onde ir em vez de deixar a pessoa achando que o produto esqueceu do campo.
 */
function ProfilePanel() {
  const { t } = useI18n();
  const user = useCurrentUser();

  return (
    <SectionCard title={t("account.profile.title")} description={t("account.profile.lead")}>
      {/*
        As INICIAIS, e não uma foto. Decisão do dono (2026-09-09): *"não
        precisamos agora de fotos de perfil."* Rosto ao lado de nota, num
        produto de avaliação, é o mesmo argumento que derrubou o CPF — e a
        regra 10 diz que nenhum dado pessoal novo entra na base. O círculo é o
        `Initials` que a casa já usa no Time: zero dado novo.
        Os três dados aparecem UMA vez, cada um com o próprio rótulo — repetir
        nome e e-mail ao lado do círculo seria enfeite que confunde quem lê a
        tela por leitor de tela.
      */}
      <div className="flex items-start gap-4">
        <Initials name={user.name} />
        <dl className="grid flex-1 gap-4 sm:grid-cols-3">
          <ReadOnlyField label={t("account.profile.name")} value={user.name} />
          <ReadOnlyField label={t("account.profile.email")} value={user.email} />
          <ReadOnlyField label={t("account.profile.role")} value={t(`users.role.${user.role}`)} />
        </dl>
      </div>

      <Callout tone="info" className="mt-6">
        {t("account.profile.askForCorrection")}
      </Callout>
    </SectionCard>
  );
}

/** Um dado da conta, escrito para ser lido — rótulo em cima, valor embaixo. */
function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-label font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-body text-foreground">{value}</dd>
    </div>
  );
}

/**
 * A SEGURANÇA. Uma coisa só, e ela funciona: trocar a própria senha pelo
 * caminho que o servidor já tem. MFA não existe em camada nenhuma e não
 * aparece aqui nem como promessa.
 */
function SecurityPanel() {
  const { t } = useI18n();

  return (
    <SectionCard title={t("account.security.title")} description={t("account.security.lead")}>
      <div className="max-w-md">
        <PasswordChangeForm
          wording={{
            currentLabel: "account.security.currentPassword",
            submit: "account.security.submit",
            submitting: "account.security.submitting",
            done: "account.security.done",
          }}
          note={
            <Callout tone="info" compact>
              {t("account.security.endsSessions")}
            </Callout>
          }
        />
      </div>
    </SectionCard>
  );
}

/** Tema e idioma — os mesmos controles que viviam no menu da engrenagem. */
function PreferencesPanel() {
  const { t, locale, locales, loading, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <SectionCard title={t("account.preferences.title")} description={t("account.preferences.lead")}>
      <div className="max-w-md space-y-6">
        <div>
          <p className="mb-2 text-label font-medium uppercase tracking-wide text-muted-foreground">
            {t("prefs.theme")}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                aria-pressed={theme === option.value}
                /* Literal, e não `cn`: ver a nota em `TabStrip` — o
                   `tailwind-merge` lê `text-body` como cor e a cor condicional
                   abaixo apagaria o tamanho. Não há nada a mesclar aqui. */
                className={`flex flex-col items-center gap-1 rounded-md border px-2 py-3 text-body transition-base ${
                  theme === option.value
                    ? "border-primary bg-secondary font-medium text-foreground"
                    : "border-input text-muted-foreground hover:bg-secondary"
                }`}
              >
                <option.icon className="size-4" aria-hidden="true" />
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="locale"
            className="block text-label font-medium uppercase tracking-wide text-muted-foreground"
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
            empty={{ message: t("prefs.language.empty") }}
          />
        </div>
      </div>
    </SectionCard>
  );
}
