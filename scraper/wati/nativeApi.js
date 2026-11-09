import { mapWorkablePublicDetail } from '../../scraper-support/utils/workablePublicApi.js'
import { fetchJsonWithRetry, composeAbortSignals } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { nativeDate } from '../../scraper-support/shared/nativeJobPosting.js'

const text = value => typeof value === 'string' && value.trim().length > 0
const fail = reason => { throw new Error('WATI native inventory: ' + reason) }
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
const shortRegionNames = new Intl.DisplayNames(['en'], { type: 'region', style: 'short' })
const locationKey = location => [location.countryCode, location.city || '', location.region || ''].join('|')
const envelope = payload => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.error || payload.success === false || payload.ok === false
    || (Array.isArray(payload.errors) ? payload.errors.length > 0 : Boolean(payload.errors))
    || /^(?:error|failed|failure|unavailable)$/i.test(String(payload.status || ''))
    || Number(payload.status) >= 400 || Number(payload.statusCode) >= 400) fail('failed response envelope')
}
const validateLocation = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !/^[A-Z]{2}$/.test(value.countryCode)
    || !text(value.country) || ['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(value.countryCode)
    || regionNames.of(value.countryCode) === value.countryCode
    || ![regionNames.of(value.countryCode), shortRegionNames.of(value.countryCode)].some(name => name.toLowerCase() === value.country.trim().toLowerCase())) fail('missing or contradictory native country')
  for (const field of ['city', 'region']) if (value[field] != null && typeof value[field] !== 'string') fail('malformed native location')
  return { ...value, country: regionNames.of(value.countryCode) }
}
const validateRecord = (record, config, timestamp) => {
  if (!record || !Number.isSafeInteger(record.id) || record.id <= 0 || !/^[A-Z0-9]{6,32}$/.test(record.shortcode)
    || !text(record.title) || record.accountUid !== config.accountUid || record.state !== 'published'
    || record.isInternal !== false || record.approvalStatus !== 'approved') fail('invalid account/public role identity')
  const date = nativeDate(record.published)
  if (date.iso && Date.parse(date.iso) > timestamp) fail('future native publication')
  if (!Array.isArray(record.locations) || !record.locations.length) fail('missing native locations')
  const locations = record.locations.map(validateLocation)
  const primary = validateLocation(record.location)
  if (!locations.some(value => locationKey(value) === locationKey(primary))) fail('primary and native location list disagree')
  return locations
}

export const createWatiNativeApi = config => ({
  async run({ fetchJson = fetchJsonWithRetry, signal, timeoutMs = 120000, maxPages = 100, now = () => new Date().toISOString() } = {}) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 300000) fail('invalid request budget')
    if (!Number.isSafeInteger(maxPages) || maxPages < 1) fail('invalid page limit')
    signal?.throwIfAborted()
    const deadline = new AbortController()
    const combined = composeAbortSignals(signal, deadline.signal)
    const timer = setTimeout(() => deadline.abort(Error('WATI source timed out')), timeoutMs)
    let onAbort
    const aborted = new Promise((_, reject) => {
      onAbort = () => reject(combined.reason)
      combined.addEventListener('abort', onAbort, { once: true })
    })
    const url = `https://apply.workable.com/api/v3/accounts/${config.tenant}/jobs`
    const request = (url, options = {}) => fetchJson(url, { ...options, signal: combined, timeoutMs: Math.min(timeoutMs, 20000), attempts: 1 })
    try {
      const collect = async () => {
        const checkedAt = now(), timestamp = Date.parse(checkedAt)
        if (!Number.isFinite(timestamp)) fail('invalid check time')
        const records = [], ids = new Set(), shortcodes = new Set(), cursors = new Set()
        let total, token, pagesFetched = 0
        do {
          combined.throwIfAborted()
          if (pagesFetched >= maxPages) fail('page limit leaves incomplete inventory')
          const body = { query: '', location: [], department: [], worktype: [], remote: [], ...(token ? { token } : {}) }
          const payload = await request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
          combined.throwIfAborted()
          envelope(payload)
          if (!Array.isArray(payload.results) || !Number.isSafeInteger(payload.total) || payload.total < 0
            || (total != null && total !== payload.total)) fail('invalid or changing native total')
          total = payload.total
          pagesFetched++
          for (const record of payload.results) {
            const locations = validateRecord(record, config, timestamp)
            if (ids.has(record.id) || shortcodes.has(record.shortcode)) fail('duplicate native identity')
            ids.add(record.id); shortcodes.add(record.shortcode)
            records.push({ record, locations })
          }
          if (records.length > total) fail('record count exceeds native total')
          token = undefined
          if (Object.hasOwn(payload, 'nextPage')) {
            if (!text(payload.nextPage) || cursors.has(payload.nextPage) || !payload.results.length || records.length >= total) fail('invalid or repeated native cursor')
            cursors.add(payload.nextPage); token = payload.nextPage
          }
        } while (token)
        if (records.length !== total) fail('terminal page leaves incomplete native count')
        const india = records.filter(({ locations }) => locations.some(location => location.countryCode === 'IN'))
        const jobs = []
        for (const { record, locations } of india) {
          combined.throwIfAborted()
          const detail = await request(`https://apply.workable.com/api/v2/accounts/${config.tenant}/jobs/${record.shortcode}`)
          combined.throwIfAborted()
          envelope(detail)
          const normalizedDetail = { ...detail, location: validateLocation(detail.location), locations: Array.isArray(detail.locations) ? detail.locations.map(validateLocation) : detail.locations }
          const job = mapWorkablePublicDetail(record, normalizedDetail, locations, { ...config, requiredContentSections: [] }, checkedAt)
          if (!hasSourceDescription(job)) job.jobDescription = job.sourceDescription = null
          jobs.push(job)
        }
        const complete = jobs.every(hasSourceDescription)
        for (const job of jobs) job.sourceListingComplete = complete
        return attachInventoryEvidence(jobs, { status: complete ? total ? 'complete-inventory' : 'verified-empty' : 'discovery-only',
          surface: url, firstParty: true, listingComplete: complete, pagesFetched, reportedTotal: total,
          indiaFacetCount: india.length, verifiedAt: checkedAt, reason: complete ? 'unfiltered-native-workable-count-and-terminal-cursor-reconciled'
            : 'selected-role-description-unavailable' })
      }
      return await Promise.race([collect(), aborted])
    } finally {
      clearTimeout(timer)
      combined.removeEventListener('abort', onAbort)
    }
  },
})
