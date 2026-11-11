/**
 * @file Persists scraped jobs to MongoDB with upsert-based deduplication.
 * @module scraper/utils/saveToDB
 */

import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import './cityNormalizer.js'
import { filterIndiaJobs } from './indiaLocationFilter.js'
import { extractionDetailHealth } from './extractionDetailHealth.js'
import { sourceLifecycleCleanupForbidden } from './inventoryEvidence.js'
import { normalizeEmployerDisclosures } from '../../src/utils/employerDisclosures.js'
import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import {
  formatStoredLocationLabel,
  getPrimaryStoredLocation,
  normalizeStoredLocations,
} from '../../src/utils/jobLocations.js'
import { buildJobSearchKeys } from '../../src/utils/jobSearchKeys.js'
import { verificationKeys } from '../../src/jobVerification/urls.js'
import { buildJobDerivedFields } from '../../src/utils/jobDerivedFields.js'
import {
  normalizeLifecycleDate,
  resolveJobMissesBeforeExpiry,
} from '../../src/utils/jobLifecycle.js'
import { resolveJobPublicationDate } from '../../src/utils/jobPublicationDate.js'
import { explicitNativeWorkArrangement, normalizePublicWorkArrangement } from '../../src/utils/publicWorkArrangement.js'
import { normalizeScrapedJob, resolveJobType } from './normalizeScrapedJob.js'
import { applicationIdentityLookup, applicationPersistenceFilter, coalesceApplicationIdentities, generateFingerprint, resolveApplicationIdentities } from './applicationIdentity.js'
export { generateFingerprint } from './applicationIdentity.js'
import { enrichJobsWithPublicExperience } from './publicExperienceEnrichment.js'
import { persistJobChangesWithAlertOutbox } from '../../src/services/jobAlertOutboxService.js'
import { saveLocalJobOutbox } from './localJobOutbox.js'
import { buildDescriptionSourceUpdate } from '../../src/services/jobDescriptionPolicy.js'
import { getSourceDescription, hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { postScrapePersistencePatch } from '../../src/services/postScrapeClassification.js'
import { getAuthoritativeClassification } from '../../src/services/jobClassificationPolicy.js'
import { correctExistingSourceLifecycleDates } from './sourceLifecycleCorrection.js'
import { correctExistingNativeAvailability, nativeAvailabilityTransition } from './sourceAvailabilityPersistence.js'
import { supportsNativeRoleAvailability } from './sourceAvailability.js'
import { refreshJobDatasetSummary } from '../../src/services/jobDatasetSummaryService.js'
import {
  analyzePublishableJobs,
  normalizeHttpUrl,
} from './publishableJobMetrics.js'

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env'), quiet: true })

// Lazy-load Job to avoid circular import issues when this module is used standalone
let Job
const getJobModel = async () => {
  if (!Job) {
    const { default: model } = await import('../../src/models/Job.js')
    Job = model
  }
  return Job
}

const ensureConnected = async () => {
  if (mongoose.connection.readyState === 0) {
    const { default: connectDB } = await import('../../db/db.js')
    await connectDB()
  }
}

const hasLiveDatabaseHandle = () => mongoose.connection.readyState === 1 && mongoose.connection.db != null

export const DEFAULT_EXPIRED_JOB_PURGE_RETENTION_DAYS = 30
export const DEFAULT_QUOTA_RECOVERY_TARGET_BYTES = 10 * 1024 * 1024

const resolvePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const estimateJobDocumentBytes = (job) => Buffer.byteLength(
  JSON.stringify(job),
  'utf8',
)

/**
 * Physically deletes the oldest expired jobs, bounded by an estimated document
 * size. This is deliberately limited to expired records so quota recovery can
 * never remove listings that are still publicly visible.
 */
export const purgeExpiredJobsForQuotaRecovery = async ({
  jobModel = null,
  now = new Date(),
  retentionDays = DEFAULT_EXPIRED_JOB_PURGE_RETENTION_DAYS,
  targetBytes = DEFAULT_QUOTA_RECOVERY_TARGET_BYTES,
  batchSize = 100,
  dryRun = false,
} = {}) => {
  const JobModel = jobModel || await getJobModel()
  if (!jobModel) await ensureConnected()

  const normalizedNow = normalizeLifecycleDate(now) || new Date()
  const normalizedRetentionDays = resolvePositiveInteger(
    retentionDays,
    DEFAULT_EXPIRED_JOB_PURGE_RETENTION_DAYS,
  )
  const normalizedTargetBytes = resolvePositiveInteger(
    targetBytes,
    DEFAULT_QUOTA_RECOVERY_TARGET_BYTES,
  )
  const normalizedBatchSize = resolvePositiveInteger(batchSize, 100)
  const cutoff = new Date(normalizedNow)
  cutoff.setUTCDate(cutoff.getUTCDate() - normalizedRetentionDays)

  let deletedCount = 0
  let estimatedBytes = 0
  let dryRunCursor = null

  while (estimatedBytes < normalizedTargetBytes) {
    const candidateFilter = {
      status: 'expired',
      lastSeenAt: { $lt: cutoff },
    }

    if (dryRunCursor) {
      candidateFilter.$or = [
        {
          lastSeenAt: {
            $gt: dryRunCursor.lastSeenAt,
            $lt: cutoff,
          },
        },
        {
          lastSeenAt: dryRunCursor.lastSeenAt,
          _id: { $gt: dryRunCursor.id },
        },
      ]
    }

    const candidates = await JobModel.find(candidateFilter)
      .sort({ lastSeenAt: 1, _id: 1 })
      .limit(normalizedBatchSize)
      .lean()
      .exec()

    if (!candidates.length) break

    const selected = []
    for (const candidate of candidates) {
      selected.push(candidate)
      estimatedBytes += estimateJobDocumentBytes(candidate)
      if (estimatedBytes >= normalizedTargetBytes) break
    }

    if (!dryRun) {
      const deletion = JobModel.deleteMany({
        _id: { $in: selected.map((job) => job._id) },
        status: 'expired',
      })
      const deleteResult = typeof deletion?.exec === 'function'
        ? await deletion.exec()
        : await deletion
      deletedCount += deleteResult.deletedCount ?? 0
    } else {
      deletedCount += selected.length
      const lastSelected = selected[selected.length - 1]
      dryRunCursor = {
        lastSeenAt: lastSelected.lastSeenAt,
        id: lastSelected._id,
      }
    }

    if (selected.length < candidates.length || estimatedBytes >= normalizedTargetBytes) break
    if (dryRun && candidates.length < normalizedBatchSize) break
  }

  return {
    dryRun,
    deletedCount,
    estimatedBytes,
    targetBytes: normalizedTargetBytes,
    retentionDays: normalizedRetentionDays,
    cutoff,
  }
}

/**
 * Saves an array of scraped jobs to MongoDB.
 *
 * - Upserts the latest scraped set for the scraper source first.
 * - Soft-expires unseen jobs only after consecutive successful scraper misses.
 * - Keeps jobs with no posted date, because the scraper cannot prove they are stale.
 * - Keeps open scraped jobs regardless of their posting date.
 *
 * @param {object[]} jobs   Array of job objects from a scraper's run()
 * @param {string}   source Scraper identifier e.g. 'airbus', 'rubrik', 'google'
 * @param {object}   options Optional persistence controls
 * @returns {{ inserted: number, updated: number, deleted: number, filteredOld: number }}
 */
// Infers a job type from title keywords since career pages rarely expose it as structured data.
const inferJobType = (title = '') => {
  const t = title.toLowerCase()
  if (/intern|internship|trainee|apprentice/i.test(t)) return 'Internship'
  if (/contract|contractor|freelance/i.test(t)) return 'Contract'
  if (/part.?time/i.test(t)) return null
  return 'Full-time'
}

const emitStage = (source, onStage, event = {}) => {
  if (typeof onStage !== 'function') return

  onStage({
    source,
    ...event,
  })
}

const getAbortReason = signal => signal.reason

const throwIfAborted = (signal) => {
  if (signal?.aborted) {
    throw getAbortReason(signal)
  }
}

const checkedStageCallback = (callback, signal) => {
  if (typeof callback !== 'function') return callback
  return event => {
    try { return callback(event) }
    finally { throwIfAborted(signal) }
  }
}

const runStage = async (source, onStage, stage, operation, details = {}, { signal = null } = {}) => {
  throwIfAborted(signal)
  const startedAt = Date.now()
  emitStage(source, onStage, {
    stage,
    status: 'start',
    ...details,
  })

  try {
    throwIfAborted(signal)
    const result = await operation()
    throwIfAborted(signal)
    emitStage(source, onStage, {
      stage,
      status: 'done',
      durationMs: Date.now() - startedAt,
      ...details,
    })
    throwIfAborted(signal)
    return result
  } catch (error) {
    emitStage(source, onStage, {
      stage,
      status: 'error',
      durationMs: Date.now() - startedAt,
      error: error?.message || String(error),
      ...details,
    })
    throwIfAborted(signal)
    throw error
  }
}

export const saveToDB = async (jobs, source, options = {}) => {
  const signal = options.signal || null
  throwIfAborted(signal)
  let JobModel
  try {
    await ensureConnected()
    throwIfAborted(signal)
    JobModel = await getJobModel()
  } catch (error) {
    throwIfAborted(signal)
    throw error
  }
  const onStage = checkedStageCallback(options.onStage, signal)
  throwIfAborted(signal)

  const now = normalizeLifecycleDate(options.now) || new Date()
  const missesBeforeExpiry = resolveJobMissesBeforeExpiry(
    options.missesBeforeExpiry ?? process.env.SCRAPER_JOB_MISSES_BEFORE_EXPIRY,
  )
  const {
    indiaJobs,
    eligibleJobs,
    filterCounts,
  } = analyzePublishableJobs(jobs, {
    now,
  })

  const enrichedJobs = options.enrichPublicExperience === false
    ? (() => {
        emitStage(source, onStage, {
          stage: 'enrichment',
          status: 'skipped',
          jobs: eligibleJobs.length,
        })
        return eligibleJobs
      })()
    : await runStage(
        source,
        onStage,
        'enrichment',
        () => enrichJobsWithPublicExperience(eligibleJobs, {
          fetchText: options.fetchText,
          fetchBrowserText: options.fetchBrowserText,
          concurrency: options.experienceEnrichmentConcurrency,
          useBrowserFallback: options.useBrowserFallback,
          signal,
          fetchTimeoutMs: options.fetchTimeoutMs,
          pdfTextExtractionTimeoutMs: options.pdfTextExtractionTimeoutMs,
        }),
        { jobs: eligibleJobs.length },
        { signal },
      )
  throwIfAborted(signal)

  // Retain incoming evidence before legacy normalization can invent a city
  // default. The private symbol survives identity coalescing, never JSON/DB.
  const incomingWorkMode = Symbol('incoming-native-work-mode')
  const normalizedJobs = enrichedJobs.map(job => ({ ...normalizeScrapedJob(job, { source }),
    [incomingWorkMode]: { hasExplicitFlag: typeof job.sourceRemoteStatusUnresolved === 'boolean',
      explicitStatus: explicitNativeWorkArrangement(job), location: job.location, locations: job.locations },
  }))
  const rewriteMode = options.descriptionRewriteMode || process.env.JOB_DESCRIPTION_REWRITE_MODE || 'off'
  if (!['off', 'publish'].includes(rewriteMode)) throw new Error('JOB_DESCRIPTION_REWRITE_MODE must be off or publish')
  const existingJobs = enrichedJobs.length === 0 || (rewriteMode === 'off' && !hasLiveDatabaseHandle())
    ? []
    : await JobModel.find(applicationIdentityLookup(normalizedJobs))
      .select('fingerprint jobId requisitionId applicationUrlIsGeneric applyUrl sourceUrl city classification postClassification scrapedAt scrapedTimestamp title originalTitle company location salary description sourceDescription sourceContentHash sourceContentHashVersion descriptionFormat descriptionRewrite minimumQualification preferredQualification requiredSkills publicExperienceChecked sourceEmploymentType sourceExperienceRequired sourceNativeExperienceConflict employerExperienceLevel employerStreetAddress postedAt sortDate postedAtProvenance postedAtProvenanceValue eligibleBatches eligibleBatchesProvenance jobType employmentType experienceRequired experienceLevel seniority experienceYears experienceBucket experienceProfile sourceRemoteStatusUnresolved remoteStatus workArrangement')
      .lean().exec()
  const identities = coalesceApplicationIdentities(resolveApplicationIdentities(normalizedJobs, existingJobs))
  const existingByKey = new Map(identities.filter(identity => identity.previous).map(identity => [identity.fingerprint, identity.previous]))
  const retainedNativeWorkMode = (job, previous) => {
    const incoming = job[incomingWorkMode]
    if (previous?.sourceRemoteStatusUnresolved !== true || !incoming || incoming.hasExplicitFlag) return {}
    const literalStatus = normalizeScrapedJob({ location: incoming.location, locations: incoming.locations,
      remoteStatus: null, sourceRemoteStatusUnresolved: true }).remoteStatus
    return { sourceRemoteStatusUnresolved: true,
      remoteStatus: incoming.explicitStatus || literalStatus || previous.remoteStatus || null,
      workArrangement: previous.workArrangement }
  }
  const sourceJobs = identities.map(({ job, previous }) => {
    if (job.preserveExistingSourceContent !== true
      && job.preserveExistingSourceDescription === true && !hasSourceDescription(job) && previous) {
      // A listing can supply fresh native experience without a new description.
      // Retain the matched role's omitted facts; normal hashing and deferred
      // classification still see the new employer evidence.
      const sourceDescription = getSourceDescription(previous)
      const hasFreshExperience = job.sourceExperienceRequired !== null && job.sourceExperienceRequired !== undefined
      return { ...previous, ...job,
        sourceDescription, jobDescription: sourceDescription,
        sourceEmploymentType: job.sourceEmploymentType ?? previous.sourceEmploymentType,
        sourceExperienceRequired: job.sourceExperienceRequired ?? previous.sourceExperienceRequired,
        sourceNativeExperienceConflict: Object.hasOwn(job, 'sourceNativeExperienceConflict')
          ? job.sourceNativeExperienceConflict : previous.sourceNativeExperienceConflict,
        employerExperienceLevel: job.employerExperienceLevel ?? previous.employerExperienceLevel,
        employerStreetAddress: job.employerStreetAddress ?? previous.employerStreetAddress,
        minimumQualification: job.minimumQualification ?? previous.minimumQualification,
        preferredQualification: job.preferredQualification ?? previous.preferredQualification,
        requiredSkills: job.requiredSkills?.length ? job.requiredSkills : previous.requiredSkills || [],
        eligibleBatches: job.eligibleBatchesProvenance === 'source' ? job.eligibleBatches : previous.eligibleBatches,
        eligibleBatchesProvenance: job.eligibleBatchesProvenance === 'source' ? 'source' : previous.eligibleBatchesProvenance,
        employmentType: job.sourceEmploymentType ? job.employmentType : previous.employmentType,
        experienceRequired: hasFreshExperience ? job.sourceExperienceRequired : previous.experienceRequired,
        publicExperienceChecked: job.publicExperienceChecked === true || previous.publicExperienceChecked === true,
        salary: job.salary ?? previous.salary,
        ...retainedNativeWorkMode(job, previous),
      }
    }
    if (job.preserveExistingSourceContent !== true) return job
    // A fresh detail response supersedes the fallback flag and prior decision.
    if (hasSourceDescription(job)) return { ...job, preserveExistingSourceContent: false }
    if (!previous) return job
    return { ...previous, ...job, ...retainedNativeWorkMode(job, previous),
      sourceDescription: getSourceDescription(previous), jobDescription: getSourceDescription(previous),
      sourceEmploymentType: previous.sourceEmploymentType,
      sourceExperienceRequired: previous.sourceExperienceRequired,
      sourceNativeExperienceConflict: previous.sourceNativeExperienceConflict,
      employerExperienceLevel: previous.employerExperienceLevel,
      employerStreetAddress: previous.employerStreetAddress,
      minimumQualification: previous.minimumQualification,
      preferredQualification: previous.preferredQualification,
      eligibleBatches: previous.eligibleBatches,
      eligibleBatchesProvenance: previous.eligibleBatchesProvenance,
      employmentType: previous.employmentType,
      experienceRequired: previous.experienceRequired,
      // A partial listing has no new eligibility evidence. Retain the last
      // source-backed category, including an authoritative unknown result.
      jobType: getAuthoritativeClassification(previous)?.jobType ?? previous.jobType }
  })
  const jobsForPersistence = sourceJobs
  emitStage(source, onStage, { stage: 'classification', status: 'deferred', jobs: sourceJobs.length })
  throwIfAborted(signal)

  const observationInitializations = []
  const availabilityTransitions = []
  const operations = jobsForPersistence.map((job, index) => {
    const normalizedJob = normalizeScrapedJob({ ...job,
      classification: job.preserveExistingSourceContent === true ? identities[index].previous?.classification : undefined,
    }, { source })
    const fingerprint = generateFingerprint(normalizedJob)
    const sourceUrl = normalizeHttpUrl(normalizedJob.sourceUrl)
    const applyUrl = normalizeHttpUrl(normalizedJob.applyUrl) || sourceUrl
    const publicationDate = resolveJobPublicationDate(normalizedJob)
    const observationOnly = publicationDate.provenance === 'observation'
    const previous = existingByKey.get(fingerprint)
    const postedAt = observationOnly
      ? normalizeLifecycleDate(previous?.postedAt) || publicationDate.date
      : publicationDate.date
    const sortDate = observationOnly
      ? normalizeLifecycleDate(previous?.sortDate) || postedAt : postedAt
    const jobSource = normalizedJob.source || source
    if (observationOnly && jobSource === source
      && (previous?.postedAt == null || previous?.sortDate == null)) {
      const missingPostingDate = { $eq: [{ $ifNull: ['$postedAt', null] }, null] }
      const roleField = normalizedJob.requisitionId ? 'requisitionId'
        : normalizedJob.jobId ? 'jobId' : 'title'
      observationInitializations.push({ updateOne: {
        filter: { source, fingerprint, [roleField]: normalizedJob[roleField],
          $or: [{ postedAt: null }, { sortDate: null }] },
        // Expressions read the document at write time. A concurrent source
        // date or earlier observer wins, and each existing date is preserved.
        update: [{ $set: {
          postedAt: { $ifNull: ['$postedAt', { $literal: now }] },
          sortDate: { $ifNull: ['$sortDate', { $ifNull: ['$postedAt', { $literal: now }] }] },
          postedAtProvenance: { $cond: [missingPostingDate, 'observation', '$postedAtProvenance'] },
          postedAtProvenanceValue: { $cond: [missingPostingDate,
            { $literal: now.toISOString() }, '$postedAtProvenanceValue'] },
        } }],
        upsert: false, timestamps: false,
      } })
    }
    const closingDate = normalizeLifecycleDate(normalizedJob.closingDate)
    // Calendar-only source dates include the entire UTC day. Public queries use
    // an exclusive instant cutoff; preserve exact and legacy dates unchanged.
    if (closingDate && normalizedJob.sourceClosingDateIsExact === false) {
      closingDate.setUTCHours(24, 0, 0, 0)
    }
    const locations = normalizeStoredLocations(normalizedJob)
    const locationLabel = formatStoredLocationLabel(normalizedJob)
    const primaryLocation = getPrimaryStoredLocation(normalizedJob)
    const finalCity = getValidIndiaCityForJob(normalizedJob)
    const persistedJob = {
      ...normalizedJob,
      location: locationLabel || primaryLocation || null,
      locations,
      city: finalCity,
      postedAt,
      postingDate: postedAt,
      sortDate,
      // Deferred classification must see the provenance of the preserved
      // stored date, including an absent legacy marker, rather than the new
      // observation anchor that was normalized for this scrape.
      ...(observationOnly && normalizeLifecycleDate(previous?.postedAt) && {
        postedAtProvenance: previous.postedAtProvenance,
        postedAtProvenanceValue: previous.postedAtProvenanceValue,
      }),
      scrapedAt: normalizedJob.scrapedTimestamp || now,
    }
    const availabilityTransition = nativeAvailabilityTransition({
      job: normalizedJob, source, fingerprint, sourceUrl, now,
    })
    if (availabilityTransition) availabilityTransitions.push(availabilityTransition)
    const searchKeys = buildJobSearchKeys(persistedJob)
    const derivedFields = buildJobDerivedFields(persistedJob)
    const preserveExistingSourceContent = normalizedJob.preserveExistingSourceContent === true
    const descriptionUpdates = buildDescriptionSourceUpdate({ ...persistedJob, sourceDescription: getSourceDescription(job) }, existingByKey.get(fingerprint), { mode: rewriteMode, now })
    const sourceContentUpdates = preserveExistingSourceContent
      ? {}
      : {
          ...descriptionUpdates,
          sourceEmploymentType: normalizedJob.sourceEmploymentType || null,
          sourceExperienceRequired: normalizedJob.sourceExperienceRequired ?? null,
          sourceNativeExperienceConflict: normalizedJob.sourceNativeExperienceConflict ?? null,
          ...normalizeEmployerDisclosures(normalizedJob),
          eligibleBatches: normalizedJob.eligibleBatches || [],
          eligibleBatchesProvenance: normalizedJob.eligibleBatchesProvenance === 'source' ? 'source' : null,
          minimumQualification: normalizedJob.minimumQualification,
          preferredQualification: normalizedJob.preferredQualification,
          requiredSkills: normalizedJob.requiredSkills,
          experienceRequired: normalizedJob.experienceRequired,
          publicExperienceChecked: normalizedJob.publicExperienceChecked === true,
          salary: normalizedJob.salary,
          engineeringDomain: normalizedJob.engineeringDomain,
          experienceLevel: normalizedJob.experienceLevel,
          seniority: normalizedJob.seniority || 'Unknown',
          primaryRoleDomain: normalizedJob.primaryRoleDomain || 'Other',
          secondaryRoleDomains: normalizedJob.secondaryRoleDomains || [],
          workArrangement: normalizePublicWorkArrangement(normalizedJob.workArrangement, normalizedJob),
          skillIds: normalizedJob.skillIds || [],
          requiredSkillIds: normalizedJob.requiredSkillIds || [],
          preferredSkillIds: normalizedJob.preferredSkillIds || [],
          jobSkills: normalizedJob.jobSkills || [],
          experienceBucket: normalizedJob.experienceBucket || 'unspecified',
          experienceYears: normalizedJob.experienceYears || [],
          experienceProfile: normalizedJob.experienceProfile || {},
          filterSignals: normalizedJob.filterSignals || {},
          taxonomyVersion: normalizedJob.taxonomyVersion || null,
          extractionVersion: normalizedJob.extractionVersion || null,
          extractedAt: normalizedJob.extractedAt || now,
        }

    const deferred = postScrapePersistencePatch({
      ...existingByKey.get(fingerprint), ...persistedJob, ...sourceContentUpdates,
      postedAt: postedAt || existingByKey.get(fingerprint)?.postedAt,
      scrapedAt: now, scrapedTimestamp: normalizedJob.scrapedTimestamp || now,
    }, existingByKey.get(fingerprint), { now, mode: process.env.POST_SCRAPE_CLASSIFICATION_MODE || 'shadow' })

    return {
      updateOne: {
        filter: applicationPersistenceFilter(identities[index]),
        update: {
          $set: {
            title: normalizedJob.title,
            company: normalizedJob.company,
            companyKey: searchKeys.companyKey,
            originalTitle: normalizedJob.originalTitle,
            normalizedTitle: normalizedJob.normalizedTitle,
            jobCategory: normalizedJob.jobCategory,
            employmentType: normalizedJob.employmentType,
            department: normalizedJob.department || null,
            location: locationLabel || primaryLocation || null,
            locations,
            city: finalCity,
            cityKey: searchKeys.cityKey,
            locationKeys: searchKeys.locationKeys,
            ...(!observationOnly && { sortDate: derivedFields.sortDate }),
            isPublicIndia: derivedFields.isPublicIndia,
            publicCityKey: derivedFields.publicCityKey,
            state: normalizedJob.state,
            country: normalizedJob.country,
            remoteStatus: normalizedJob.remoteStatus,
            sourceRemoteStatusUnresolved: normalizedJob.sourceRemoteStatusUnresolved === true,
            ...(normalizedJob.sourceRemoteStatusUnresolved === true ? {
              workArrangement: normalizePublicWorkArrangement(normalizedJob.workArrangement, normalizedJob),
            } : {}),
            source: normalizedJob.source || source,
            sourceUrl,
            applyUrl,
            verificationKeys: verificationKeys({ sourceUrl, applyUrl, sourceAvailability: normalizedJob.sourceAvailability }),
            applicationUrlIsGeneric: normalizedJob.applicationUrlIsGeneric === true,
            companyCareerPage: normalizedJob.companyCareerPage,
            companyDomain: normalizedJob.companyDomain,
            atsPlatform: normalizedJob.atsPlatform,
            jobId: normalizedJob.jobId,
            requisitionId: normalizedJob.requisitionId,
            ...sourceContentUpdates,
            ...(normalizedJob.sourceEmploymentType && { sourceEmploymentType: normalizedJob.sourceEmploymentType }),
            ...(normalizedJob.sourceExperienceRequired !== null && normalizedJob.sourceExperienceRequired !== undefined && normalizedJob.sourceExperienceRequired !== '' && { sourceExperienceRequired: normalizedJob.sourceExperienceRequired }),
            ...(normalizedJob.eligibleBatchesProvenance === 'source' && { eligibleBatches: normalizedJob.eligibleBatches || [], eligibleBatchesProvenance: 'source' }),
            fingerprint,
            scrapedAt: now,
            scrapedTimestamp: normalizedJob.scrapedTimestamp || now,
            lastSeenAt: now,
            ...(normalizedJob.employerPostedAt
              ? { employerPostedAt: normalizedJob.employerPostedAt }
              : normalizedJob.preserveExistingSourceContent === true || normalizedJob.sourceDetailComplete === false
                ? {} : { employerPostedAt: null }),
            missedScrapeCount: 0,
            ...(!supportsNativeRoleAvailability(jobSource) && { status: 'active' }),
            jobType: resolveJobType(normalizedJob) || inferJobType(normalizedJob.title),
            ...(!observationOnly && postedAt && {
              postedAt,
              postedAtProvenance: 'source',
              postedAtProvenanceValue: postedAt.toISOString(),
            }),
            ...(closingDate && { closingDate }),
            ...(deferred?.set || {}),
          },
          // Insert-only fallback protects the first stored observation even if
          // another writer inserts or recovers a source date after our lookup.
          ...(observationOnly && publicationDate.date ? { $setOnInsert: {
            postedAt: publicationDate.date,
            sortDate: publicationDate.date,
            postedAtProvenance: 'observation',
            postedAtProvenanceValue: publicationDate.provenanceValue,
          } } : {}),
          ...(deferred && Object.keys(deferred.unset).length ? { $unset: deferred.unset } : {}),
        },
        upsert: true,
      },
    }
  })

  const result = {
    inserted: 0,
    updated: 0,
    deleted: 0,
    filteredNonIndia: filterCounts.nonIndia,
    filteredOld: filterCounts.old,
    filteredClosed: filterCounts.closed,
    filteredInvalidUrl: filterCounts.invalidUrl,
    filteredEmptyDescription: filterCounts.emptyDescription,
    ...(filterCounts.unavailable && { filteredUnavailable: filterCounts.unavailable }),
    missed: 0,
    expired: 0,
    eligibleJobs: eligibleJobs.length,
    missesBeforeExpiry,
    staleCheckSkipped: false,
    staleCheckReason: null,
  }

  if (hasLiveDatabaseHandle()) {
    const corrected = await correctExistingSourceLifecycleDates({ jobs, source, now, JobModel, signal })
    if (corrected) {
      result.correctedSourceDates = corrected
      result.updated += corrected
    }
    const correctedAvailability = await correctExistingNativeAvailability({ jobs, source, now, JobModel, signal })
    if (correctedAvailability) {
      result.correctedNativeAvailability = correctedAvailability
      result.updated += correctedAvailability
    }
  }

  const currentFingerprints = operations.map((operation) => operation.updateOne.update.$set.fingerprint)

  if (operations.length > 0) {
    const bulkResult = await runStage(
      source,
      onStage,
      'bulkWrite',
      () => persistJobChangesWithAlertOutbox(JobModel, operations, { enqueueAlerts: options.enqueueAlerts !== false, signal }),
      { operations: operations.length },
      { signal },
    )
    throwIfAborted(signal)
    result.inserted = bulkResult.upsertedCount ?? 0
    result.updated += bulkResult.modifiedCount ?? 0

  }

  if (hasLiveDatabaseHandle() && availabilityTransitions.length > 0) {
    await runStage(source, onStage, 'nativeAvailabilityTransitions',
      () => JobModel.bulkWrite(availabilityTransitions, { ordered: false, timestamps: false }),
      { operations: availabilityTransitions.length }, { signal })
  }

  if (hasLiveDatabaseHandle() && observationInitializations.length > 0) {
    const initialized = await runStage(source, onStage, 'initializeObservationDates',
      () => JobModel.bulkWrite(observationInitializations, { ordered: false, timestamps: false }),
      { operations: observationInitializations.length }, { signal })
    // This can overlap an ordinary updated row. Report its own count rather
    // than counting the same vacancy twice in result.updated.
    if (initialized.modifiedCount > 0) result.initializedObservationDates = initialized.modifiedCount
  }

  let shouldRefreshDatasetSummary = operations.length > 0 || result.correctedSourceDates > 0
    || result.correctedNativeAvailability > 0
  const incompleteListing = jobs.some((job) => job?.sourceListingComplete === false)
  // Missing descriptions no longer reject otherwise eligible jobs. Incomplete
  // detail collection still cannot authorize cleanup of previous vacancies.
  const detailHealth = extractionDetailHealth(indiaJobs)
  const incompleteDetails = jobs.some((job) => job?.sourceDetailComplete === false)
    || detailHealth.missingDescriptions > 0
    || detailHealth.nativeCollections?.some((collection) => !collection.complete) === true
  const cleanupForbidden = sourceLifecycleCleanupForbidden(jobs)
  const incompleteSource = incompleteListing || incompleteDetails || cleanupForbidden
  const authorizedEmptyLifecycle = currentFingerprints.length === 0
    && options.authoritativeEmpty === true

  if (
    options.replaceExisting !== false
    && incompleteSource
  ) {
    result.staleCheckSkipped = true
    if (cleanupForbidden) result.staleCheckReasonCode = 'source-cleanup-forbidden'
    result.staleCheckReason = cleanupForbidden
      ? 'Source explicitly forbids lifecycle cleanup; previous vacancies were preserved without recording lifecycle misses.'
      : incompleteDetails
      ? 'Incomplete source role details; previous vacancies were preserved without recording lifecycle misses.'
      : 'Incomplete source listing; previous vacancies were preserved without recording lifecycle misses.'
  }

  if (
    options.replaceExisting !== false
    && !incompleteSource
    && currentFingerprints.length === 0
    && !authorizedEmptyLifecycle
  ) {
    result.staleCheckSkipped = true
    result.staleCheckReasonCode = 'no-eligible-jobs'
    result.staleCheckReason =
      'No eligible jobs survived filtering; previous source jobs were preserved without recording lifecycle misses.'
  }

  if (
    options.replaceExisting !== false
    && !incompleteSource
    && (currentFingerprints.length > 0 || authorizedEmptyLifecycle)
  ) {
    const unseenFilter = options.replaceAllJobs
      ? { status: 'active' }
      : { source, status: 'active' }

    if (currentFingerprints.length > 0) {
      unseenFilter.fingerprint = { $nin: currentFingerprints }
    }
    // A lost acknowledgement must not turn a checkpoint resume into a second
    // missing inventory, or delete a vacancy earlier than the configured limit.
    if (options.lifecycleAttemptId) unseenFilter.lastMissedScrapeRunId = { $ne: options.lifecycleAttemptId }

    const expirationDeletion = await runStage(
      source,
      onStage,
      'expireUnseen',
      () => JobModel.deleteMany(
        {
          ...unseenFilter,
          missedScrapeCount: { $gte: missesBeforeExpiry - 1 },
        },
      ).exec(),
      {},
      { signal },
    )

    const missResult = await runStage(
      source,
      onStage,
      'recordMisses',
      () => JobModel.updateMany(
        unseenFilter,
        { $inc: { missedScrapeCount: 1 }, ...(options.lifecycleAttemptId ? { $set: { lastMissedScrapeRunId: options.lifecycleAttemptId } } : {}) },
      ).exec(),
      {},
      { signal },
    )

    result.deleted = expirationDeletion.deletedCount ?? 0
    result.expired = result.deleted
    result.missed = result.deleted + (missResult.modifiedCount ?? 0)
    shouldRefreshDatasetSummary = shouldRefreshDatasetSummary || result.deleted > 0
  }

  if (shouldRefreshDatasetSummary && options.refreshDatasetSummary !== false && hasLiveDatabaseHandle()) {
    await runStage(
      source,
      onStage,
      'datasetSummary',
      () => refreshJobDatasetSummary(),
      {},
      { signal },
    )
  }

  return result
}

export const deleteAllJobsFromDB = async () => {
  await ensureConnected()
  const JobModel = await getJobModel()
  const result = await JobModel.deleteMany({})
  return result.deletedCount ?? 0
}

const normalizeDryRunJobs = (jobs) => filterIndiaJobs(jobs).map((job) => {
  const normalizedJob = normalizeScrapedJob(job, {
    source: job?.source || null,
  })
  const rawApplyUrl = String(job?.applyUrl || job?.link || '').trim()

  if (!normalizedJob.applyUrl && /^mailto:/i.test(rawApplyUrl)) {
    return {
      ...normalizedJob,
      applyUrl: rawApplyUrl,
      link: rawApplyUrl,
    }
  }

  return normalizedJob
})

const VOLATILE_DRY_RUN_SNAPSHOT_FIELDS = new Set([
  'postedAt',
  'postingDate',
  'scrapedAt',
  'scrapedTimestamp',
  'extractedAt',
  'classifiedAt',
])

const stripVolatileDryRunSnapshotFields = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => stripVolatileDryRunSnapshotFields(entry))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !VOLATILE_DRY_RUN_SNAPSHOT_FIELDS.has(key)
        && !(key === 'postedAtProvenanceValue' && value.postedAtProvenance === 'observation'))
      .map(([key, entryValue]) => [key, stripVolatileDryRunSnapshotFields(entryValue)]),
  )
}

