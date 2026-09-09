import { ApiOperationsGateway } from "./gateways/operations.gateway";
import { defaultContainer } from "./gateways/container";

const {
  sessionPolicy,
  supportAccess,
  analyticsGateway,
  professionalsGateway,
  assessmentGateway,
  authGateway,
  calibrationGateway,
  careerGateway,
  catalogGateway,
  configGateway,
  cyclesGateway,
  developmentGateway,
  evolutionGateway,
  learningGateway,
  mentoringGateway,
  noticesGateway,
  personAssistantsGateway,
  reportsGateway,
  stateContextsGateway,
  teamAllocationGateway,
  teamRosterGateway,
  teamsGateway,
  teamTransitionsGateway,
  teamTransfersGateway,
  workAssistantsGateway,
} = defaultContainer;

export const api = {
  ...cyclesGateway,
  ...professionalsGateway,
  ...careerGateway,
  ...catalogGateway,
  ...configGateway,
  ...assessmentGateway,
  ...developmentGateway,
  ...learningGateway,
  ...mentoringGateway,
  ...teamAllocationGateway,
};

export const authApi = { ...authGateway };
export const stateContextsApi = { ...stateContextsGateway };
export const evolutionApi = { ...evolutionGateway };
export const calibrationApi = { ...calibrationGateway };
export const analyticsApi = { ...analyticsGateway };
export const noticesApi = { ...noticesGateway };
export const reportsApi = { ...reportsGateway };
export const teamsApi = { ...teamsGateway };
export const teamRosterApi = { ...teamRosterGateway };
export const teamTransitionsApi = { ...teamTransitionsGateway };
export const teamTransfersApi = { ...teamTransfersGateway };
export const personAssistantsApi = { ...personAssistantsGateway };
export const workAssistantsApi = { ...workAssistantsGateway };
export const operationsApi = new ApiOperationsGateway(defaultContainer.apiClient);

export { sessionPolicy, supportAccess };

export { ApiError, UserFacingError } from "./api-errors";
export { API_URL, type AppState } from "./api-client";
export type { CommentInput } from "./gateways/assessment.gateway";
export type { SessionUser, UserRole } from "./gateways/auth.gateway";
