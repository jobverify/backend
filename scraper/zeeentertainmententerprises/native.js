import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { extractOfficialRecruitmentLinks } from '../../scripts/officialRecruitmentLinks.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const BOARD = 'https://zee.sensehq.com/careers'
const ABOUT = 'https://www.zee.com/about-us/'
const CAREERS = 'https://www.zee.com/careers/'
const check = (condition, message) => { if (!condition) throw new Error(`ZEE native inventory: ${message}`) }
const text = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const decode = value => value.replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&(amp|quot|apos|nbsp|lt|gt);/g, (_, n) => ({amp:'&',quot:'"',apos:"'",nbsp:' ',lt:'<',gt:'>'})[n])

// Read active Next.js JSON and visible text without evaluating scripts. Raw text,
// comments and nested templates cannot supply employer links or role content.
const document = input => {
  check(typeof input === 'string', 'HTML response is not text')
  const tags = /<!--[\s\S]*?(?:-->|$)|<\/?([a-z][\w:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
  const raw = new Set(['script','style','textarea','title','xmp','iframe','noembed','noframes','noscript','plaintext'])
  const chunks = [], payloads = []
  let cursor = 0, templates = 0, tag
  while ((tag = tags.exec(input))) {
    if (!templates) chunks.push(input.slice(cursor, tag.index))
    cursor = tags.lastIndex
    if (!tag[1]) continue
    const name = tag[1].toLowerCase(), closing = tag[0].startsWith('</')
    if (name === 'template') { templates = Math.max(0, templates + (closing ? -1 : 1)); continue }
    if (closing) { if (!templates) chunks.push('\n'); continue }
    if (raw.has(name)) {
      const close = new RegExp(`</${name}\\s*>`, 'gi')
      close.lastIndex = tags.lastIndex
      const end = name === 'plaintext' ? null : close.exec(input)
      const attributes = [...tag[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)]
      const id = attributes.filter(m => m[1].toLowerCase() === 'id')
      if (!templates && name === 'script' && id.length === 1 && (id[0][2] ?? id[0][3] ?? id[0][4]) === '__NEXT_DATA__') {
        check(end, 'unterminated native JSON')
        payloads.push(JSON.parse(input.slice(tags.lastIndex, end.index)))
      }
      if (!end) { cursor = input.length; break }
      tags.lastIndex = close.lastIndex; cursor = tags.lastIndex
    } else if (!templates) chunks.push('\n')
  }
  if (!templates) chunks.push(input.slice(cursor))
  return { payloads, visible: decode(chunks.join(' ')).replace(/\s+/g, ' ').trim() }
}

const payload = (html, route, pageOrId) => {
  const parsed = document(html)
  check(parsed.payloads.length === 1, 'one active native JSON payload required')
  const data = parsed.payloads[0], props = data?.props?.pageProps, org = props?.organization
  for (const value of [data, data?.props, props, props?.jobsData]) if (value) {
    check(!value.error && !(Array.isArray(value.errors) ? value.errors.length : value.errors)
      && value.success !== false && value.isError !== true && (value.statusCode == null || value.statusCode === 200)
      && (value.status == null || [200,'ok','success'].includes(value.status)), 'upstream error envelope')
  }
  check(data.page === route && data.assetPrefix === '/careers' && data.isFallback === false
    && props?.preview === false && props.isIframe === false, 'native route, preview or fallback changed')
  check(org?.id === 5045 && org.name === 'Zee' && org.registered_name === 'ZEE Entertainment Enterprises Ltd.'
    && org.subdomain === 'zee' && org.career_page_subdomain === 'zee'
    && org.career_page?.organization_id === 5045 && org.career_page.hosting_type === 'SKILLATE', 'native employer or tenant mismatch')
  check(data.query && !Array.isArray(data.query) && typeof data.query === 'object', 'native query missing')
  if (route === '/jobs') check(Object.keys(data.query).every(key => key === 'page')
    && (pageOrId === 0 ? data.query.page == null || data.query.page === '0' : data.query.page === String(pageOrId)), 'listing page or filter mismatch')
  else check(data.query.id === String(pageOrId), 'native detail route ID mismatch')
  return { props, visible: parsed.visible }
}

const regions = new Intl.DisplayNames(['en'], { type: 'region' })
const countries = new Set()
const foreignCodes = []
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = regions.of(code)
  if (name !== code && !['ZZ','EU','UN','XA','XB','QO'].includes(code)) {
    countries.add(name.toLowerCase())
    if (code !== 'IN') foreignCodes.push(code)
  }
}
const trailingForeignCode = new RegExp(`[,;/]\\s*(?:${foreignCodes.join('|')})(?:\\s*[,;/)]|\\s*$)`, 'i')
const foreignLocation = value => /(?:^|[,;(/\s])(?:US|USA|UK|GB|AU|AUS|CA|SG|UAE)(?:$|[,;)/\s])/i.test(value)
  || trailingForeignCode.test(value)
  || [...countries].some(country => country !== 'india' && new RegExp(`(?:^|[\\s,;(/])${country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[\\s,;)/])`, 'i').test(value))
const country = row => {
  check(row.office && !Array.isArray(row.office) && typeof row.office === 'object', 'native office missing')
  const name = text(row.office.country)
  check(name && countries.has(name.toLowerCase()), 'unknown native office country')
  for (const value of [row.location, row.office.city, row.office.location, row.office.state, row.office.name]) {
    check(value == null || typeof value === 'string', 'malformed native office field')
    if (name.toLowerCase() === 'india') check(!foreignLocation(value || ''), 'conflicting foreign location label')
    else check(!/\bIndia\b/i.test(value || ''), 'conflicting India location label')
  }
  check([row.location, row.office.city, row.office.location].some(value => text(value)), 'native office location missing')
  return name.toLowerCase() === 'india' ? 'India' : name
}
const validateRow = (row, currentTime) => {
  check(row && !Array.isArray(row) && Number.isSafeInteger(row.id) && row.id > 0
    && row.organization_id === 5045 && text(row.title) && typeof row.code === 'string' && /^\d+$/.test(row.code)
    && row.job_status === 'OPEN', 'native role ID, employer, title, code or status changed')
  check(Number.isSafeInteger(row.created_on) && row.created_on >= Date.parse('2000-01-01')
    && row.created_on <= currentTime, 'native publication timestamp is invalid or future')
  check(row.description_external == null || typeof row.description_external === 'string', 'malformed native description')
  return country(row)
}

export const defaultZeeFetchText = async (url, { signal } = {}) => {
  signal?.throwIfAborted()
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' } })
  check(response.status === 200 && response.url === url, 'HTTP status or final URL changed')
  const body = await response.text()
  signal?.throwIfAborted()
  return body
}

export async function runZeeNative({ maxPages = 50, maxJobs = 500, mapRecord }, options = {}) {
  check(Number.isSafeInteger(maxPages) && maxPages > 0 && Number.isSafeInteger(maxJobs) && maxJobs > 0, 'invalid bounded source limits')
  const currentTime = Date.parse(options.now ? options.now() : new Date().toISOString())
  check(Number.isFinite(currentTime), 'invalid current time')
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000)
  const get = async url => {
    signal.throwIfAborted()
    let cancel
    const cancelled = new Promise((_, reject) => {
      cancel = () => reject(signal.reason)
      signal.addEventListener('abort', cancel, { once: true })
    })
    try {
      const body = await Promise.race([(options.fetchText || defaultZeeFetchText)(url, { signal }), cancelled])
      signal.throwIfAborted()
      return body
    } finally { signal.removeEventListener('abort', cancel) }
  }
  const about = await get(ABOUT)
  check(/Zee Entertainment Enterprises Limited/i.test(document(about).visible), 'corporate company identity missing')
  const careers = await get(CAREERS)
  check(/Zee Entertainment Enterprises Limited/i.test(document(careers).visible)
    && extractOfficialRecruitmentLinks(careers, CAREERS).some(url => url.href === BOARD), 'current corporate recruitment handoff missing')

  const rows = [], seen = new Set()
  let total = null, pages = 0, listingComplete = false
  for (let page = 0; page < maxPages; page++) {
    const { props } = payload(await get(`${BOARD}/jobs${page === 0 ? '' : `?page=${page}`}`), '/jobs', page)
    const data = props.jobsData
    check(data && Array.isArray(data.rows) && Number.isSafeInteger(data.count) && data.count >= 0, 'explicit inventory rows/total missing')
    if (total == null) total = data.count
    check(data.count === total && data.rows.length === Math.min(10, total - page * 10), 'native pagination total or page size changed')
    pages++
    for (const row of data.rows) {
      validateRow(row, currentTime)
      check(!seen.has(row.id), 'duplicate pagination identity')
      seen.add(row.id); rows.push(row)
    }
    if (seen.size === total) { listingComplete = true; break }
    if (rows.length >= maxJobs) break
  }
  if (listingComplete) {
    const { props } = payload(await get(`${BOARD}/jobs`), '/jobs', 0)
    check(props.jobsData?.count === total && Array.isArray(props.jobsData.rows)
      && JSON.stringify(props.jobsData.rows.map(row => row.id)) === JSON.stringify(rows.slice(0, 10).map(row => row.id)), 'inventory changed during check')
  }
  const india = rows.filter(row => country(row) === 'India')
  const selected = india.slice(0, maxJobs), jobs = new Array(selected.length)
  let index = 0
  await Promise.all(Array.from({ length: Math.min(4, selected.length) }, async () => {
    while (index < selected.length) {
      const offset = index++, row = selected[offset], url = `${BOARD}/jobs/${row.id}`
      let record = row, description = '', detailComplete = false, failure = null
      try {
        const { props } = payload(await get(url), '/job', row.id)
        const detail = props.job
        check(validateRow(detail, currentTime) === 'India' && detail.id === row.id && detail.code === row.code
          && detail.title === row.title && detail.created_on === row.created_on && detail.is_active === true
          && detail.is_published === true && detail.is_deleted === false, 'native detail identity or publication status changed')
        for (const key of ['country', 'city', 'location', 'state']) check(detail.office[key] === row.office[key], 'native detail office changed')
        check(detail.location === row.location && (detail.skills_and_expertise_external == null
          || typeof detail.skills_and_expertise_external === 'string'), 'native detail location or skills shape changed')
        record = detail
        check(hasSourceDescription({ sourceDescription: document(detail.description_external || '').visible }), 'native full description is empty')
        description = detail.description_external + (text(detail.skills_and_expertise_external) ? `\n<h2>Skills and expertise</h2>\n${detail.skills_and_expertise_external}` : '')
        detailComplete = true
      } catch (error) {
        signal.throwIfAborted()
        failure = /description is empty/.test(error.message) ? 'missing-content' : 'native-detail-failed'
      }
      const mapped = mapRecord(record)
      check(mapped, 'validated native India role could not be mapped')
      jobs[offset] = { ...mapped, country: 'India', jobDescription: description ? document(description).visible : '',
        sourceDescription: description, source: 'zeeentertainmententerprises', sourceUrl: url, applyUrl: url, link: url,
        postedAt: new Date(row.created_on).toISOString(), sourceDetailComplete: detailComplete, sourceDetailFailureKind: failure,
        sourceNativeOrganizationId: 5045, sourceGlobalJobCount: total, sourceDescriptionFormat: 'native-html',
        scrapedAt: new Date().toISOString() }
    }
  }))
  const complete = listingComplete && selected.length === india.length && jobs.every(job => job.sourceDetailComplete)
  for (const job of jobs) job.sourceListingComplete = complete
  signal.throwIfAborted()
  return attachInventoryEvidence(jobs, { status: listingComplete ? total === 0 ? 'verified-empty' : 'complete-inventory' : 'coverage-gap',
    surface: `${BOARD}/jobs`, firstParty: true, listingComplete, pagesFetched: pages, reportedTotal: total,
    indiaFacetCount: listingComplete ? india.length : null, verifiedAt: new Date().toISOString(),
    reason: listingComplete ? 'stable-native-public-global-inventory; detail-health-is-separate' : 'bounded-native-pagination-incomplete' })
}
