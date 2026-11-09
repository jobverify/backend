import crypto from 'node:crypto'
import { normalizeCity } from './cityNormalizer.js'
import { getPrimaryStoredLocation } from '../../src/utils/jobLocations.js'
import { normalizeHttpUrl } from './publishableJobMetrics.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const normalizeIdentity = value => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
const nativeRoleIdentity = job => normalizeIdentity(job.requisitionId || job.jobId)
const roleIdentity = job => nativeRoleIdentity(job) || normalizeIdentity(job.title)

/** Role-specific URLs retain their existing identity across title changes. */
export const generateFingerprint = job => {
  const primaryLocation = getPrimaryStoredLocation(job)
  const canonicalCity = normalizeCity(primaryLocation || job.city || job.location || '') || ''
  const rawApplicationUrl = job.applyUrl || job.sourceUrl || job.link
  const hasEmailApplication = /^mailto:/i.test(String(job.applyUrl || job.link || rawApplicationUrl || '').trim())
  const applicationUrl = normalizeHttpUrl(rawApplicationUrl)
    || (hasEmailApplication ? normalizeHttpUrl(job.sourceUrl) : null)
  const nativeIdentity = job.requisitionId || job.jobId || job.title
  const identity = (job.applicationUrlIsGeneric === true || hasEmailApplication) && applicationUrl
    ? [applicationUrl, nativeIdentity].join('|')
    : applicationUrl || nativeIdentity
  const raw = [
    (job.company || '').toLowerCase().trim(),
    String(identity || '').toLowerCase().trim(),
    canonicalCity.toLowerCase(),
  ].join('|')
  return crypto.createHash('sha256').update(raw).digest('hex')
}

const genericFingerprint = job => generateFingerprint({ ...job, applicationUrlIsGeneric: true })
const urlFingerprint = job => generateFingerprint({ ...job, applicationUrlIsGeneric: false })
const applicationSurface = job => [normalizeIdentity(job.company), normalizeIdentity(job.applyUrl || job.sourceUrl || job.link)].join('|')

export const applicationFingerprintCandidates = jobs => [...new Set(jobs.flatMap(job => [
  generateFingerprint(job), genericFingerprint(job), urlFingerprint(job),
]))]

export const applicationIdentityLookup = jobs => ({ $or: [
  { fingerprint: { $in: applicationFingerprintCandidates(jobs) } },
  { applicationUrlIsGeneric: true, applyUrl: { $in: [...new Set(jobs.map(job => job.applyUrl).filter(Boolean))] } },
] })

export const coalesceApplicationIdentities = identities => {
  const byFingerprint = new Map()
  for (const identity of identities) {
    const previous = byFingerprint.get(identity.fingerprint)
    // A missing-detail duplicate is fallback evidence, not permission to erase
    // the employer content collected by another copy in this same batch.
    if (!previous || hasSourceDescription(identity.job) || !hasSourceDescription(previous.job)) {
      byFingerprint.set(identity.fingerprint, identity)
    }
  }
  return [...byFingerprint.values()]
}

export const applicationPersistenceFilter = identity => {
  const { fingerprint, previousFingerprint, previous } = identity
  if (previousFingerprint === fingerprint) return { fingerprint }
  const roleField = previous.requisitionId ? 'requisitionId' : previous.jobId ? 'jobId' : 'title'
  // Another source may finish this same migration after our lookup. Matching
  // either key makes the write idempotent while the old-key role guard prevents
  // reassigning a legacy record belonging to a different vacancy.
  return { $or: [
    { fingerprint },
    { fingerprint: previousFingerprint, [roleField]: previous[roleField] },
  ] }
}

const sameRole = (left, right) => {
  const leftId = nativeRoleIdentity(left)
  const rightId = nativeRoleIdentity(right)
  if (leftId || rightId) return Boolean(leftId && rightId && leftId === rightId)
  return Boolean(roleIdentity(left) && roleIdentity(left) === roleIdentity(right))
}

/**
 * A shared URL observed with different role IDs is an application surface, not
 * a vacancy identity. Existing role fingerprints retain that fact when a later
 * listing has only one opening. Resolve prior content before the bulk write so
 * another role's description can never be reused for the surviving opening.
 */
export const resolveApplicationIdentities = (jobs, existingJobs = []) => {
  const existingByFingerprint = new Map(existingJobs.map(job => [job.fingerprint, job]))
  const knownSharedSurfaces = new Set(existingJobs.filter(job => job.applicationUrlIsGeneric === true).map(applicationSurface))
  const rolesByUrl = new Map()
  for (const job of jobs) {
    const key = applicationSurface(job)
    if (!rolesByUrl.has(key)) rolesByUrl.set(key, new Set())
    if (roleIdentity(job)) rolesByUrl.get(key).add(roleIdentity(job))
  }
  const identities = jobs.map(original => {
    const legacyFingerprint = urlFingerprint(original)
    const shared = rolesByUrl.get(applicationSurface(original)).size > 1
      || knownSharedSurfaces.has(applicationSurface(original))
      || existingByFingerprint.has(genericFingerprint(original))
    const job = shared ? { ...original, applicationUrlIsGeneric: true } : original
    return { job, fingerprint: generateFingerprint(job), legacyFingerprint }
  })

  // Re-key an old collapsed record only if its native role unambiguously
  // matches one incoming identity. Unknown legacy evidence is left untouched.
  const matchingTargets = new Map()
  for (const identity of identities) {
    const previous = existingByFingerprint.get(identity.legacyFingerprint)
    if (!previous || !sameRole(previous, identity.job)) continue
    if (!matchingTargets.has(identity.legacyFingerprint)) matchingTargets.set(identity.legacyFingerprint, new Set())
    matchingTargets.get(identity.legacyFingerprint).add(identity.fingerprint)
  }
  return identities.map(identity => {
    const direct = existingByFingerprint.get(identity.fingerprint)
    const legacy = existingByFingerprint.get(identity.legacyFingerprint)
    const canReuseLegacy = identity.fingerprint !== identity.legacyFingerprint
      && legacy && sameRole(legacy, identity.job)
      && matchingTargets.get(identity.legacyFingerprint)?.size === 1
    const previous = direct || (canReuseLegacy ? legacy : null)
    return { ...identity, previous, previousFingerprint: previous?.fingerprint || identity.fingerprint }
  })
}
