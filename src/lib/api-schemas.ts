import { z } from "zod";

import { VOCABULARY_NAMES } from "./vocabularies";

const level = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

const roleName = z.string();

const requirementType = z.enum(["RESTRICTIVE", "NON_RESTRICTIVE"]);

const capabilityCuration = z.object({
  activeCompetencyCount: z.number(),
  status: z.enum(["READY", "REQUIRES_CURATION"]),
});

const capability = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string(),
  active: z.boolean(),
  curation: capabilityCuration,
});

const competency = z.object({
  id: z.string(),
  name: z.string(),
  capabilityId: z.string(),
  active: z.boolean(),
});

const teamLevelRule = z.object({
  id: z.string(),
  teamId: z.string(),
  careerLevelId: z.string(),
  minimumQualifiedCapabilities: z.number(),
});

export const teamRuleResponseSchema = teamLevelRule.extend({
  capabilityIds: z.array(z.string()),
  competencies: z.array(
    z.object({
      competencyId: z.string(),
      requirementType,
      requiredLevel: level,
    }),
  ),
});

export const teamSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
});

export const teamsResponseSchema = z.array(teamSummarySchema);

export const teamMembershipBondSchema = z.object({
  teamId: z.string(),
  userId: z.string(),
  role: z.enum(["manager", "tech_lead", "member"]),
});

export const teamRosterMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(["manager", "tech_lead", "member"]),
});

export const teamRosterResponseSchema = z.array(teamRosterMemberSchema);

export const architectAdherenceResponseSchema = z.object({
  architectId: z.string(),
  teamId: z.string().nullable(),
  careerLevelId: z.string(),
  adherence: z.object({
    percentage: z.number().min(0).max(1),
    missingRequired: z.array(
      z.object({
        competencyId: z.string(),
        currentLevel: z.number(),
        requiredLevel: z.number(),
      }),
    ),
  }),
  semRegua: z.literal(true).optional(),
});

const notice = z.object({
  id: z.string(),
  eventType: z.string(),
  title: z.string(),
  link: z.string(),
  occurredAt: z.string(),
  readAt: z.string().nullable(),
  architectId: z.string().nullable(),
  teamId: z.string().nullable(),
});

export const noticesResponseSchema = z.object({
  notices: z.array(notice),
  unreadCount: z.number(),
});

const levelDistribution = z.object({
  "1": z.number(),
  "2": z.number(),
  "3": z.number(),
  "4": z.number(),
  "5": z.number(),
});

const calibrationEvaluator = z.object({
  userId: z.string(),
  name: z.string(),
  teamIds: z.array(z.string()),
  distribution: levelDistribution,
  average: z.number().nullable(),
  itemsCount: z.number(),
  assessmentsCount: z.number(),
});

export const calibrationResponseSchema = z.object({
  cycleId: z.string(),
  overall: z.object({
    distribution: levelDistribution,
    average: z.number().nullable(),
  }),
  evaluators: z.array(calibrationEvaluator),
  unattributed: z
    .object({
      distribution: levelDistribution,
      average: z.number().nullable(),
      itemsCount: z.number(),
    })
    .optional(),
});

const gapCycleTotal = z.object({
  cycleId: z.string(),
  cycleName: z.string(),
  totalGap: z.number(),
  pairCount: z.number(),
});

const gapMovement = z.object({
  kind: z.enum(["CLOSED", "REDUCED", "INCREASED", "OPENED", "DROPPED", "STABLE"]),
  pairCount: z.number(),
  amount: z.number(),
});

export const gapClosureResponseSchema = z.object({
  waterfall: z
    .object({
      from: gapCycleTotal,
      to: gapCycleTotal,
      movements: z.array(gapMovement),
    })
    .nullable(),
  velocity: z
    .object({
      fromCycleId: z.string(),
      toCycleId: z.string(),
      gapsOpenAtStart: z.number(),
      gapsClosed: z.number(),
      gapsOpened: z.number(),
      netClosed: z.number(),
      closureRate: z.number().nullable(),
      elapsedDays: z.number(),
      closedPerDay: z.number().nullable(),
    })
    .nullable(),
});

export const gapClosureExplanationResponseSchema = z.object({
  subject: z.string(),
  text: z.string(),
});

const careerLevel = z.object({
  id: z.string(),
  name: z.string(),
  rank: z.number(),
});

