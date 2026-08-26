import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { createClientOnlyFn } from "@tanstack/react-start";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "../lib/auth";
import { DependencyProvider } from "../lib/dependencies";
import { I18nProvider } from "../lib/i18n";
import { ThemeProvider, useTheme } from "../lib/theme";
import { StoreProvider } from "../lib/store";
import { AppShell } from "../components/app/AppShell";
import { LoginScreen } from "../components/app/LoginScreen";
import { Toaster } from "../components/ui/sonner";

/**
 * R1-P05 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md, completa B-27) — `__root.tsx`
 * renderiza no SSR e no cliente; um import (estático OU dinâmico) de
 * `error-tracking.client.ts` (que carrega `@sentry/browser`) tornaria esse
 * módulo alcançável do build do SERVIDOR também, e o plugin de proteção de
 * import do TanStack Start recusa o build por causa disso (arquivo
 * `*.client.*` alcançável de onde não devia — a análise estática do plugin
 * enxerga `import()` dinâmico igual a um `import` normal). `createClientOnlyFn`
 * é o mecanismo de verdade para isto: o compilador do Start troca a função
 * pelo próprio corpo no build cliente e por um stub que lança no build
 * servidor — o import dinâmico do lado servidor nem chega a existir no
 * código compilado, então o plugin nunca o vê.
 */
const initClientErrorTracking = createClientOnlyFn(async () => {
  const mod = await import("../lib/error-tracking.client");
  mod.initErrorTrackingClient();
  return mod;
});

let errorTrackingInit: ReturnType<typeof initClientErrorTracking> | null = null;

function captureClientError(error: unknown) {
  if (typeof window === "undefined") return;
  errorTrackingInit ??= initClientErrorTracking();
  void errorTrackingInit.then(({ Sentry }) => Sentry.captureException(error));
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
  /*
    Este componente também renderiza no SSR (erro de loader antes da
    hidratação); `@sentry/browser` pressupõe navegador de verdade, então
    `captureClientError` só age client-side (guard interno). O lado servidor
    do mesmo erro já é coberto por `start.ts`/`error-tracking.server.ts`,
    então nada fica sem captura.
  */
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
        content:
          "Visão executiva das capacidades técnicas do time de Arquitetos de Soluções: gaps, PDIs, metas e evolução.",
      },

      { property: "og:title", content: "Painel — Synapse" },
      {
        property: "og:description",
        content:
          "Visão executiva das capacidades técnicas do time de Arquitetos de Soluções: gaps, PDIs, metas e evolução.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Painel — Synapse" },
      {
        name: "twitter:description",
        content:
          "Visão executiva das capacidades técnicas do time de Arquitetos de Soluções: gaps, PDIs, metas e evolução.",
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
  // `pt` — BASE_LOCALE do app (i18n/registry.ts). O valor real do idioma
  // detectado (`navigator.languages`) só existe client-side, e o próprio
  // `I18nProvider` já corrige `document.documentElement.lang` assim que
  // monta; isto é só o fallback estático do primeiro paint/SSR, que não
  // pode mais ficar hardcoded em inglês para um app em português. Ver
  // ENT-A11Y-001, AUDITORIA-ENTERPRISE-SYNAPSE-SEXTA-RODADA-2026-08-19.md,
  // Seção 37.1.
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

  /*
    Inicializa assim que o app monta no cliente, não só quando o primeiro
    erro acontece — sem isto, qualquer captura antes do primeiro erro de
    rota (ex.: um handler chamando `Sentry.captureException` direto, se essa
    necessidade aparecer depois) rodaria sem `init`. `useEffect` só roda no
    cliente, então a chamada é sempre segura aqui.
  */
  useEffect(() => {
    errorTrackingInit ??= initClientErrorTracking();
  }, []);

  return (
    <DependencyProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <AuthGate>
                <StoreProvider>
                  <AppShell>
                    {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
                    <Outlet />
                  </AppShell>
                  <AppToaster />
                </StoreProvider>
              </AuthGate>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </DependencyProvider>
  );
}

/**
 * Um `<Toaster>` só, montado uma vez — cada tela chama `toast.success(...)` do
 * `sonner` direto, sem montar o próprio portal. Duração fixa em 3s: é a
 * confirmação de "deu certo", não um aviso que precise ser lido com calma.
 */
function AppToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} position="bottom-right" duration={3000} richColors={false} />;
}

/** Sem sessão válida, nenhuma tela do app é montada — só o login. */
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
  return <>{children}</>;
}
