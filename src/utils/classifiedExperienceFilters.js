import { CLASSIFICATION_POLICY, getAuthoritativeClassification } from '../services/jobClassificationPolicy.js';

export const AUTHORITATIVE_CLASSIFICATION_CONSTRAINT = Object.freeze({
  'classification.authoritative': true, 'classification.mode': { $in: ['enforce', 'policy'] },
  'classification.policyVersion': CLASSIFICATION_POLICY.version,
  'classification.status': { $in: ['accepted', 'uncertain', 'fallback'] },
});

export const buildSemanticExperienceConstraint = value => value === 'unspecified'
  ? { ...AUTHORITATIVE_CLASSIFICATION_CONSTRAINT, 'classification.resolved.experiencePolicy': 'not_stated',
    'classification.resolved.experienceYears': { $size: 0 } }
  : Number(value) === 0 ? { ...AUTHORITATIVE_CLASSIFICATION_CONSTRAINT, $or: [
    { 'classification.resolved.experienceYears': 0 },
    { 'classification.resolved.jobType': 'Full-time Fresher', 'classification.resolved.experiencePolicy': { $in: ['fresher_eligible', 'mixed'] } },
  ] } : Number.isFinite(Number(value)) && Number(value) > 0
    ? { ...AUTHORITATIVE_CLASSIFICATION_CONSTRAINT, 'classification.resolved.experienceYears': Number(value) } : null;

export const withSemanticExperienceConstraint = (value, legacy) => {
  const semantic = buildSemanticExperienceConstraint(value);
  return semantic ? { $or: [semantic, { $and: [{ $nor: [AUTHORITATIVE_CLASSIFICATION_CONSTRAINT] }, legacy] }] } : legacy;
};

export const matchesExperienceFilter = (job, value, legacyUnspecified) => {
  if (value === '' || value == null) return true;
  const resolved = getAuthoritativeClassification(job);
  if (String(value).toLowerCase() === 'unspecified') {
    return resolved ? resolved.experiencePolicy === 'not_stated' && (resolved.experienceYears || []).length === 0 : legacyUnspecified(job);
  }
  const year = Number(value);
  if (resolved && year === 0) return (resolved.experienceYears || []).includes(0)
    || (resolved.jobType === 'Full-time Fresher' && ['fresher_eligible', 'mixed'].includes(resolved.experiencePolicy));
  if (resolved) return (resolved.experienceYears || []).includes(year);
  return (job.experienceYears || []).includes(year) && (year !== 0 || job.jobType === 'Full-time Fresher');
};
