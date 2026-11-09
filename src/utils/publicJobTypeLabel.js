import { PREFERRED_JOB_TYPES, getPreferredJobTypeMatches } from '../constants/preferredJobTypes.js';

export const PUBLIC_JOB_TYPES = [...PREFERRED_JOB_TYPES];

// Keep unknown input as an internal queue state; public visibility requires a known type.
export const normalizePublicJobType = value => {
  const label = String(value ?? '').trim().toLowerCase();
  if (label === 'internship') return 'Intern';
  return PUBLIC_JOB_TYPES.find(type => type.toLowerCase() === label) || 'Unspecified';
};

// Retain legacy unknown filter matching so an old saved selection cannot broaden
// into all categories. Public visibility independently excludes unknown jobs.
export const getPublicJobTypeMatches = value => String(value ?? '').trim().toLowerCase() === 'unspecified'
  ? ['Unspecified'] : getPreferredJobTypeMatches(value);
