import { extractJobFilterSignals } from '../utils/jobFilterSignals.js';
import { mainExperienceRequirement, alternativeExperienceRequirement } from '../utils/mainExperienceRequirement.js';
import { postScrapePersistencePatch, sourceSnapshotFilter } from './postScrapeClassification.js';

export function buildMainExperienceRepair(job, { now = new Date() } = {}) {
  if (job.sourceExperienceRequired?.trim() || job.experienceRequiredProvenance === 'source') return null;
  const source = job.sourceDescription || job.jobDescription || job.description;
  const requirements = [job.minimumQualification && `Required qualifications: ${job.minimumQualification}`,
    source, job.preferredQualification && `Preferred qualifications: ${job.preferredQualification}`].filter(Boolean).join(' ');
  if (!mainExperienceRequirement(requirements) && !alternativeExperienceRequirement(requirements)) return null;
  const previous = extractJobFilterSignals({ experienceRequired: job.experienceRequired }).experienceProfile;
  if (previous.confidence !== 'high' || !Number.isFinite(previous.minimumYears)) return null;
  const signals = extractJobFilterSignals({ ...job, classification: null, descriptionRewrite: null,
    sourceDescription: source, description: source, jobDescription: source, experienceRequired: null });
  const profile = signals.experienceProfile;
  const hasAlternatives = profile.minimumYears === null && Boolean(alternativeExperienceRequirement(profile.evidence));
  if (profile.confidence !== 'high' || !Number.isFinite(profile.minimumYears) && !hasAlternatives
    || previous.minimumYears === profile.minimumYears && previous.maximumYears === profile.maximumYears && previous.isOpenEnded === profile.isOpenEnded) return null;
  const fields = { experienceRequired: profile.evidence, experienceProfile: profile,
    experienceYears: signals.experienceYears, experienceBucket: signals.experienceBucket };
  // Derived experience is deliberately excluded from the classifier input hash.
  // Force a pending decision instead of reusing the cached incorrect profile.
  const deferred = postScrapePersistencePatch({ ...job, ...fields }, null,
    { now, mode: job.postClassification?.mode || job.classification?.mode || 'shadow' });
  return { previous: job.experienceRequired, next: fields.experienceRequired,
    filter: sourceSnapshotFilter(job), update: { $set: { ...fields, ...deferred.set }, $unset: deferred.unset } };
}
