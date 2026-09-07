import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PersonCombobox } from "@/components/app/PersonCombobox";
import type { Architect } from "@/lib/domain";
import { I18nProvider } from "@/lib/i18n";
import { PersonPicker } from "@/lib/person-selection";
import { fixtureAssignedTechLeadUser, fixtureMemberUser } from "../../helpers/fixtures";

/**
 * Dono, 2026-09-06: "Os botões de busca por outros membros, em nenhuma parte
 * da aplicação, devem ser mostrados para um membro. Um membro pode ver apenas
 * informações sobre si." A forma "só eu" do `PersonPicker` é a resposta em UM
 * lugar: sem gatilho, sem lista, sem busca — a tela mostra o nome da pessoa.
 */
const pessoa = (id: string, name: string, teamId = "time-plataforma"): Architect => ({
  id,
  name,
  role: "Pleno",
  yearsAsArchitect: 3,
  specialization: "",
  email: `${id}@a.com`,
  active: true,
  teamId,
  version: 1,
});

const ana = pessoa("ana", "Ana Martins");
const bruno = pessoa("bruno", "Bruno Almeida");

const renderPicker = (picker: PersonPicker) => {
  const onChange = vi.fn();
  const rendered = render(
    <I18nProvider>
      <PersonCombobox picker={picker} onChange={onChange} label="Profissional" />
    </I18nProvider>,
  );
  return { ...rendered, onChange };
};

describe("PersonPicker — a forma 'só eu' (dono, 2026-09-06)", () => {
  afterEach(() => cleanup());

  it("é fixa: a escolha é a própria pessoa e nenhuma outra pode ser marcada", () => {
    const picker = PersonPicker.onlyMe(ana);
    expect(picker.fixed).toBe(true);
    expect(picker.many).toBe(false);
    expect(picker.visibleSelected).toEqual(["ana"]);
    expect(picker.summary).toEqual({ kind: "one", name: "Ana Martins" });
    expect(picker.canPick("bruno")).toBe(false);
    expect(picker.pick("bruno")).toEqual(["ana"]);
    expect(picker.offersWholeTeam).toBe(false);
  });

  it("`oneFor` dá ao profissional a forma 'só eu' com ele mesmo, mesmo que o alcance traga mais gente", () => {
    const picker = PersonPicker.oneFor(fixtureMemberUser, [bruno, ana], "bruno");
    expect(picker.fixed).toBe(true);
    expect(picker.people.map((person) => person.id)).toEqual(["ana"]);
    expect(picker.visibleSelected).toEqual(["ana"]);
  });

  it("`oneFor` dá a quem lidera a escolha de uma pessoa entre o alcance", () => {
    const picker = PersonPicker.oneFor(fixtureAssignedTechLeadUser, [bruno, ana], "bruno");
    expect(picker.fixed).toBe(false);
    expect(picker.people.map((person) => person.id)).toEqual(["ana", "bruno"]);
    expect(picker.visibleSelected).toEqual(["bruno"]);
  });

  it("na tela, 'só eu' não desenha nada — nem o nome (dono, 2026-09-07)", () => {
    const { container } = renderPicker(PersonPicker.onlyMe(ana));
    expect(container.textContent).toBe("");
    expect(screen.queryByLabelText("Profissional")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByPlaceholderText("Buscar pessoa…")).toBeNull();
  });

  it("quem lidera continua com a combobox de sempre", () => {
    renderPicker(PersonPicker.oneFor(fixtureAssignedTechLeadUser, [ana, bruno], "ana"));
    expect(screen.getByRole("combobox", { name: "Profissional" })).toBeTruthy();
  });
});