export const careerLevelsResponseSchema = z.array(careerLevel);

const bandTone = z.enum(["ok", "low", "high", "critical"]);
const scoringBand = z.object({
  key: z.string(),
  minValue: z.number().nullable(),
  maxValue: z.number().nullable(),
  labelKey: z.string(),
  tone: bandTone,
  sortOrder: z.number(),
});
export const scoringBandsResponseSchema = z.object({
  GAP_SEVERITY: z.array(scoringBand).optional(),
  PROFICIENCY: z.array(scoringBand).optional(),
  CONCENTRATION_RISK: z.array(scoringBand).optional(),
});

export const scoringBandsPutResponseSchema = z.array(scoringBand);

export const textTemplatesResponseSchema = z.record(z.record(z.string()));

export const textTemplateRecordSchema = z.object({
  key: z.string(),
  locale: z.string(),
  template: z.string(),
});

export const curationPolicySchema = z.object({
  maxActiveCompetencies: z.number(),
  requiredRestrictive: z.number(),
  requiredNonRestrictive: z.number(),
});

const appSettingRecordSchema = z.object({
  key: z.string(),
  value: z.union([z.string(), z.number()]),
  valueType: z.string(),
  scope: z.string(),
  description: z.string().nullable(),
  updatedAt: z.string(),
  updatedBy: z.string().nullable(),
});

export const appSettingsResponseSchema = z.object({
  settings: z.array(appSettingRecordSchema),
});

export const appSettingPutResponseSchema = z.object({
  key: z.string(),
  value: z.union([z.string(), z.number()]),
});

export const vocabularyItemSchema = z.object({
  vocabulary: z.enum(VOCABULARY_NAMES),
  code: z.string(),
  labelKey: z.string(),
  sortOrder: z.number(),
  active: z.boolean(),
});

export const vocabulariesResponseSchema = z.object({
  EVIDENCE_TYPE: z.array(vocabularyItemSchema),
  LEARNING_ITEM_TYPE: z.array(vocabularyItemSchema),
  ACTION_TYPE: z.array(vocabularyItemSchema),
});

export const catalogImportSummarySchema = z.object({
  capabilitiesCreated: z.array(z.object({ id: z.string(), name: z.string() })),
  capabilitiesUpdated: z.array(z.object({ id: z.string(), name: z.string() })),
  competenciesCreated: z.array(
    z.object({ id: z.string(), name: z.string(), capabilityId: z.string() }),
  ),
  competenciesUpdated: z.array(
    z.object({ id: z.string(), name: z.string(), capabilityId: z.string() }),
  ),
});

const architect = z.object({
  id: z.string(),
  name: z.string(),
  role: roleName,
  careerLevelId: z.string().nullish(),
  yearsAsArchitect: z.number(),
  specialization: z.string(),
  primarySpecializationCompetencyId: z.string().nullish(),
  email: z.string(),
  active: z.boolean(),
  teamId: z.string().nullish(),
  version: z.number(),
});

const assessmentParticipantRole = z.enum(["PROFESSIONAL", "TECH_LEAD"]);

