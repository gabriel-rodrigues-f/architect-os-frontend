import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout puro: "Visão geral" (`architects.$architectId.index.tsx`) e
 * "Evolução" (`architects.$architectId.evolution.tsx`) são rotas-filhas
 * completas — cada uma já monta seu próprio `PageHeader`/`ProfileTabs`. Sem
 * este `<Outlet/>`, o roteador casava a URL da aba filha mas nunca desmontava
 * este componente pra renderizar o dela (a aba sempre voltava pra "Visão
 * geral"). Ver Rodada 10, R10-BUG-001.
 */
export const Route = createFileRoute("/architects/$architectId")({
  component: () => <Outlet />,
});
