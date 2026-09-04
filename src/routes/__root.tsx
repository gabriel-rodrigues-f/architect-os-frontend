import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { createClientOnlyFn } from "@tanstack/react-start";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "../lib/auth";
import { DependencyProvider } from "../lib/dependencies";
import { I18nProvider } from "../lib/i18n";
import { defaultPublicReach } from "../lib/public-reach";
import { ThemeProvider, useTheme } from "../lib/theme";
import { defaultStranglerLedger } from "../lib/state-contexts";
import { StoreProvider } from "../lib/store";
import { AppShell } from "../components/app/AppShell";
import { FirstAccessScreen } from "../components/app/FirstAccessScreen";
import { LoginScreen } from "../components/app/LoginScreen";
import { Toaster } from "../components/ui/sonner";

const errorTrackingDsn = import.meta.env["VITE_SENTRY_DSN"];

const loadClientErrorTracking = createClientOnlyFn(async () => {
  const errorTracking = await import("../lib/error-tracking.client");
  errorTracking.initErrorTrackingClient();
  return errorTracking;
});

let clientErrorTracking: ReturnType<typeof loadClientErrorTracking> | null = null;

function startClientErrorTracking() {
  if (!errorTrackingDsn) return null;
  clientErrorTracking ??= loadClientErrorTracking();
  return clientErrorTracking;
}

function captureClientError(error: unknown) {
  if (typeof window === "undefined") return;
  const errorTracking = startClientErrorTracking();
  if (!errorTracking) return;
  void errorTracking.then(({ Sentry }) => Sentry.captureException(error));
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);

  captureClientError(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página não carregou
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado do nosso lado. Você pode atualizar a página ou voltar ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Painel — Synapse" },
      {
        name: "description",
        content: "Visão executiva das capacidades técnicas do time: gaps, PDIs, metas e evolução.",
      },

      { property: "og:title", content: "Painel — Synapse" },
      {
        property: "og:description",
        content: "Visão executiva das capacidades técnicas do time: gaps, PDIs, metas e evolução.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Painel — Synapse" },
      {
        name: "twitter:description",
        content: "Visão executiva das capacidades técnicas do time: gaps, PDIs, metas e evolução.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (routerState) => routerState.location.pathname });

  useEffect(() => {
    startClientErrorTracking();
  }, []);

  return (
    <DependencyProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              {/*
               * O ALCANCE PÚBLICO PASSA POR FORA DO PORTÃO. Quem clica no link
               * de recuperação de acesso NÃO TEM sessão — é por isso que está
               * clicando —, e o `AuthGate` desenharia a tela de login no lugar
               * da criação de senha, mandando a pessoa fazer justamente o que
               * ela não consegue. A lista de quem escapa é a `PublicReach`, e
               * a catraca `alcance-por-rota` confere que ela e a matriz de
               * alcance dizem a mesma coisa nos dois sentidos.
               *
               * O `AuthProvider` continua por fora dos dois ramos de
               * propósito: o `/auth/me` da montagem responde "ninguém" sem
               * quebrar nada, e quem já estiver logado e abrir o link não
               * perde a sessão por isso.
               */}
              {defaultPublicReach.covers(pathname) ? (
                <Outlet />
              ) : (
                <AuthGate>
                  {/*
                   * A CASCA FICA POR FORA DO STORE. Relato do dono (2026-09-03):
                   * "sempre ao abrir a aplicação, assim que clico em qualquer um
                   * dos menus a tela pisca; a partir de então para de piscar".
                   *
                   * A aplicação abre em `/`, que o strangler ledger marca como
                   * estrangulada — modo "contexts", sem a consulta grande. No
                   * primeiro clique para qualquer outra rota o modo vira "blob",
                   * a `appStateQuery` monta pela primeira vez e o `StoreProvider`
                   * devolve `<LoadingState />` no lugar de TODOS os filhos. Com o
                   * `AppShell` dentro dele, menu, cabeçalho e ciclo sumiam junto —
                   * o piscar. Depois o dado fica em cache e nunca mais acontece,
                   * exatamente como ele descreveu.
                   *
                   * Invertida a ordem, o carregamento (e a falha de conexão, que
                   * apagava a casca do mesmo jeito) acontece DENTRO do `<main>`:
                   * a navegação continua na tela enquanto o conteúdo chega. O
                   * `AppShell` não usa `useStore` — só sessão, idioma, tema e as
                   * fatias de ciclo do `context-scope` —, então ele não precisa
                   * do provedor para desenhar.
                   */}
                  <AppShell>
                    <StoreProvider
                      mode={defaultStranglerLedger.isStrangled(pathname) ? "contexts" : "blob"}
                    >
                      <Outlet />
                    </StoreProvider>
                  </AppShell>
                </AuthGate>
              )}
              {/*
               * O AVISO FICA POR FORA DO PORTÃO. Dentro dele, todo aviso
               * nasce condenado: o `<Toaster>` desmontava junto com a
               * aplicação exatamente nas trocas que mais precisam avisar —
               * a sessão que expira (some com a aplicação) e a senha trocada
               * no primeiro acesso (o aviso é disparado pela tela que sai de
               * cena). Aviso é casca do app inteiro, não do miolo autenticado.
               */}
              <AppToaster />
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </DependencyProvider>
  );
}

function AppToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} position="bottom-right" duration={3000} richColors={false} />;
}

function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }
  if (!user) return <LoginScreen />;
  /*
   * A MARCA DE PÉ SEGURA A PORTA. Regra do dono (2026-09-03): "ao realizar o
   * primeiro acesso, o usuário (regra universal) precisa ter que alterar sua
   * senha". O backend já recusa toda rota com 403 PASSWORD_CHANGE_REQUIRED
   * enquanto `mustChangePassword` está de pé — quem entra tem sessão válida e
   * não vai a lugar nenhum.
   *
   * O bloqueio mora AQUI, e não numa rota, por duas razões: a pessoa chega à
   * troca logo depois do login em vez de tropeçar num 403, e o resto da
   * aplicação — menu, casca, `Outlet` — sequer é desenhado, então não existe
   * destino para onde navegar antes de trocar.
   */
  if (user.mustChangePassword) return <FirstAccessScreen />;
  return <>{children}</>;
}
