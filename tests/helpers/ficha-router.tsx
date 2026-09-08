/* eslint-disable react-refresh/only-export-components -- helper de teste; fast refresh não se aplica. */
import { useSyncExternalStore, type ReactNode } from "react";
import { vi } from "vitest";

import type { CareerFileTab } from "@/lib/career-file";
import { PlainLink } from "./react-router-mock";

/**
 * O ROTEADOR DA FICHA NOS TESTES — [FA-08].
 *
 * O roteador é mockado por arquivo (`vi.mock` é içado e a fábrica só enxerga
 * `import()` dinâmico); cada teste fica com UMA linha:
 *
 *   vi.mock("@tanstack/react-router", () =>
 *     import("../helpers/ficha-router").then((mod) => mod.reactRouterOfCareerFile()),
 *   );
 *
 * Este arquivo NÃO importa a rota de propósito: a fábrica do mock o carrega
 * enquanto `@tanstack/react-router` ainda está sendo substituído, e a rota
 * importa o roteador — importá-la daqui travaria o carregamento em círculo.
 * Quem monta a rota é `ficha.tsx`.
 *
 * O endereço atual (`pathname`, `professionalId`) e o conteúdo do `Outlet` vivem
 * numa loja mínima que o mock lê por `useSyncExternalStore` — trocar de aba
 * (`goToTab`) re-renderiza o layout sem remontar nada, como o roteador faria.
 */
interface CareerFileLocation {
  professionalId: string;
  tab: CareerFileTab;
  outlet: ReactNode;
}

class CareerFileRouterStore {
  private state: CareerFileLocation = { professionalId: "ana", tab: "overview", outlet: null };
  private readonly listeners = new Set<() => void>();
  readonly navigate = vi.fn();
  readonly push = vi.fn();

  get snapshot(): CareerFileLocation {
    return this.state;
  }

  get pathname(): string {
    const { professionalId, tab } = this.state;
    return tab === "overview"
      ? `/professionals/${professionalId}`
      : `/professionals/${professionalId}/${tab}`;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set(next: Partial<CareerFileLocation>): void {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }

  reset(): void {
    this.state = { professionalId: "ana", tab: "overview", outlet: null };
    this.navigate.mockReset();
    this.push.mockReset();
  }
}

export const careerFileRouter = new CareerFileRouterStore();

const useCareerFileLocation = () =>
  useSyncExternalStore(
    careerFileRouter.subscribe,
    () => careerFileRouter.snapshot,
    () => careerFileRouter.snapshot,
  );

function MockOutlet() {
  return <>{useCareerFileLocation().outlet}</>;
}

export async function reactRouterOfCareerFile(): Promise<typeof import("@tanstack/react-router")> {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  const useRouterState = (options?: {
    select?: (state: { location: { pathname: string } }) => unknown;
  }) => {
    useCareerFileLocation();
    const state = { location: { pathname: careerFileRouter.pathname } };
    return options?.select ? options.select(state) : state;
  };
  return {
    ...actual,
    Link: PlainLink as unknown as typeof actual.Link,
    Outlet: MockOutlet as unknown as typeof actual.Outlet,
    useNavigate: (() => careerFileRouter.navigate) as unknown as typeof actual.useNavigate,
    useRouter: (() => ({
      history: { push: careerFileRouter.push },
      navigate: careerFileRouter.navigate,
      invalidate: vi.fn(),
    })) as unknown as typeof actual.useRouter,
    useRouterState: useRouterState as unknown as typeof actual.useRouterState,
    useLocation: (() => ({
      pathname: careerFileRouter.pathname,
    })) as unknown as typeof actual.useLocation,
    createFileRoute: ((..._args: unknown[]) =>
      (options: Record<string, unknown>) => ({
        ...options,
        options,
        useParams: () => {
          useCareerFileLocation();
          return { professionalId: careerFileRouter.snapshot.professionalId };
        },
      })) as unknown as typeof actual.createFileRoute,
  };
}
