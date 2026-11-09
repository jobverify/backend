import { nativeEightfoldLocationPairs } from './eightfoldLocations.js'

const normalize = value => (typeof value === 'string' ? value
  : typeof value === 'number' && Number.isFinite(value) ? String(value) : '')
  .normalize('NFKC').replace(/\s+/g, ' ').trim()
const fail = field => {
  throw Object.assign(new Error(`API portal detail identity mismatch: ${field}`), {
    incompleteScope: true, abortRetries: true,
  })
}

// Opted-in native feeds must bind the returned description to the exact
// employer listing, rather than trusting that a successful detail URL did so.
export const assertEightfoldDetailIdentity = (record, payload, provider) => {
  const detail = payload?.data
  if (provider.atsPlatform !== 'eightfold' || !detail || typeof detail !== 'object' || Array.isArray(detail)) fail('native payload')
  for (const field of ['id', 'displayJobId', 'name']) {
    const expected = normalize(record[field])
    if (!expected || normalize(detail[field]) !== expected) fail(field)
  }
  const locations = value => {
    if (!Array.isArray(value) || !value.length || value.some(item => typeof item !== 'string' || !normalize(item))) fail('locations')
    return value.map(normalize).sort()
  }
  if (JSON.stringify(locations(record.locations)) !== JSON.stringify(locations(detail.locations))) fail('locations')
  if (provider.config?.mapping?.location?.strategy === 'eightfold-location'
    && JSON.stringify(nativeEightfoldLocationPairs(record)) !== JSON.stringify(nativeEightfoldLocationPairs(detail))) fail('standardized locations')
  let expected, observed, origin
  try {
    origin = new URL(provider.companyCareerPage).origin
    expected = new URL(record.positionUrl, provider.companyCareerPage)
    observed = new URL(detail.positionUrl, provider.companyCareerPage)
  } catch { fail('positionUrl') }
  const nativePath = `/careers/job/${normalize(record.id)}`
  if (expected.protocol !== 'https:' || expected.origin !== origin || expected.username || expected.password
    || expected.pathname !== nativePath || observed.href !== expected.href) fail('positionUrl')
}

