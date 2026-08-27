import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SectionCard } from "@/components/app/ui-bits";

/**
 * F3/Grupo 2, item 1 — `SectionCard` é o invólucro de seção usado em todas as
 * telas. Ele já renderizava `<section>` com um `<h2>` dentro, mas sem associar
 * um ao outro: `<section>` sem nome acessível não é uma região navegável, e
 * quem usa leitor de tela não consegue saltar entre as seções nem ouvir de que
 * seção o conteúdo é.
 *
 * A associação tem de ser genérica (id gerado dentro do componente), sem exigir
 * mudança em nenhum dos call sites.
 */

describe("SectionCard — seção anunciada pelo próprio título", () => {
  afterEach(cleanup);

  it("expõe a seção como região com o título como nome acessível", () => {
    render(
      <SectionCard title="Resumo do time" description="Panorama do ciclo">
        <p>conteúdo</p>
      </SectionCard>,
    );

    expect(screen.getByRole("region", { name: "Resumo do time" })).toBeTruthy();
  });

  it("dá nomes distintos a duas seções na mesma tela", () => {
    render(
      <>
        <SectionCard title="Lacunas por capacidade">
          <p>a</p>
        </SectionCard>
        <SectionCard title="Ações do plano">
          <p>b</p>
        </SectionCard>
      </>,
    );

    expect(screen.getByRole("region", { name: "Lacunas por capacidade" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Ações do plano" })).toBeTruthy();
  });

  it("mantém o `id` da seção livre para âncora do call site", () => {
    render(
      <SectionCard id="ancora-do-plano" title="Ações do plano">
        <p>c</p>
      </SectionCard>,
    );

    expect(screen.getByRole("region", { name: "Ações do plano" }).id).toBe("ancora-do-plano");
  });
});
