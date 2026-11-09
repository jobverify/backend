import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { activeScripts, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { parseJavaScriptLiteral, decodeJavaScriptStringLiteral } from '../../scraper-support/utils/safeLiteral.js'
import { attachInventoryEvidence, normalizeInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { buildHttpError } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'jungleworks'
export const COMPANY = 'Jungleworks'
export const FIRST_PARTY_ROOT_URL = 'https://jungleworks.com/careers/'
export const OFFICIAL_ATS_URL = 'https://jungleworks.zohorecruit.in/jobs/Careers'

export const API_URL = 'https://jungleworks.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite'
const proof = (ok, message) => { if (!ok) throw Error('Jungleworks: ' + message) }
const hidden = (html, id) => {
  const inputs = document(html).nodes(n => n.tag === 'input' && n.attrs.id === id)
  proof(inputs.length === 1 && inputs[0].attrs.type === 'hidden', 'missing/ambiguous native ' + id)
  return JSON.parse(inputs[0].attrs.value)
}
const identity = meta => proof(meta?.org_info?.company_name === COMPANY && meta.org_info.website === 'www.jungleworks.com'
  && meta.org_info.id === '69660000000230516' && meta.page_id === '69660000000230662'
  && meta.source === 'CareerSite' && meta.page_name === 'Careers' && meta.list_url === OFFICIAL_ATS_URL, 'native employer/page identity changed')
const indiaStates = new Set('Andaman and Nicobar Islands|Andhra Pradesh|Arunachal Pradesh|Assam|Bihar|Chandigarh|Chhattisgarh|Dadra and Nagar Haveli and Daman and Diu|Delhi|Goa|Gujarat|Haryana|Himachal Pradesh|Jammu and Kashmir|Jharkhand|Karnataka|Kerala|Ladakh|Lakshadweep|Madhya Pradesh|Maharashtra|Manipur|Meghalaya|Mizoram|Nagaland|Odisha|Puducherry|Punjab|Rajasthan|Sikkim|Tamil Nadu|Telangana|Tripura|Uttar Pradesh|Uttarakhand|West Bengal'.toLowerCase().split('|'))
const validate = rows => {
  proof(Array.isArray(rows), 'malformed native inventory')
  const ids = new Set()
  for (const row of rows) {
    proof(row && typeof row.id === 'string' && /^\d+$/.test(row.id) && !ids.has(row.id) && norm(row.Posting_Title)
      && row.Posting_Title === row.Job_Opening_Name && typeof row.Publish === 'boolean' && typeof row.Is_Locked === 'boolean', 'invalid/duplicate native job identity')
    ids.add(row.id)
    const country = nativeCountryName(row.Country)
    proof(country, 'unknown native country scope')
    if (country === 'India' && row.State != null && norm(row.State)) proof(indiaStates.has(norm(row.State).toLowerCase()), 'unknown or contradictory India state')
    // This employer exposes a single City/State/Country address.
    for (const key of Object.keys(row)) proof(!/(?:location|country|state|city|address)/i.test(key) || ['Country','State','City'].includes(key), 'unreviewed primary/secondary geographic scope')
    for (const label of [row.City, row.State]) {
      const declared = nativeLocationCountryName(label)
      proof(!declared || declared === country, 'contradictory primary geographic country')
    }
    proof(!/[;|/]|\b(?:worldwide|global|multiple locations|anywhere)\b/i.test(String(row.City || '') + ' ' + String(row.Country)), 'unknown multiple-location geographic scope')
  }
  return rows
}
const sameRow = (left, right) => ['id','Posting_Title','Job_Opening_Name','City','State','Country','Publish','Is_Locked'].every(key => (left[key] ?? null) === (right[key] ?? null))
const nativeUrl = row => {
  let url
  try { url = new URL(row.$url) } catch { proof(false, 'missing native job URL') }
  proof(url.origin === 'https://jungleworks.zohorecruit.in' && new RegExp('^/jobs/Careers/' + row.id + '/[^/]+$').test(url.pathname)
    && url.search === '?source=CareerSite' && !url.hash, 'native job URL identity mismatch')
  return url.href
}
const descriptionContent = value => {
  if (typeof value !== 'string') return null
  const visible = html => {
    const doc = document(html)
    const prune = (node, inherited = false) => {
      node.inactive ||= inherited || /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test(node.attrs?.style || '')
      node.children.filter(child => typeof child !== 'string').forEach(child => prune(child, node.inactive))
    }
    prune(doc.root)
    return extractActiveDescription(html) ? extractActiveDescription(doc.text(doc.root)) : null
  }
  const content = visible(value)
  const body = visible(value.replace(/<(h[1-6]|strong|b)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ''))
  return content && body && !/^(?:responsibilities|requirements|qualifications|about the role)[\s:.]*$/i.test(body) ? content : null
}
export const readDetail = (html, row) => {
  const scripts = activeScripts(html)
  const jobMatches = scripts.flatMap(script => [...script.matchAll(/\bvar jobs\s*=\s*JSON\.parse\(('(?:\\.|[^'\\])*')\)\s*;/g)])
  const metas = scripts.flatMap(script => [...script.matchAll(/\bvar meta\s*=\s*(\{[^\n]*\})\s*;/g)])
  proof(jobMatches.length === 1 && metas.length === 1, 'missing/ambiguous native detail payload')
  const meta = parseJavaScriptLiteral(metas[0][1])
  identity(meta)
  proof(meta.detail_url === row.$url, 'detail URL identity mismatch')
  const records = validate(JSON.parse(decodeJavaScriptStringLiteral(jobMatches[0][1])))
  proof(records.length === 1 && ['id','Posting_Title','Job_Opening_Name','City','State','Country','Publish','Is_Locked']
    .every(key => row[key] == null || records[0][key] === row[key]), 'detail/listing identity or country mismatch')
  return records[0]
}

export const run = async ({ fetchImpl = fetch, signal, timeoutMs = 45000, now = () => new Date().toISOString(), maxJobs = null } = {}) => {
  signal?.throwIfAborted()
  proof(Number.isFinite(timeoutMs) && timeoutMs > 0 && (maxJobs === null || Number.isSafeInteger(maxJobs) && maxJobs >= 0), 'invalid runtime bounds')
  const controller = new AbortController()
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
  let timer, listener
  const aborted = new Promise((_, reject) => {
    listener = () => reject(combined.reason)
    combined.addEventListener('abort', listener, { once: true })
    timer = setTimeout(() => controller.abort(Error('Jungleworks aggregate deadline exceeded')), timeoutMs)
  })
  const collect = async () => {
    let pagesFetched = 0
    const read = async url => {
      combined.throwIfAborted()
      const response = await fetchImpl(url, { signal: combined, redirect: 'error', headers: { Accept: 'text/html,application/json', 'User-Agent': 'Mozilla/5.0' } })
      combined.throwIfAborted()
      if (response.status !== 200 || response.url !== url) {
        const error = response.status !== 200 ? buildHttpError(response, url) : Error('Jungleworks native final URL changed')
        const reason = `Jungleworks native HTTP ${response.status} for ${url}; final URL ${response.url}; inventory unavailable`
        Object.assign(error, {message: reason, code: [401,403].includes(response.status) ? 'access_denied' : 'native_inventory_unavailable',
          requestUrl: url, finalUrl: response.url, failureKind: 'incomplete_listing', source: SOURCE,
          sourceListingComplete: false, sourceScopeComplete: false,
          inventoryEvidence: normalizeInventoryEvidence({status:'coverage-gap',surface:url,firstParty:true,listingComplete:false,
            pagesFetched:pagesFetched+1,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason})})
        if ([202,401,403].includes(response.status) || response.url !== url) error.abortRetries = true
        void Promise.resolve().then(() => response.body?.cancel?.(error)).catch(() => {})
        throw error
      }
      const body = await response.text()
      combined.throwIfAborted()
      pagesFetched++
      return body
    }
    const official = document(await read(FIRST_PARTY_ROOT_URL))
    proof(official.nodes(n => n.tag === 'a' && n.attrs.href === OFFICIAL_ATS_URL).length > 0, 'official ATS handoff changed')
    const board = await read(OFFICIAL_ATS_URL)
    identity(hidden(board, 'meta'))
    const portalRows = validate(hidden(board, 'jobs'))
    const payload = JSON.parse(await read(API_URL))
    proof(payload.code === 'success' && payload.info?.page_name === 'Careers', 'malformed native API success contract')
    for (const scope of [payload, payload.info]) {
      for (const key of ['more_records','moreRecords','hasMore','has_more','next','next_page','nextPage','nextCursor','next_cursor','cursor','continuationToken','pagination'])
        proof(scope[key] == null || scope[key] === false || scope[key] === '', 'native pagination incomplete')
    }
    const rows = validate(payload.data)
    rows.forEach(nativeUrl)
    for (const scope of [payload, payload.info]) for (const key of ['total','total_count','totalCount'])
      if (scope[key] != null) proof(scope[key] === rows.length, 'native reported total mismatch')
    proof(rows.length === portalRows.length && rows.every(row => portalRows.some(portal => sameRow(row, portal))), 'API/portal inventory mismatch')
    const selected = rows.filter(row => row.Publish && !row.Is_Locked && nativeCountryName(row.Country) === 'India')
    const limited = maxJobs === null ? selected : selected.slice(0, maxJobs)
    const jobs = []
    for (const row of limited) {
      const url = nativeUrl(row)
      const detail = readDetail(await read(url), row)
      const description = descriptionContent(detail.Job_Description)
      jobs.push({ source: SOURCE, company: COMPANY, jobId: row.id, requisitionId: null, title: norm(row.Posting_Title),
        sourceUrl: url, applyUrl: url, link: url, country: 'India', city: norm(detail.City) || null, state: norm(detail.State) || null,
        location: [detail.City,detail.State,'India'].filter(Boolean).join(', '), employmentType: norm(detail.Job_Type) || null,
        experienceRequired: norm(detail.Work_Experience) || null,
        department: norm(row.Industry) || null, jobDescription: description, sourceDescription: description,
        sourceDetailComplete: Boolean(description), sourceDetailStatus: description ? 'complete' : 'partial',
        sourceDetailFailureKind: description ? null : 'missing-content', sourceListingComplete: false,
        postingDate: null, postedAt: null, nativeDateOpened: detail.Date_Opened ?? null, nativeDateOpenedIsPublicationDate: false,
        scrapedAt: now(), nativeListingRecord: row, nativePrimaryCountry: row.Country,
        nativeLocationEvidence: [{ city: detail.City ?? null, state: detail.State ?? null, country: detail.Country }],
      })
    }
    const complete = limited.length === selected.length && jobs.every(job => job.sourceDetailComplete)
    jobs.forEach(job => { job.sourceListingComplete = complete })
    return attachInventoryEvidence(jobs, { status: complete ? rows.length ? 'complete-inventory' : 'verified-empty' : 'discovery-only',
      firstParty: true, surface: API_URL, listingComplete: complete, pagesFetched, reportedTotal: rows.length, indiaFacetCount: null,
      verifiedAt: now(), reason: complete ? 'Unfiltered native Zoho API matches full portal inventory; every native country and India detail validated.' : 'Native inventory retained with incomplete description or output cap.' })
  }
  try { return await Promise.race([collect(), aborted]) } finally { clearTimeout(timer); combined.removeEventListener('abort', listener) }
}
export const createJungleworksScraper = () => ({ run })
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