const assessmentComment = z.object({
  id: z.string(),
  authorUserId: z.string().nullable(),
  authorRole: assessmentParticipantRole,
  text: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

const assessmentItem = z.object({
  competencyId: z.string(),
  self: level.nullable(),
  leader: level.nullable(),
  target: level,
  final: level.nullable(),
  comments: z.array(assessmentComment),
  competencyName: z.string().optional(),
  capabilityId: z.string().optional(),
  capabilityName: z.string().optional(),
  requirementType: requirementType.optional(),
  version: z.number().optional(),
});

const assessment = z.object({
  id: z.string(),
  architectId: z.string(),
  cycleId: z.string(),
  status: z.enum(["Draft", "In Review", "Completed"]),
  items: z.array(assessmentItem),
  modelVersion: z.union([z.literal(1), z.literal(2)]),
  targetCareerLevelId: z.string().nullable(),
  targetSemantics: z.enum(["CURRENT_ROLE", "NEXT_ROLE", "MASTERY"]).nullable(),
  version: z.number(),
});

const developmentCycle = z.object({
  id: z.string(),
  name: z.string(),
  start: z.string(),
  end: z.string(),
  status: z.enum(["Active", "Closed", "Planned"]),
});

const smartGoal = z.object({
  specific: z.string(),
  measurable: z.string(),
  achievable: z.string(),
  relevant: z.string(),
  timeBound: z.string(),
  statement: z.string(),
});

const planItemCheckin = z.object({
  id: z.string(),
  authorUserId: z.string(),
  text: z.string(),
  createdAt: z.string(),
});

const developmentPlanItem = z.object({
  id: z.string(),
  competencyId: z.string(),
  currentLevel: level,
  targetLevel: level,
  objective: z.string(),

  actionType: z.string(),
  actionPlan: z.string(),
  startDate: z.string(),
  targetDate: z.string(),
  priority: z.enum(["Low", "Medium", "High", "Critical"]),
  owner: z.string(),
  status: z.enum(["Not Started", "In Progress", "Blocked", "Completed"]),
  smart: smartGoal.optional(),
  checkins: z.array(planItemCheckin),
  version: z.number(),
  sourceAssessmentId: z.string().nullish(),
  dedicationHoursPerWeek: z.number().nullish(),
});

const developmentPlan = z.object({
  id: z.string(),
  architectId: z.string(),
  cycleId: z.string(),
  status: z.enum(["Draft", "Approved", "Completed"]),
  items: z.array(developmentPlanItem),
  approvedByUserId: z.string().nullish(),
  approvedAt: z.string().nullish(),
  completedByUserId: z.string().nullish(),
  completedAt: z.string().nullish(),
  version: z.number(),
});

const learningPathItem = z.object({
  id: z.string(),
  title: z.string(),

  type: z.string(),
  url: z.string().optional(),
  description: z.string().optional(),
  hours: z.number(),
});

const learningItemProgress = z.object({
  architectId: z.string(),
  itemId: z.string(),
  status: z.enum(["Not Started", "In Progress", "Completed"]),
  progress: z.number(),
});

const learningPath = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  competencyIds: z.array(z.string()),
  assignedTo: z.array(z.string()),
  items: z.array(learningPathItem),
  progress: z.array(learningItemProgress),
  createdBy: z.string().nullish(),
  createdByUserId: z.string().nullish(),
  createdAt: z.string().optional(),
});

const mentoringSession = z.object({
  id: z.string(),
  mentor: z.string(),
  mentorUserId: z.string().nullish(),
  menteeId: z.string(),
  date: z.string(),
  durationMin: z.number(),
  topic: z.string(),
  competencyIds: z.array(z.string()),
  notes: z.string(),
  decisions: z.string(),
  actions: z.string(),
  nextSession: z.string().optional(),
});

const evidence = z.object({
  id: z.string(),
  architectId: z.string(),
  title: z.string(),
  description: z.string(),

  type: z.string(),
  competencyIds: z.array(z.string()),
  date: z.string(),
  project: z.string().optional(),
  url: z.string().optional(),
  complexity: z.enum(["Low", "Medium", "High"]),
  leaderComment: z.string().optional(),
  status: z.enum(["Pending", "Accepted", "Needs Improvement", "Rejected"]),
  issuer: z.string().optional(),
  developmentPlanItemId: z.string().nullish(),
  reviewedByUserId: z.string().nullish(),
  reviewedAt: z.string().nullish(),
});

export const appStateSchema = z.object({
  capabilities: z.array(capability),
  competencies: z.array(competency),
  teamLevelRules: z.array(teamLevelRule),
  architects: z.array(architect),
  assessments: z.array(assessment),
  cycles: z.array(developmentCycle),
  plans: z.array(developmentPlan),
  learningPaths: z.array(learningPath),
  mentoringSessions: z.array(mentoringSession),
  evidences: z.array(evidence),
  activeCycleId: z.string(),
});

export const architectsResponseSchema = z.array(architect);
export const assessmentsResponseSchema = z.array(assessment);
export const capabilitiesResponseSchema = z.array(capability);
export const competenciesResponseSchema = z.array(competency);
export const cyclesResponseSchema = z.array(developmentCycle);
export const plansResponseSchema = z.array(developmentPlan);
export const learningPathsResponseSchema = z.array(learningPath);
export const mentoringSessionsResponseSchema = z.array(mentoringSession);
export const evidencesResponseSchema = z.array(evidence);
export const activeCycleResponseSchema = z.object({ cycleId: z.string() });
