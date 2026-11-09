import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

export const SOURCE = 'sunrun'
export const COMPANY = 'Sunrun'
export const OFFICIAL_CAREERS_URL = 'https://careers.sunrun.com/en/search-jobs'
export const HANDOFF_URL = 'https://careers.sunrun.com/explore-your-future'
export const BOARD_URL = 'https://sunrun.wd5.myworkdayjobs.com/en-US/Sunrun_Careers'
export const API_ROOT = 'https://sunrun.wd5.myworkdayjobs.com/wday/cxs/sunrun/Sunrun_Careers'
const PUBLIC_ROOT = 'https://sunrun.wd5.myworkdayjobs.com/Sunrun_Careers'
const PAGE_SIZE = 20
const EMPLOYERS = ['Sunrun Inc.', 'Sunrun Installation Services Inc.', '']
const text = value => typeof value === 'string' && value.trim().length > 0
const fail = reason => { throw Error('Sunrun native inventory: ' + reason) }

function validateEnvelope(payload) {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object'
    || payload.error || (Array.isArray(payload.errors) ? payload.errors.length : payload.errors)
    || payload.errorCode || payload.messageCode
    || (payload.status != null && ![200, '200', 'ok', 'success'].includes(payload.status))
    || payload.success === false || payload.ok === false || payload.failed === true
    || payload.hasError === true || payload.statusCode >= 400 || payload.httpStatus >= 400) {
    fail('failed response envelope')
  }
  return payload
}

const STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ')
const statePrefix = new RegExp('^(?:(?:CORPORATE|BRANCH|METROMARKET) - )?(?:' + STATES.join('|') + ')(?:, | - ).+', 'i')
const stateSuffix = new RegExp('(?:,| - )\\s*(?:' + STATES.join('|') + ')\\s*$', 'i')
const regionNames = new Map()
const display = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
for (let a = 65; a <= 90; a++) {
  for (let b = 65; b <= 90; b++) {
    const code = String.fromCharCode(a, b), name = display.of(code)
    if (name && name.length > 3) regionNames.set(name.toLowerCase(), code)
  }
}

function country(value) {
  if (!value || !text(value.descriptor) || !text(value.id)) fail('missing country geography')
  let code = value.alpha2Code
  if (value.id === 'bc33aa3152ec42d4995f4791a106ed09') code = 'US'
  if (value.id === 'c4f78be1a8f14da0ab49ce1162348a5e') code = 'IN'
  const names = { US: ['United States of America', 'United States'], IN: ['India'] }
  if (!code || !names[code]?.includes(value.descriptor)
    || (value.alpha2Code && value.alpha2Code !== code)) {
    fail('unsupported or contradictory country geography')
  }
  return code
}

function labelCountry(label, nativeCountry) {
  if (!text(label)) fail('missing location geography')
  const codes = new Set()
  for (const part of label.split(/[,;()]/)) {
    const code = regionNames.get(part.trim().toLowerCase())
    if (code) codes.add(code)
  }
  if (/\bIndia\b/i.test(label)) codes.add('IN')
  if (/\b(?:United States(?: of America)?|USA)\b/i.test(label)
    || statePrefix.test(label) || stateSuffix.test(label)) codes.add('US')
  if (codes.size > 1 || [...codes].some(code => nativeCountry && code !== nativeCountry)) {
    fail('contradictory location geography')
  }
  return [...codes][0]
}

function locationsFor(detail) {
  const primary = country(detail.country)
  if (primary !== country(detail.jobRequisitionLocation?.country)) fail('contradictory native country geography')
  labelCountry(detail.location, primary)
  labelCountry(detail.jobRequisitionLocation.descriptor, primary)
  if (detail.additionalLocations != null && !Array.isArray(detail.additionalLocations)) {
    fail('invalid secondary geography')
  }
  const locations = [{ label: detail.location, country: primary }]
  for (const value of detail.additionalLocations ?? []) {
    const label = typeof value === 'string' ? value : value.descriptor ?? value.location
    const code = typeof value === 'string' ? labelCountry(label) : country(value?.country)
    if (!code) fail('unknown secondary geography')
    labelCountry(label, code)
    locations.push({ label, country: code })
  }
  return locations
}

function publication(value) {
  if (value == null || value === '') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value))
    || new Date(value).toISOString().slice(0, 10) !== value) fail('invalid native publication date')
  return value
}

