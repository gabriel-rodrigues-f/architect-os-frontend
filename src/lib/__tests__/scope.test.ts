import { describe, expect, it } from "vitest";

import {
  canActFor,
  defaultUiAuthorizationPolicy,
  isAssignedTechLeadOf,
  isLeadOf,
  UiAuthorizationPolicy,
} from "../scope";
import { fixtureAdminUser, fixtureMemberUser, fixtureUnassignedLeadUser } from "./fixtures";

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seção 70) — `scope.ts` virou `UiAuthorizationPolicy`; estes testes cobrem
 * a classe nova diretamente (instanciada, sem passar pelas funções soltas)
 * e confirmam que as funções soltas mantidas para compatibilidade
 * continuam devolvendo exatamente o mesmo resultado, delegando para a
 * mesma instância compartilhada.
 */
describe("UiAuthorizationPolicy", () => {
  const policy = new UiAuthorizationPolicy();
  const anaAsArchitect = { id: "ana", leadUserId: null };
  const leadOfAna = { id: "ana", leadUserId: fixtureUnassignedLeadUser.id };

  describe("canActFor", () => {
    it("admin pode agir sobre qualquer pessoa", () => {
      expect(policy.canActFor(fixtureAdminUser, anaAsArchitect)).toBe(true);
    });

    it("a própria pessoa pode agir sobre si mesma", () => {
      expect(policy.canActFor(fixtureMemberUser, anaAsArchitect)).toBe(true);
    });

    it("lead sem atribuição não pode agir sobre quem não é dele", () => {
      expect(policy.canActFor(fixtureUnassignedLeadUser, anaAsArchitect)).toBe(false);
    });

    it("lead atribuído pode agir sobre quem ele lidera", () => {
      expect(policy.canActFor(fixtureUnassignedLeadUser, leadOfAna)).toBe(true);
    });

    it("sem architect, ninguém além do admin pode agir", () => {
      expect(policy.canActFor(fixtureMemberUser, undefined)).toBe(false);
      expect(policy.canActFor(fixtureAdminUser, undefined)).toBe(true);
    });
  });

  describe("isLeadOf", () => {
    it("admin conta como lead (bypass de dono)", () => {
      expect(policy.isLeadOf(fixtureAdminUser, anaAsArchitect)).toBe(true);
    });

    it("a própria pessoa NÃO é lead de si mesma", () => {
      expect(policy.isLeadOf(fixtureMemberUser, anaAsArchitect)).toBe(false);
    });

    it("só o lead atribuído responde true", () => {
      expect(policy.isLeadOf(fixtureUnassignedLeadUser, anaAsArchitect)).toBe(false);
      expect(policy.isLeadOf(fixtureUnassignedLeadUser, leadOfAna)).toBe(true);
    });
  });

  describe("isAssignedTechLeadOf", () => {
    it("NÃO tem bypass de admin — reabertura de PDI é só do lead responsável", () => {
      expect(policy.isAssignedTechLeadOf(fixtureAdminUser, leadOfAna)).toBe(false);
    });

    it("o lead atribuído responde true", () => {
      expect(policy.isAssignedTechLeadOf(fixtureUnassignedLeadUser, leadOfAna)).toBe(true);
    });

    it("lead sem atribuição responde false", () => {
      expect(policy.isAssignedTechLeadOf(fixtureUnassignedLeadUser, anaAsArchitect)).toBe(false);
    });
  });

  describe("isAdmin", () => {
    it("só a conta admin responde true", () => {
      expect(policy.isAdmin(fixtureAdminUser)).toBe(true);
      expect(policy.isAdmin(fixtureMemberUser)).toBe(false);
      expect(policy.isAdmin(fixtureUnassignedLeadUser)).toBe(false);
    });
  });
});

describe("funções soltas — compatibilidade com os call sites existentes", () => {
  const leadOfAna = { id: "ana", leadUserId: fixtureUnassignedLeadUser.id };

  it("canActFor delega para defaultUiAuthorizationPolicy", () => {
    expect(canActFor(fixtureUnassignedLeadUser, leadOfAna)).toBe(
      defaultUiAuthorizationPolicy.canActFor(fixtureUnassignedLeadUser, leadOfAna),
    );
    expect(canActFor(fixtureUnassignedLeadUser, leadOfAna)).toBe(true);
  });

  it("isLeadOf delega para defaultUiAuthorizationPolicy", () => {
    expect(isLeadOf(fixtureAdminUser, undefined)).toBe(
      defaultUiAuthorizationPolicy.isLeadOf(fixtureAdminUser, undefined),
    );
  });

  it("isAssignedTechLeadOf delega para defaultUiAuthorizationPolicy", () => {
    expect(isAssignedTechLeadOf(fixtureAdminUser, leadOfAna)).toBe(
      defaultUiAuthorizationPolicy.isAssignedTechLeadOf(fixtureAdminUser, leadOfAna),
    );
    expect(isAssignedTechLeadOf(fixtureAdminUser, leadOfAna)).toBe(false);
  });
});
