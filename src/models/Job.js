/**
 * @file Schema and indexes for scraped job listings.
 * @module models/Job
 */

import { Schema, model } from "mongoose";
import { verificationKeys as buildVerificationKeys } from '../jobVerification/urls.js';
import { buildJobSearchKeys } from "../utils/jobSearchKeys.js";
import { buildJobDerivedFields } from "../utils/jobDerivedFields.js";

const JobSkillSchema = new Schema(
  {
    skillId: { type: String, trim: true, required: true },
    canonicalName: { type: String, trim: true, required: true },
    category: { type: String, trim: true, required: true },
    required: { type: Boolean, default: false },
    preferred: { type: Boolean, default: false },
    confidence: { type: String, trim: true, default: "medium" },
    extractionSource: { type: String, trim: true, default: null },
    matchedPhrase: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const ExperienceProfileSchema = new Schema(
  {
    rawText: { type: String, trim: true, default: null },
    minimumYears: { type: Number, default: null },
    maximumYears: { type: Number, default: null },
    isOpenEnded: { type: Boolean, default: false },
    preferredMinimumYears: { type: Number, default: null },
    hasExplicitExperience: { type: Boolean, default: false },
    confidence: { type: String, trim: true, default: "low" },
    evidence: { type: String, trim: true, default: null },
    inferenceMethod: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const FilterSignalsSchema = new Schema(
  {
    confidence: {
      experience: { type: String, trim: true, default: "low" },
      seniority: { type: String, trim: true, default: "low" },
      roleDomain: { type: String, trim: true, default: "low" },
      workArrangement: { type: String, trim: true, default: "low" },
    },
  },
  { _id: false },
);

const isHttpUrl = (value) => {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

// Stores the observation of verified native availability, never a guessed
// time at which a vacancy closed. The complete native snapshot stays raw.
const SourceAvailabilitySchema = new Schema({
  version: Number,
  provenance: String,
  state: { type: String, enum: ['open', 'closed'] },
  source: String,
  jobId: String,
  canonicalRoleId: String,
  title: String,
  brand: String,
  employer: String,
  canonicalUrl: String,
  observedAt: Date,
  evidenceSha256: String,
}, { _id: false });

export const JobSchema = new Schema(
  {
    title: {
      type: String,
      trim: true,
      required: true,
    },
    originalTitle: { type: String, trim: true, default: null },
    normalizedTitle: { type: String, trim: true, default: null },
    company: {
      type: String,
      trim: true,
      required: true,
    },
    companyKey: { type: String, trim: true, default: null },
    companyDomain: { type: String, trim: true, default: null },
    jobCategory: { type: String, trim: true, default: null },
    engineeringDomain: { type: String, trim: true, default: null },
    employmentType: { type: String, trim: true, default: null },
    experienceLevel: { type: String, trim: true, default: null },
    experienceBasis: { type: String, trim: true, default: null },
    jobType: { type: String, trim: true },
    classification: {
      type: new Schema({
        policyVersion: String, inputHash: String, modelRevision: String, runtimeVersion: String,
        policyHash: String, runtimeHash: String, calibrationHash: String, referenceYear: Number,
        mode: { type: String, enum: ['shadow', 'policy', 'enforce'] }, authoritative: Boolean, decisionSource: String,
        status: { type: String, enum: ['accepted', 'uncertain', 'fallback'] }, reason: String,
        decisions: Schema.Types.Mixed, complete: Boolean, windows: Number, evidenceContext: String, classifiedAt: Date,
        nativeScan: Schema.Types.Mixed, comparison: Schema.Types.Mixed,
        sourceGuards: { type: [String], default: undefined },
        sourceQualityIssues: { type: [String], default: undefined },
        reviewReasons: { type: [String], default: undefined },
        resolved: Schema.Types.Mixed, previous: Schema.Types.Mixed,
      }, { _id: false }),
      default: undefined,
    },
    sourceEmploymentType: { type: String, trim: true, default: null },
    employerExperienceLevel: { type: String, trim: true, default: null },
    employerStreetAddress: { type: String, trim: true, default: null },
    postClassification: {
      type: new Schema({
        inputHash: String, mode: { type: String, enum: ['shadow', 'policy'] },
        status: { type: String, enum: ['pending', 'processing', 'completed', 'failed', 'skipped'] },
        owner: String, leaseUntil: Date, attemptedAt: Date, completedAt: Date,
        attempts: Number, reason: String, result: Schema.Types.Mixed,
      }, { _id: false }), default: undefined,
    },
    sourceExperienceRequired: { type: String, trim: true, default: null },
    location: { type: String, trim: true },
    city: { type: String, trim: true },
    // Stable source identity address, separate from corrected work locations.
    fingerprintLocation: { type: String, trim: true },
    cityKey: { type: String, trim: true, default: null },
    publicCityKey: { type: String, trim: true, default: null },
    state: { type: String, trim: true, default: null },
    country: { type: String, trim: true, default: null },
    remoteStatus: { type: String, trim: true, default: null },
    locations: { type: [String], default: [] },
    locationKeys: { type: [String], default: [] },
    department: { type: String, trim: true },
    eligibleBatches: { type: [Number], default: [] },
    eligibleBatchesProvenance: { type: String, enum: ['source', null], default: null },
    branches: { type: [String], default: [] },
    requiredSkills: { type: [String], default: [] },
    source: { type: String },
    sourceUrl: {
      type: String,
      validate: {
        validator: isHttpUrl,
        message: "sourceUrl must be an http(s) URL",
      },
    },
    applyUrl: {
      type: String,
      default: null,
      validate: {
        validator: isHttpUrl,
        message: "applyUrl must be an http(s) URL",
      },
    },
    applicationUrlIsGeneric: { type: Boolean, default: false },
    companyCareerPage: {
      type: String,
      default: null,
      validate: {
        validator: isHttpUrl,
        message: "companyCareerPage must be an http(s) URL",
      },
    },
    atsPlatform: { type: String, trim: true, default: null },
    workdayApplicationStatus: {
      type: String,
      enum: ["available", "temporarily_unavailable", "unavailable"],
      default: null,
    },
    workdayApplicationStatusReason: { type: String, trim: true, default: null },
    workdayApplicationStatusCheckedAt: { type: Date, default: null },
    description: { type: String, trim: true, default: null },
    sourceDescription: { type: String, default: undefined },
    sourceContentHash: { type: String, default: undefined },
    sourceContentHashVersion: { type: Number, default: undefined },
    descriptionFormat: { type: String, enum: ['plain', 'markdown'], default: 'plain' },
    descriptionRewrite: {
      type: new Schema({
        status: { type: String, enum: ['baseline', 'pending', 'published', 'failed', 'skipped'] },
        inputHash: String, reason: String, modelRevision: String, runtimeTag: String, policyVersion: String,
        queuedAt: Date, attemptedAt: Date, publishedAt: Date, nextAttemptAt: Date, attempts: Number,
        durationMs: Number, wordCount: Number,
        quality: { method: String, outcome: { type: String, enum: ['model_edited', 'source_preserved', 'source_fallback', 'metadata_only'] },
          factCoverage: Number, sourceFacts: Number, sourceChunks: Number, contentSections: Number, longestFactWords: Number, addedClaims: Number,
          modelEditedBlocks: Number, modelWordingEditedBlocks: Number, modelLayoutEditedBlocks: Number,
          sourcePreservedBlocks: Number, protectedSourceBlocks: Number, sourceFallbackBlocks: Number,
          layoutParagraphBreaks: Number, fullSourceCoverage: Boolean },
      }, { _id: false }), default: undefined,
    },
    minimumQualification: { type: String, trim: true, default: null },
    preferredQualification: { type: String, trim: true, default: null },
    experienceRequired: { type: String, trim: true, default: null },
    publicExperienceChecked: { type: Boolean, default: false },
    salary: { type: String, trim: true, default: null },
    skillIds: { type: [String], default: [] },
    requiredSkillIds: { type: [String], default: [] },
    preferredSkillIds: { type: [String], default: [] },
    jobSkills: { type: [JobSkillSchema], default: [] },
    experienceBucket: { type: String, trim: true, default: "unspecified" },
    experienceYears: { type: [Number], default: [] },
    experienceProfile: {
      type: ExperienceProfileSchema,
      default: () => ({}),
    },
    seniority: { type: String, trim: true, default: "Unknown" },
    primaryRoleDomain: { type: String, trim: true, default: "Other" },
    secondaryRoleDomains: { type: [String], default: [] },
    workArrangement: { type: String, trim: true, default: "On-site" },
    filterSignals: {
      type: FilterSignalsSchema,
      default: () => ({}),
    },
    taxonomyVersion: { type: String, trim: true, default: null },
    extractionVersion: { type: String, trim: true, default: null },
    extractedAt: { type: Date, default: null },
    jobId: { type: String, trim: true, default: null },
    requisitionId: { type: String, trim: true, default: null },
    verificationKeys: { type: [String], default: undefined },
    fingerprint: {
      type: String,
      required: true,
      unique: true,
    },
    employerPostedAt: { type: Date, default: undefined },
    postedAt: { type: Date },
    postedAtProvenance: { type: String, enum: ['source', 'observation'], default: undefined },
    postedAtProvenanceValue: { type: String, default: undefined },
    sortDate: { type: Date, default: null },
    closingDate: { type: Date },
    sourceAvailability: { type: SourceAvailabilitySchema, default: undefined },
    scrapedAt: { type: Date, default: Date.now },
    scrapedTimestamp: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    missedScrapeCount: { type: Number, default: 0, min: 0 },
    lastMissedScrapeRunId: { type: String, default: null },
    status: {
      type: String,
      enum: ["active", "expired", "hidden"],
      default: "active",
      index: true,
    },
    isPublicIndia: { type: Boolean, default: false, index: true },
    clickCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    strict: true,
  },
);

JobSchema.pre("validate", function setJobSearchKeys(next) {
  Object.assign(this, buildJobSearchKeys(this), buildJobDerivedFields(this));
  this.verificationKeys = buildVerificationKeys(this);
  next();
});

JobSchema.index({ status: 1, isPublicIndia: 1, sortDate: -1, _id: -1 });
JobSchema.index({ status: 1, closingDate: 1 }); // query: roles closing soon
JobSchema.index({ status: 1, isPublicIndia: 1, clickCount: -1, sortDate: -1, _id: -1 }); // popularity sort
JobSchema.index({ status: 1, company: 1 }); // query meta & company queries
JobSchema.index({ status: 1, city: 1 }); // query meta & city queries
JobSchema.index({ status: 1, isPublicIndia: 1, companyKey: 1, sortDate: -1, _id: -1 });
JobSchema.index({ status: 1, isPublicIndia: 1, locationKeys: 1, sortDate: -1, _id: -1 });
JobSchema.index({ status: 1, isPublicIndia: 1, companyKey: 1, locationKeys: 1, sortDate: -1, _id: -1 });
JobSchema.index({ source: 1, status: 1, missedScrapeCount: 1 });
JobSchema.index({ source: 1, status: 1, lastSeenAt: 1 });
JobSchema.index({ applicationUrlIsGeneric: 1, applyUrl: 1 }, {
  name: 'shared_application_surface',
  partialFilterExpression: { applicationUrlIsGeneric: true },
});
JobSchema.index({ location: 1 });
JobSchema.index({ city: 1 });
JobSchema.index({ locations: 1 });
JobSchema.index({ department: 1 });
JobSchema.index({ jobType: 1 });
JobSchema.index({ normalizedTitle: 1 });
JobSchema.index({ engineeringDomain: 1 });
JobSchema.index({ companyDomain: 1 });
JobSchema.index({ status: 1, skillIds: 1 });
JobSchema.index({ status: 1, requiredSkillIds: 1 });
JobSchema.index({ status: 1, experienceBucket: 1 });
JobSchema.index({ status: 1, experienceYears: 1 });
JobSchema.index({ status: 1, isPublicIndia: 1, experienceYears: 1, sortDate: -1, _id: -1 });
JobSchema.index({ status: 1, seniority: 1 });
JobSchema.index({ status: 1, primaryRoleDomain: 1 });
JobSchema.index({ status: 1, workArrangement: 1 });
JobSchema.index({ secondaryRoleDomains: 1 });
JobSchema.index({ jobId: 1 });
JobSchema.index({ requisitionId: 1 });
JobSchema.index({ verificationKeys: 1 }, { name: 'verification_identity' });
JobSchema.index({ sourceUrl: 1 }, { name: 'verification_source_url' });
JobSchema.index({ applyUrl: 1 }, { name: 'verification_apply_url' });
JobSchema.index({ eligibleBatches: 1 });
JobSchema.index({ branches: 1 });
JobSchema.index({ createdAt: -1 });
JobSchema.index(
  {
    title: "text",
    company: "text",
    experienceRequired: "text",
    requiredSkills: "text",
  },
  {
    name: "job_search_text",
    weights: {
      title: 10,
      company: 8,
      requiredSkills: 5,
      experienceRequired: 3,
    },
  },
);

JobSchema.set("toJSON", {
  // Transforms database document representation for API JSON responses.
  transform: (doc, ret) => {
    delete ret.__v;
    if (ret._id) ret.id = ret._id;
    return ret;
  },
});

const Job = model("Job", JobSchema);

export default Job;
