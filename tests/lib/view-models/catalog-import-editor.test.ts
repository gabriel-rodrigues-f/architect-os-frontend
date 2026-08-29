import { describe, expect, it } from "vitest";

import { CatalogImportEditor } from "@/lib/view-models";

const currentCapabilities = [
  { id: "cloud", name: "Cloud Architecture" },
  { id: "security", name: "Security" },
];
const currentCompetencies = [
  { name: "Kubernetes", capabilityId: "cloud" },
  { name: "Serverless", capabilityId: "cloud" },
  { name: "IAM", capabilityId: "security" },
];

const editor = () => CatalogImportEditor.from(currentCapabilities, currentCompetencies);

const validPayload = {
  capabilities: [
    {
      name: "cloud architecture", // caixa diferente — mesma identidade (upsert por nome)
      short: "Cloud",
      competencies: [{ name: "Kubernetes" }, { name: "Service Mesh" }],
    },
    {
      name: "Data Engineering",
      short: "Data",
      competencies: [{ name: "Pipelines" }],
    },
  ],
};

/** CFG-07 — validação client-side (JSON + shape) e preview do diff por nome, antes do POST. */
describe("CatalogImportEditor (CFG-07)", () => {
  it("texto vazio: sem erro e sem payload (o botão fica desabilitado)", () => {
    const e = editor().withText("   ");
    expect(e.errorKey).toBeNull();
    expect(e.isValid).toBe(false);
    expect(e.payload()).toBeNull();
    expect(e.preview()).toBeNull();
  });

  it("JSON inválido e shape inválido têm chaves de erro próprias", () => {
    expect(editor().withText("{oops").errorKey).toBe("matrix.import.error.invalidJson");
    expect(editor().withText('{"capabilities":[{"name":""}]}').errorKey).toBe(
      "matrix.import.error.invalidShape",
    );
    // competência sem nome também é shape (Fase 2: o import é só nome — requirementType/expected morreram no catálogo)
    expect(
      editor().withText(
        JSON.stringify({
          capabilities: [{ name: "X", short: "X", competencies: [{ name: "" }] }],
        }),
      ).errorKey,
    ).toBe("matrix.import.error.invalidShape");
  });

  it("payload vazio (capabilities: []) é recusado antes do POST", () => {
    expect(editor().withText('{"capabilities":[]}').errorKey).toBe("matrix.import.error.empty");
  });

  it("preview conta por nome contra a matriz atual (case-insensitive, régua do upsert)", () => {
    const e = editor().withText(JSON.stringify(validPayload));
    expect(e.errorKey).toBeNull();
    expect(e.isValid).toBe(true);
    const preview = e.preview()!;
    expect(preview.capabilitiesToCreate).toBe(1);
    expect(preview.capabilitiesToUpdate).toBe(1);
    expect(preview.competenciesToCreate).toBe(2); // Service Mesh + Pipelines
    expect(preview.competenciesToUpdate).toBe(1); // Kubernetes

    const cloud = preview.capabilities.find((c) => c.name === "cloud architecture")!;
    expect(cloud.action).toBe("update");
    expect(cloud.competenciesToUpdate).toEqual(["Kubernetes"]);
    expect(cloud.competenciesToCreate).toEqual(["Service Mesh"]);

    const data = preview.capabilities.find((c) => c.name === "Data Engineering")!;
    expect(data.action).toBe("create");
    expect(data.competenciesToCreate).toEqual(["Pipelines"]);
  });

  it("payload() devolve exatamente o que o zod validou — o corpo do POST", () => {
    const e = editor().withText(JSON.stringify(validPayload));
    expect(e.payload()).toEqual(validPayload);
  });
});
