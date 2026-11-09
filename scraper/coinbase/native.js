import { createHash } from 'node:crypto'
import { decodeHTML } from 'entities'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { resolveGreenhousePublication } from '../../scraper-support/apiPortal/greenhousePublication.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

export const SOURCE = 'coinbase'
export const COMPANY = 'Coinbase'
export const CAREERS_URL = 'https://www.coinbase.com/careers/positions'
// The active employer detail /8333273 advertises a Greenhouse Apply now link
// with for=coinbase. See native-captures/documentary-binding-20261101.json.
// This documentary binding is separate from the denied Node employer reads.
export const NATIVE_API_URL = 'https://boards-api.greenhouse.io/v1/boards/coinbase/jobs?content=true'

const MAX_BYTES = 8 * 1024 * 1024
const MAX_ROWS = 10000
const TIMEOUT_MS = 20000
const CHALLENGE = /just a moment\.\.\.|enable javascript and cookies to continue|verify you are human|captcha challenge/i
const PROSPECT = /general application|future opportunities|talent (?:community|network|pool)|speculative application/i
const fail = reason => { throw new Error(`[${SOURCE}] ${reason}`) }
const text = value => typeof value === 'string' ? value.trim() : ''

const boundedBody = async (response, signal) => {
  const reader = response.body?.getReader()
  if (!reader) fail('Native response body unavailable')
  const chunks = []
  let bytes = 0
  try {
    for (;;) {
      signal?.throwIfAborted()
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > MAX_BYTES) fail('Native response exceeds 8 MiB limit')
      chunks.push(value)
    }
    signal?.throwIfAborted()
    return Buffer.concat(chunks).toString('utf8')
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }
}

const fetchNativeJson = async ({ fetchImpl, signal }) => {
  const requestSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)])
    : AbortSignal.timeout(TIMEOUT_MS)
  requestSignal.throwIfAborted()
  const response = await fetchImpl(NATIVE_API_URL, {
    method: 'GET', redirect: 'manual', signal: requestSignal,
    headers: { Accept: 'application/json' },
  })
  const body = await boundedBody(response, requestSignal)
  if ([401, 403, 429].includes(response.status) || CHALLENGE.test(body.slice(0, 20000))) {
    const error = new Error(`[${SOURCE}] Native source access denied (HTTP ${response.status}); no retry permitted`)
    error.status = response.status
    error.denialMetadata = {
      requestedUrl: NATIVE_API_URL, finalUrl: response.url || NATIVE_API_URL,
      status: response.status, bytes: Buffer.byteLength(body),
      bodySHA256: createHash('sha256').update(body).digest('hex'),
      headers: Object.fromEntries(['content-type', 'server', 'cf-ray', 'cf-mitigated']
        .map(name => [name, response.headers?.get?.(name) ?? null])),
    }
    throw error
  }
  if (!response.ok) fail(`Native HTTP ${response.status}; no retry permitted`)
  if (response.url && response.url !== NATIVE_API_URL) fail('Unexpected native response URL')
  try { return JSON.parse(body) } catch { fail('Invalid native inventory JSON') }
}

const validateInventory = payload => {
  if (!payload || Array.isArray(payload) || payload.error || payload.errors || payload.success === false
    || payload.hasMore || payload.has_more || payload.next || payload.next_page || payload.links?.next
    || payload.meta?.next || payload.meta?.total_pages > 1 || !Array.isArray(payload.jobs)
    || !Number.isSafeInteger(payload.meta?.total) || payload.meta.total < 0
    || payload.meta.total !== payload.jobs.length || payload.jobs.length > MAX_ROWS) {
    fail('Incomplete or errored native inventory envelope')
  }
  const ids = new Set()
  for (const row of payload.jobs) {
    if (!row || !Number.isSafeInteger(row.id) || row.id < 1 || !text(row.title)
      || !text(row.location?.name) || !Array.isArray(row.offices) || !Array.isArray(row.departments)) {
      fail('Invalid native role shape')
    }
    if (row.company_name !== COMPANY) fail('Native employer identity mismatch')
    if (ids.has(row.id)) fail('Duplicate native role ID')
    ids.add(row.id)
    let url
    try { url = new URL(row.absolute_url) } catch { fail('Invalid native role URL') }
    if (url.protocol !== 'https:' || !['www.coinbase.com', 'coinbase.com'].includes(url.hostname)
      || url.username || url.password || url.port || url.hash
      || url.pathname !== `/careers/positions/${row.id}`
      || url.searchParams.getAll('gh_jid').length !== 1 || url.searchParams.get('gh_jid') !== String(row.id)) {
      fail('Native role URL identity mismatch')
    }
  }
  return payload.jobs
}