function activeDescription(html) {
  if (typeof html !== 'string') return null
  // Preserve the original employer HTML; this copy only checks source presence.
  const check = html.replace(/<([a-z][\w:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi,
    (tag, name, attrs) => /(?:^|\s)inert(?:\s|=|$)/i.test(attrs)
      ? tag.replace('<' + name, '<' + name + ' hidden') : tag)
  const active = extractActiveDescription(check.replace(/<(h[1-6]|strong|b)\b[^>]*>[\s\S]*?<\/\1>/gi, ''))
  return active && hasSourceDescription({ sourceDescription: active }) ? html : null
}

function verifyRecruitingLinks(doc, pageUrl) {
  const purpose = /(?:\b(?:search|browse|view|find|explore|see|discover)\b[\s\S]{0,60}\b(?:jobs?|roles?|positions?|openings?|careers?|opportunities)\b|\b(?:open|current|available)\s+(?:jobs?|roles?|positions?|openings?)\b|\b(?:apply\s*(?:now|here)|job\s*search|careers?|career\s+opportunities)\b)/i
  const controls = doc.nodes(node => ['a', 'form', 'button'].includes(node.tag))
  for (const node of controls) {
    const label = [doc.text(node), node.attrs['aria-label'], node.attrs.title,
      node.attrs['data-custom-label']].filter(Boolean).join(' ')
    if (!purpose.test(label) || /\b(?:privacy|policy|terms)\b/i.test(label)) continue
    const target = node.attrs.href ?? node.attrs.action ?? node.attrs.formaction ?? node.attrs['data-href']
    // A search toggle or submit button without a destination adds no new handoff.
    if (!target || target.startsWith('#')) continue
    let url
    try { url = new URL(target, pageUrl) } catch { fail('invalid recruiting handoff') }
    if (url.href === BOARD_URL) continue
    if (url.origin === 'https://careers.sunrun.com') {
      const knownInternal = /^\/(?:en\/)?(?:search-jobs(?:&p=\d+)?|explore-your-future|featured-jobs|saved-jobs)\/?$/
      const knownJob = /^\/en\/job\/[^/]+\/[^/]+\/21632\/\d+$/
      const login = url.pathname === '/sys/tc/sign-in'
      if (knownInternal.test(url.pathname) || knownJob.test(url.pathname) || login) continue
    }
    fail('new or ambiguous recruiting handoff: ' + url.href)
  }
}

async function verifyHandoff(fetchPage) {
  for (const url of [HANDOFF_URL, OFFICIAL_CAREERS_URL]) {
    const page = await fetchPage(url)
    if (page.status !== 200 || page.url !== url || typeof page.html !== 'string'
      || !/<\/html>/i.test(page.html) || !/<\/body>/i.test(page.html)) fail('invalid official handoff page')
    const doc = document(page.html)
    verifyRecruitingLinks(doc, url)
    if (!doc.nodes(node => node.tag === 'a' && node.attrs.href === BOARD_URL).length) {
      fail('official Workday handoff changed')
    }
  }
  const board = await fetchPage(BOARD_URL)
  if (board.status !== 200 || board.url !== BOARD_URL || typeof board.html !== 'string'
    || !/<\/html>/i.test(board.html) || !/tenant:\s*"sunrun"/.test(board.html)
    || !/siteId:\s*"Sunrun_Careers"/.test(board.html) || !/isExternal:\s*true/.test(board.html)) {
    fail('native public board identity changed')
  }
}

async function enumerateListings(fetchJson) {
  const listings = [], seenPaths = new Set(), seenReqs = new Set()
  let total, pages = 0
  do {
    const offset = listings.length
    const payload = validateEnvelope(await fetchJson(API_ROOT + '/jobs', {
      method: 'POST',
      body: JSON.stringify({ appliedFacets: {}, limit: PAGE_SIZE, offset, searchText: '' }),
    }))
    pages++
    if (!Number.isSafeInteger(payload.total) || payload.total < 0 || !Array.isArray(payload.jobPostings)) {
      fail('invalid native listing count')
    }
    if (total === undefined) {
      total = payload.total
      if (total > 5000) fail('native inventory safety cap')
    } else if (payload.total !== 0 && payload.total !== total) fail('native count changed')
    // Workday's observed offset pages report total=0 even when returning jobs.
    if (payload.jobPostings.length !== Math.min(PAGE_SIZE, total - offset)) fail('incomplete native pagination')
    for (const row of payload.jobPostings) {
      if (!text(row.title) || !/^\/job\/[^/?#]+\/[^/?#]+_R\d+(?:-\d+)?$/.test(row.externalPath)
        || !Array.isArray(row.bulletFields) || !/^R\d+$/.test(row.bulletFields[0])
        || seenPaths.has(row.externalPath) || seenReqs.has(row.bulletFields[0])) {
        fail('duplicate or invalid native listing identity')
      }
      seenPaths.add(row.externalPath)
      seenReqs.add(row.bulletFields[0])
      listings.push(row)
    }
  } while (listings.length < total)
  return { listings, total, pages }
}

function validateDetail(payload, row, ids) {
  const detail = payload.jobPostingInfo
  if (!detail || !/^[a-f0-9]{32}$/.test(detail.id) || ids.has(detail.id)
    || detail.title !== row.title || detail.jobReqId !== row.bulletFields[0]
    || detail.jobPostingId !== row.externalPath.split('/').at(-1)
    || detail.jobPostingSiteId !== 'Sunrun_Careers' || detail.externalUrl !== PUBLIC_ROOT + row.externalPath
    || detail.posted !== true || detail.canApply !== true
    || !EMPLOYERS.includes(payload.hiringOrganization?.name ?? '')) {
    fail('native detail identity or public status mismatch')
  }
  ids.add(detail.id)
  return detail
}

function mapIndiaJob(detail, locations, postedDate) {
  const india = locations.filter(location => location.country === 'IN').map(location => location.label)
  if (!india.length) return null
  const description = activeDescription(detail.jobDescription)
  return {
    id: detail.jobReqId, jobId: detail.jobReqId, title: detail.title, company: COMPANY,
    location: india[0], locations: [...new Set(india)], city: india[0].split(',')[0].trim(), country: 'India',
    sourceLocations: locations.map(location => location.label),
    description, jobDescription: description, sourceDescription: description,
    postingDate: postedDate, postedDate, sourceUrl: detail.externalUrl, url: detail.externalUrl,
    link: detail.externalUrl + '/apply', applyUrl: detail.externalUrl + '/apply',
    companyCareerPage: OFFICIAL_CAREERS_URL, atsPlatform: 'workday', source: SOURCE,
    scrapedAt: new Date().toISOString(), employmentType: detail.timeType ?? null,
    sourceListingComplete: Boolean(description),
  }
}

export const createSunrunScraper = (defaults = {}) => ({
  async run(options = {}) {
    const config = { ...defaults, ...options }, controller = new AbortController(), signal = controller.signal
    const timeoutMs = config.timeoutMs ?? 120000
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 300000) fail('invalid timeout')
    const abort = () => controller.abort(config.signal.reason ?? Error('Sunrun cancelled'))
    if (config.signal?.aborted) abort()
    else config.signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(() => controller.abort(Error('Sunrun inventory timed out')), timeoutMs)

    async function bounded(action) {
      if (signal.aborted) throw signal.reason
      let listener
      const stopped = new Promise((_, reject) => {
        listener = () => reject(signal.reason)
        signal.addEventListener('abort', listener, { once: true })
      })
      try { return await Promise.race([Promise.resolve().then(action), stopped]) }
      finally { signal.removeEventListener('abort', listener) }
    }
    const fetchJson = (url, request = {}) => bounded(async () => {
      if (config.fetchJson) return config.fetchJson(url, { ...request, signal })
      const response = await (config.fetch ?? fetch)(url, {
        ...request, signal, redirect: 'error',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...request.headers },
      })
      if (response.status !== 200 || (response.url && response.url !== url)) fail('native HTTP failure or redirect')
      return response.json()
    })
    const fetchPage = url => bounded(async () => {
      if (config.fetchPage) return config.fetchPage(url, { signal })
      const response = await (config.fetch ?? fetch)(url, { signal, redirect: 'error' })
      return { url: response.url, status: response.status, html: await response.text() }
    })

    try {
      await verifyHandoff(fetchPage)
      const { listings, total, pages } = await enumerateListings(fetchJson)
      const jobs = [], ids = new Set()
      let index = 0
      async function worker() {
        while (index < listings.length) {
          const row = listings[index++]
          const payload = validateEnvelope(await fetchJson(API_ROOT + row.externalPath))
          const detail = validateDetail(payload, row, ids)
          const locations = locationsFor(detail)
          const postedDate = publication(detail.startDate)
          const job = mapIndiaJob(detail, locations, postedDate)
          if (job) jobs.push(job)
        }
      }
      await Promise.all(Array.from({ length: Math.min(6, listings.length) }, worker))
      const missing = jobs.some(job => !job.sourceListingComplete)
      return attachInventoryEvidence(jobs, {
        status: missing ? 'discovery-only' : total ? 'complete-inventory' : 'verified-empty',
        surface: API_ROOT + '/jobs', firstParty: true, listingComplete: !missing,
        pagesFetched: pages, reportedTotal: total, indiaFacetCount: jobs.length, verifiedAt: new Date().toISOString(),
        reason: `Enumerated ${total} native public postings and all country/secondary-location details; ${missing ? 'India source descriptions incomplete' : 'India scope complete'}`,
      })
    } catch (error) {
      controller.abort(error)
      throw error
    } finally {
      clearTimeout(timer)
      config.signal?.removeEventListener('abort', abort)
    }
  },
})

export const run = options => createSunrunScraper().run(options)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const rows = await run()
  if (process.argv.includes('--dry-run')) {
    saveToFile(rows, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  } else await saveToDB(rows, SOURCE)
}
