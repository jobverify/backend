import { generateFingerprint } from './applicationIdentity.js';
import { normalizeScrapedJobIdentity } from './normalizeScrapedJob.js';

// Always disambiguate the application surface by its normalized native role.
// Inferring generic URLs independently per source would disagree when one
// alias sees one role and another sees several. This uses persistence's role,
// URL, company and city model without depending on one source's batch size.
export const jobIdentityHashes = jobs => jobs.map(job => {
  const normalized = { ...job, ...normalizeScrapedJobIdentity(job) };
  const role = String(normalized.requisitionId || normalized.jobId || normalized.title || '').toLowerCase();
  return generateFingerprint({ ...normalized, requisitionId: role, jobId: role, title: role, applicationUrlIsGeneric: true });
});

export const summarizeJobYield = rows => {
  let observations = 0, sourcesWithoutIdentityEvidence = 0;
  const identities = new Set();
  for (const row of rows) {
    const count = Number.isSafeInteger(row.jobs) && row.jobs >= 0 ? row.jobs : 0;
    observations += count;
    if (!count) continue;
    const hashes = row.jobIdentityHashes;
    if (!Array.isArray(hashes) || hashes.length !== count
      || !hashes.every(value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value))) {
      sourcesWithoutIdentityEvidence++;
      continue;
    }
    for (const hash of hashes) identities.add(hash);
  }
  const uniqueJobs = sourcesWithoutIdentityEvidence ? null : identities.size;
  return { observations, uniqueJobs,
    duplicateObservations: uniqueJobs === null ? null : observations - uniqueJobs,
    sourcesWithoutIdentityEvidence };
};
