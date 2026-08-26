import type { UserRole } from "./gateways/auth.gateway";
import { defaultContainer } from "./gateways/container";

const {
  apiClient: defaultApiClient,
  architectsGateway,
  assessmentGateway,
  authGateway,
  careerGateway,
  catalogGateway,
  configGateway,
  cyclesGateway,
  developmentGateway,
  evidenceGateway,
  evolutionGateway,
  learningGateway,
  mentoringGateway,
  reportsGateway,
} = defaultContainer;

export const api = {
  getState: () => defaultApiClient.getState(),
  ...cyclesGateway,
  ...architectsGateway,
  ...careerGateway,
  ...catalogGateway,
  ...configGateway,
  ...assessmentGateway,
  ...developmentGateway,
  ...learningGateway,
  ...mentoringGateway,
  ...evidenceGateway,
};

export const authApi = { ...authGateway };
export const evolutionApi = { ...evolutionGateway };
export const reportsApi = { ...reportsGateway };

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  defaultApiClient.setUnauthorizedHandler(handler);
}

export const isLeadCapable = (role: UserRole): boolean => role === "admin" || role === "lead";

export { ApiError } from "./api-errors";
export { API_URL, type AppState } from "./api-client";
export type { AssessmentItemPatch, CommentInput } from "./gateways/assessment.gateway";
export type { AuthResult, SessionUser, UserRole, UserStatus } from "./gateways/auth.gateway";
