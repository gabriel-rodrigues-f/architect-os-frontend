import { createFileRoute, Outlet } from "@tanstack/react-router";

import { requireArchitectReach } from "@/lib/route-guards";

export const Route = createFileRoute("/architects/$architectId")({
  beforeLoad: requireArchitectReach,
  component: () => <Outlet />,
});
