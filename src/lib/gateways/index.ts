/**
 * OO-FE-02 — barrel do diretório `gateways/`: reexporta as interfaces, os
 * tipos por contexto e as implementações `Http*`, junto com as instâncias
 * singleton já montadas em `container.ts`. Consumo futuro (R1-P04, F.7) de
 * uma tela migrando para `gateway + useQuery/useMutation` pode importar só
 * daqui: `import { cyclesGateway } from "@/lib/gateways"`.
 */
export * from "./architects.gateway";
export * from "./assessment.gateway";
export * from "./auth.gateway";
export * from "./career.gateway";
export * from "./catalog.gateway";
export * from "./config.gateway";
export * from "./container";
export * from "./cycles.gateway";
export * from "./development.gateway";
export * from "./evidence.gateway";
export * from "./evolution.gateway";
export * from "./learning.gateway";
export * from "./mentoring.gateway";
export * from "./reports.gateway";
