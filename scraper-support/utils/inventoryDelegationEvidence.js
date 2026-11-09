export const INVENTORY_DELEGATION_EVIDENCE = Symbol.for('jobverify.inventory-delegation-evidence')

const own = (value, key) => value && typeof value === 'object'
  ? Object.getOwnPropertyDescriptor(value, key)?.value : undefined
const sourceName = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]*$/.test(value)
const https = value => {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash && url.href === value
  } catch { return false }
}

// Transport a source's already-validated native relationship observation.
// This does not establish inventory completeness, job identity or publication.
export const normalizeInventoryDelegationEvidence = input => {
  const source = own(input, 'source'), sources = own(input, 'sources'), at = own(input, 'verifiedAt')
  const evidence = own(input, 'evidence'), method = own(evidence, 'method'), url = own(evidence, 'url')
  const responses = own(evidence, 'responses')
  if (!sourceName(source) || !Array.isArray(sources) || !sources.length || sources.length > 20
    || !sources.every(child => sourceName(child) && child !== source) || new Set(sources).size !== sources.length
    || own(input, 'preservesChildSourceAndCompany') !== true || typeof at !== 'string'
    || !Number.isFinite(Date.parse(at)) || Date.parse(at) <= 0
    || typeof method !== 'string' || !/^[a-z-]{3,80}$/.test(method) || !https(url)
    || !Array.isArray(responses) || !responses.length || responses.length > 10) return null
  const nativeResponses = []
  for (const response of responses) {
    const requested = own(response, 'url'), finalUrl = own(response, 'finalUrl')
    const status = own(response, 'status'), sha256 = own(response, 'sha256')
    if (!https(requested) || !https(finalUrl) || ![200,301,302,303,307,308].includes(status)
      || typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)) return null
    nativeResponses.push(Object.freeze({ url: requested, finalUrl, status, sha256 }))
  }
  if (!nativeResponses.some(response => response.url === url)) return null
  return Object.freeze({ source, verifiedAt: new Date(at).toISOString(), sources: Object.freeze([...sources]),
    preservesChildSourceAndCompany: true,
    evidence: Object.freeze({ method, url, responses: Object.freeze(nativeResponses) }) })
}

export const attachInventoryDelegationEvidence = (jobs, input) => {
  const evidence = normalizeInventoryDelegationEvidence(input)
  if (!Array.isArray(jobs) || !evidence) throw new TypeError('Valid native inventory delegation evidence and jobs array required')
  Object.defineProperty(jobs, INVENTORY_DELEGATION_EVIDENCE, { configurable: true, value: evidence })
  return jobs
}

export const readInventoryDelegationEvidence = jobs => Array.isArray(jobs)
  ? normalizeInventoryDelegationEvidence(own(jobs, INVENTORY_DELEGATION_EVIDENCE)) : null
