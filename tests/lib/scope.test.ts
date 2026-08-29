import { describe, expect, it } from "vitest";

import { UiAuthorizationPolicy } from "@/lib/scope";
import {
  fixtureAdminUser,
  fixtureMemberUser,
  fixtureUnassignedLeadUser,
} from "../helpers/fixtures";

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seção 70) — `scope.ts` virou `UiAuthorizationPolicy`. OO3-08 — as funções
 * soltas de compatibilidade foram removidas junto com a migração dos call
 * sites; estes testes cobrem a classe diretamente.
 */
describe("UiAuthorizationPolicy", () => {
  const policy = new UiAuthorizationPolicy();
  const anaAsArchitect = { id: "ana", teamId: null };
  const anaInLedTeam = { id: "ana", teamId: "time-plataforma" };

  describe("canActFor", () => {
    it("admin pode agir sobre qualquer pessoa", () => {
      expect(policy.canActFor(fixtureAdminUser, anaAsArchitect)).toBe(true);
    });

    it("a própria pessoa pode agir sobre si mesma", () => {
      expect(policy.canActFor(fixtureMemberUser, anaAsArchitect)).toBe(true);
    });

    it("lead não age sobre arquiteto SEM TIME — a Fase 2 trocou o vínculo: sem time, sem dono", () => {
      expect(policy.canActFor(fixtureUnassignedLeadUser, anaAsArchitect)).toBe(false);
    });

    it("lead age sobre arquiteto com time — o recorte do servidor (ADR-0035) só lhe entrega times que ele lidera", () => {
      expect(policy.canActFor(fixtureUnassignedLeadUser, anaInLedTeam)).toBe(true);
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
      expect(policy.isLeadOf({ ...fixtureMemberUser, role: "lead" }, anaInLedTeam)).toBe(false);
    });

    it("lead responde true para arquiteto com time, false para arquiteto sem time", () => {
      expect(policy.isLeadOf(fixtureUnassignedLeadUser, anaAsArchitect)).toBe(false);
      expect(policy.isLeadOf(fixtureUnassignedLeadUser, anaInLedTeam)).toBe(true);
    });
  });

  describe("isAssignedTechLeadOf", () => {
    it("NÃO tem bypass de admin — reabertura de PDI é só do lead responsável", () => {
      expect(policy.isAssignedTechLeadOf(fixtureAdminUser, anaInLedTeam)).toBe(false);
    });

    it("o lead do time responde true", () => {
      expect(policy.isAssignedTechLeadOf(fixtureUnassignedLeadUser, anaInLedTeam)).toBe(true);
    });

    it("arquiteto sem time responde false", () => {
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
