import { describe, expect, it } from "vitest";

import { NAV_GROUPS } from "@/lib/navigation-catalog";
import { Route as SettingsRoute } from "@/routes/settings";

/**
 * O ENDEREÇO ANTIGO NÃO VIRA 404 (FILA-DO-DONO, item 2 da decisão de
 * 2026-09-10): *"Quem tem link salvo, quem veio de um aviso, quem tem a aba
 * aberta. Ele redireciona para a primeira fatia."*
 *
 * `/settings` deixou de ser um item de menu — a coluna passou a ter as seis
 * fatias —, mas continua sendo um ENDEREÇO que existe e leva a Elegibilidade.
 * A rota não guarda alcance nenhum: quem decide quem entra é o destino.
 */
describe("o endereço antigo dos Critérios de Progressão", () => {
  it("continua existindo como rota", () => {
    expect(SettingsRoute.options.component).toBeDefined();
  });

  it("leva à primeira fatia, substituindo o histórico em vez de empilhar", () => {
    const Componente = SettingsRoute.options.component as () => {
      props: { to: string; replace: boolean };
    };
    expect(Componente().props).toMatchObject({ to: "/eligibility", replace: true });
  });

  it("não instala guarda de navegação — quem decide alcance é o destino", () => {
    expect(SettingsRoute.options.beforeLoad).toBeUndefined();
  });

  it("saiu da coluna: o menu aponta para as seis fatias, não para o endereço antigo", () => {
    const destinos = NAV_GROUPS.flatMap((grupo) => grupo.items).map((item) => item.to);
    expect(destinos).not.toContain("/settings");
    expect(destinos).toContain("/eligibility");
  });
});