// Only the current role's explicit primary country label qualifies it here.
// Assigned office addresses remain original evidence, never a default country
// or a city for remote roles. Unresolved alternatives keep source scope partial.
const countryDisplayNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
const foreignCountryTokens = new Set(['uk', 'usa', 'united states of america'])
for (const first of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
  for (const second of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const code = first + second
    if (['IN', 'EU', 'UN', 'QO', 'XA', 'XB', 'ZZ'].includes(code)) continue
    const name = countryDisplayNames.of(code)
    if (name) {
      foreignCountryTokens.add(code.toLowerCase())
      foreignCountryTokens.add(name.toLowerCase())
    }
  }
}
const explicitIndiaLabel = value => {
  const label = text(value).replace(/^(?:remote|hybrid|on[- ]site|office)\s*[-–—]\s*/i, '')
  return !/[;|/+]/.test(label) && !/\s(?:and|or)\s/i.test(label)
    && /^(?:India|[^,]+(?:,[^,]+)*,\s*India)$/i.test(label)
    && !label.split(',').slice(0, -1).some(part => foreignCountryTokens.has(part.trim().toLowerCase()))
}
const remoteStatus = label => /hybrid/i.test(label) ? 'Hybrid' : /remote/i.test(label) ? 'Remote' : 'On-site'
const explicitCity = label => {
  const locality = text(label).replace(/^(?:remote|hybrid|on[- ]site|office)\s*[-–—]\s*/i, '')
  const parts = locality.split(',').map(part => part.trim())
  if (parts.length < 2 || /^(?:India|remote|hybrid|on[- ]site|office)$/i.test(parts[0])) return null
  return getValidIndiaCityForJob({ location: locality, country: 'India' }) || null
}

export const createCoinbaseScraper = ({ maxJobs: configuredLimit = null } = {}) => ({
  async run({ fetchImpl = globalThis.fetch, fetchJson, signal, maxJobs = configuredLimit,
    now = () => new Date().toISOString() } = {}) {
    signal?.throwIfAborted()
    if (maxJobs !== null && (!Number.isSafeInteger(maxJobs) || maxJobs < 0)) fail('Invalid maxJobs limit')
    const payload = fetchJson
      ? await fetchJson(NATIVE_API_URL, { method: 'GET', signal })
      : await fetchNativeJson({ fetchImpl, signal })
    signal?.throwIfAborted()
    const rows = validateInventory(payload)
    const vacancies = rows.filter(row => !PROSPECT.test(row.title))
    const indiaRows = vacancies.filter(row => explicitIndiaLabel(row.location.name))
    const selected = maxJobs === null ? indiaRows : indiaRows.slice(0, maxJobs)
    const observedAt = new Date(now()).toISOString()
    const jobs = []
    for (const row of selected) {
      signal?.throwIfAborted()
      const description = typeof row.content === 'string' ? decodeHTML(row.content) : ''
      if (!extractActiveDescription(description)) fail(`Native description unavailable for role ${row.id}`)
      const publication = resolveGreenhousePublication(row, null, 'not-observed')
      jobs.push({
        title: row.title, company: COMPANY, source: SOURCE,
        location: row.location.name, country: 'India',
        city: explicitCity(row.location.name),
        remoteStatus: remoteStatus(row.location.name),
        link: row.absolute_url, sourceUrl: row.absolute_url,
        // The native feed advertises this public role URL. An application URL
        // observed for a different role cannot be manufactured for this one.
        applyUrl: row.absolute_url,
        jobId: row.id, requisitionId: row.requisition_id ?? null,
        department: row.departments.map(department => text(department.name)).filter(Boolean).join('; ') || null,
        employmentType: null, experienceRequired: null, minimumQualification: null,
        preferredQualification: null, requiredSkills: [],
        jobDescription: description, sourceDescription: description,
        nativeDescriptionHTML: description, nativeDescriptionRaw: row.content,
        nativeSourceRecord: structuredClone(row), nativeApiUrl: NATIVE_API_URL,
        nativeCountryEvidence: { field: 'location.name', value: row.location.name, method: 'explicit-native-india-label' },
        postingDate: publication.value, nativePublicationEvidence: publication,
        nativeUpdatedAt: row.updated_at ?? null, closingDate: row.application_deadline ?? null,
        scrapedAt: observedAt,
        sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false,
      })
    }
    signal?.throwIfAborted()
    attachSourceObservationEvidence(jobs, {
      source: SOURCE, recordKind: vacancies.length === rows.length ? 'vacancy-rows' : 'mixed',
      observedRecordCount: rows.length, observedVacancyCount: vacancies.length,
      sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null,
    })
    return attachInventoryEvidence(jobs, {
      status: 'discovery-only', surface: NATIVE_API_URL, firstParty: true,
      listingComplete: false, pagesFetched: 1, reportedTotal: null, indiaFacetCount: null, verifiedAt: observedAt,
      reason: `company-scope-unverified;primary-native-country-labels-only;native-envelope-total:${payload.meta.total};observed-native-rows:${rows.length};observed-explicit-india-rows:${indiaRows.length}`,
    })
  },
})

export const run = options => createCoinbaseScraper().run(options)