const writeDryRunSnapshotIfChanged = async (filePath, content, options = {}) => {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true })

  let hasExistingSnapshot = false

  try {
    const existingContent = await fs.promises.readFile(filePath, 'utf8')
    hasExistingSnapshot = true
    if (existingContent === content) {
      return false
    }

    const existingSnapshot = stripVolatileDryRunSnapshotFields(JSON.parse(existingContent))
    const nextSnapshot = stripVolatileDryRunSnapshotFields(JSON.parse(content))
    if (JSON.stringify(existingSnapshot) === JSON.stringify(nextSnapshot)) {
      return false
    }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      // No snapshot exists yet, so we need to write one.
    } else if (error instanceof SyntaxError) {
      // Corrupt or partial snapshots should be replaced with a fresh write.
    } else {
      throw error
    }
  }

  const tempFilePath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`,
  )

  try {
    await fs.promises.writeFile(tempFilePath, content, 'utf-8')
    await fs.promises.rename(tempFilePath, filePath)
  } catch (error) {
    await fs.promises.rm(tempFilePath, { force: true }).catch(() => {})

    // Backfill runs can hit workspace quota limits where an atomic sidecar file
    // cannot fit even though overwriting the existing snapshot in place can.
    if (
      error?.code === 'ENOSPC'
      && options.allowInPlaceRewriteOnEnospc === true
      && hasExistingSnapshot
    ) {
      await fs.promises.writeFile(filePath, content, 'utf-8')
    } else {
      throw error
    }
  }

  return true
}

export const saveDryRunSnapshot = async (jobs, filePath, options = {}) => {
  const signal = options.signal || null
  const source = options.source || jobs[0]?.source || 'dry-run'
  const onStage = checkedStageCallback(options.onStage, signal)
  throwIfAborted(signal)
  const filteredJobs = filterIndiaJobs(jobs)
  const hasTargetedSelection = typeof options.shouldEnrichJob === 'function'
    || (Number.isInteger(options.maxJobsToEnrich) && options.maxJobsToEnrich > 0)
  const maxJobsToEnrich = Number.isInteger(options.maxJobsToEnrich) && options.maxJobsToEnrich > 0
    ? options.maxJobsToEnrich
    : Number.POSITIVE_INFINITY
  const shouldEnrichJob = typeof options.shouldEnrichJob === 'function'
    ? options.shouldEnrichJob
    : () => true

  let enrichedJobs = filteredJobs
  const enrichmentStartedAt = Date.now()
  emitStage(source, onStage, { stage: 'enrichment', status: options.enrichPublicExperience === false ? 'skipped' : 'start', jobs: filteredJobs.length })

  if (options.enrichPublicExperience !== false) {
    if (!hasTargetedSelection) {
      enrichedJobs = await enrichJobsWithPublicExperience(filteredJobs, {
        fetchText: options.fetchText,
        fetchBrowserText: options.fetchBrowserText,
        concurrency: options.experienceEnrichmentConcurrency,
        useBrowserFallback: options.useBrowserFallback,
        signal,
        fetchTimeoutMs: options.fetchTimeoutMs,
        pdfTextExtractionTimeoutMs: options.pdfTextExtractionTimeoutMs,
      })
    } else {
      const selectedIndices = []
      const selectedJobs = []

      for (let index = 0; index < filteredJobs.length; index += 1) {
        if (selectedJobs.length >= maxJobsToEnrich) break
        if (!shouldEnrichJob(filteredJobs[index], index)) continue

        selectedIndices.push(index)
        selectedJobs.push(filteredJobs[index])
      }

      if (selectedJobs.length > 0) {
        const enrichedSelectedJobs = await enrichJobsWithPublicExperience(selectedJobs, {
          fetchText: options.fetchText,
          fetchBrowserText: options.fetchBrowserText,
          concurrency: options.experienceEnrichmentConcurrency,
          useBrowserFallback: options.useBrowserFallback,
          signal,
          fetchTimeoutMs: options.fetchTimeoutMs,
          pdfTextExtractionTimeoutMs: options.pdfTextExtractionTimeoutMs,
        })

        enrichedJobs = [...filteredJobs]
        for (let index = 0; index < selectedIndices.length; index += 1) {
          enrichedJobs[selectedIndices[index]] = enrichedSelectedJobs[index]
        }
      }
    }
  }

  if (options.enrichPublicExperience !== false) emitStage(source, onStage, { stage: 'enrichment', status: 'done', jobs: enrichedJobs.length, durationMs: Date.now() - enrichmentStartedAt })
  throwIfAborted(signal)
  const localJobOutboxDirectory = String(options.localJobOutboxDirectory || '').trim()
  if (localJobOutboxDirectory) {
    await runStage(source, onStage, 'local job outbox', () => saveLocalJobOutbox(enrichedJobs, {
      source, dryRun: true, directory: localJobOutboxDirectory, capturedAt: options.capturedAt,
      captureFile: options.captureFile || null, phase: 'enriched_description',
    }), { jobs: enrichedJobs.length }, { signal })
  }
  emitStage(source, onStage, { stage: 'classification', status: 'deferred', jobs: enrichedJobs.length })
  const normalizedJobs = normalizeDryRunJobs(enrichedJobs)
  await runStage(source, onStage, 'snapshot write', () => writeDryRunSnapshotIfChanged(filePath, JSON.stringify(normalizedJobs, null, 2), {
    allowInPlaceRewriteOnEnospc: options.allowInPlaceRewriteOnEnospc === true,
  }), { jobs: normalizedJobs.length }, { signal })
  return normalizedJobs
}

/**
 * Saves an array of scraped jobs to a local JSON file (dry-run mode).
 *
 * @param {object[]} jobs      Array of job objects
 * @param {string}   filePath  Absolute path to the output JSON file
 */
export const saveToFile = (jobs, filePath) => {
  const indiaJobs = normalizeDryRunJobs(jobs)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(indiaJobs, null, 2), 'utf-8')
}
