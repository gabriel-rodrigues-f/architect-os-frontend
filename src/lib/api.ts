import type { UserRole } from "./gateways/auth.gateway";
import { defaultContainer } from "./gateways/container";

const {
  apiClient: defaultApiClient,
  sessionPolicy,
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
  noticesGateway,
  reportsGateway,
  stateContextsGateway,
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
export const stateContextsApi = { ...stateContextsGateway };
export const evolutionApi = { ...evolutionGateway };
export const noticesApi = { ...noticesGateway };
export const reportsApi = { ...reportsGateway };

export { sessionPolicy };

export const isLeadCapable = (role: UserRole): boolean => role === "admin" || role === "lead";

export { ApiError } from "./api-errors";
export { API_URL, type AppState } from "./api-client";
export type { CommentInput } from "./gateways/assessment.gateway";
export type { SessionUser, UserRole } from "./gateways/auth.gateway";
