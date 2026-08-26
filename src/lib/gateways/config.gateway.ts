import {
  appSettingPutResponseSchema,
  appSettingsResponseSchema,
  curationPolicySchema,
  scoringBandsPutResponseSchema,
  scoringBandsResponseSchema,
  textTemplateRecordSchema,
  textTemplatesResponseSchema,
  vocabulariesResponseSchema,
  vocabularyItemSchema,
} from "../api-schemas";
import type { ApiClient } from "../api-client";
import type { CurationPolicy } from "../curation-policy";
import type { AppSettingsResponse, AppSettingValue } from "../operational-settings";
import type { ScoringBand, ScoringScale } from "../scoring-bands";
import type { Vocabularies, VocabularyItem, VocabularyName } from "../vocabularies";

export interface VocabularyItemInput {
  labelKey: string;
  sortOrder?: number | undefined;
  active?: boolean | undefined;
}

export interface VocabularyItemPatch {
  labelKey?: string | undefined;
  sortOrder?: number | undefined;
  active?: boolean | undefined;
}

export interface TextTemplateRecord {
  key: string;
  locale: string;
  template: string;
}

export interface AppSettingUpdate {
  key: string;
  value: AppSettingValue;
}

export type ScoringBandsResponse = { [K in ScoringScale]?: ScoringBand[] | undefined };

export type TextTemplatesResponse = Record<string, Record<string, string>>;

export interface ConfigGateway {
  bands(): Promise<ScoringBandsResponse>;
  templates(): Promise<TextTemplatesResponse>;

  updateScoringBands(scale: ScoringScale, bands: ScoringBand[]): Promise<ScoringBand[]>;

  updateTextTemplate(key: string, locale: string, template: string): Promise<TextTemplateRecord>;

  curationPolicy(): Promise<CurationPolicy>;

  updateCurationPolicy(policy: CurationPolicy): Promise<CurationPolicy>;

  settings(): Promise<AppSettingsResponse>;

  updateSetting(key: string, value: AppSettingValue): Promise<AppSettingUpdate>;

  vocabularies(): Promise<Vocabularies>;

  addVocabularyItem(
    vocabulary: VocabularyName,
    code: string,
    input: VocabularyItemInput,
  ): Promise<VocabularyItem>;

  updateVocabularyItem(
    vocabulary: VocabularyName,
    code: string,
    patch: VocabularyItemPatch,
  ): Promise<VocabularyItem>;
}

export class HttpConfigGateway implements ConfigGateway {
  constructor(private readonly client: ApiClient) {}

  bands = (): Promise<ScoringBandsResponse> =>
    this.client
      .request<ScoringBandsResponse>("/api/config/bands")
      .then((data) => scoringBandsResponseSchema.parse(data));

  templates = (): Promise<TextTemplatesResponse> =>
    this.client
      .request<TextTemplatesResponse>("/api/config/templates")
      .then((data) => textTemplatesResponseSchema.parse(data));

  updateScoringBands = (scale: ScoringScale, bands: ScoringBand[]): Promise<ScoringBand[]> =>
    this.client
      .put<ScoringBand[]>(`/api/config/bands/${scale}`, { bands })
      .then((data) => scoringBandsPutResponseSchema.parse(data));

  updateTextTemplate = (
    key: string,
    locale: string,
    template: string,
  ): Promise<TextTemplateRecord> =>
    this.client
      .put<TextTemplateRecord>(
        `/api/config/templates/${encodeURIComponent(key)}/${encodeURIComponent(locale)}`,
        { template },
      )
      .then((data) => textTemplateRecordSchema.parse(data));

  curationPolicy = (): Promise<CurationPolicy> =>
    this.client
      .request<CurationPolicy>("/api/config/curation-policy")
      .then((data) => curationPolicySchema.parse(data));

  updateCurationPolicy = (policy: CurationPolicy): Promise<CurationPolicy> =>
    this.client
      .put<CurationPolicy>("/api/config/curation-policy", policy)
      .then((data) => curationPolicySchema.parse(data));

  settings = (): Promise<AppSettingsResponse> =>
    this.client
      .request<AppSettingsResponse>("/api/config/settings")
      .then((data) => appSettingsResponseSchema.parse(data));

  updateSetting = (key: string, value: AppSettingValue): Promise<AppSettingUpdate> =>
    this.client
      .put<AppSettingUpdate>(`/api/config/settings/${encodeURIComponent(key)}`, { value })
      .then((data) => appSettingPutResponseSchema.parse(data));

  vocabularies = (): Promise<Vocabularies> =>
    this.client
      .request<Vocabularies>("/api/config/vocabularies")
      .then((data) => vocabulariesResponseSchema.parse(data));

  addVocabularyItem = (
    vocabulary: VocabularyName,
    code: string,
    input: VocabularyItemInput,
  ): Promise<VocabularyItem> =>
    this.client
      .post<VocabularyItem>(
        `/api/config/vocabularies/${vocabulary}/${encodeURIComponent(code)}`,
        input,
      )
      .then((data) => vocabularyItemSchema.parse(data));

  updateVocabularyItem = (
    vocabulary: VocabularyName,
    code: string,
    patch: VocabularyItemPatch,
  ): Promise<VocabularyItem> =>
    this.client
      .patch<VocabularyItem>(
        `/api/config/vocabularies/${vocabulary}/${encodeURIComponent(code)}`,
        patch,
      )
      .then((data) => vocabularyItemSchema.parse(data));
}
