import { attachInventoryEvidence } from '../utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const fail = message => { throw new Error(`SuccessFactors RMK: ${message}`) }
const requireProof = (ok, message) => { if (!ok) fail(message) }
const decode = value => String(value ?? '').replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&(?:amp|quot|apos|nbsp|lt|gt|ndash|mdash|hellip);/g, name => ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ', '&lt;': '<', '&gt;': '>', '&ndash;': '–', '&mdash;': '—', '&hellip;': '…' })[name])
const text = value => decode(String(value ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
const attributes = tag => [...tag.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)]
const attr = (tag, key) => {
  for (const match of attributes(tag)) if (match[1].toLowerCase() === key.toLowerCase()) return decode(match[2] ?? match[3] ?? match[4] ?? '')
  return ''
}
const nativeDom = html => {
  const inert = [], output = []
  const raw = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'noscript', 'noembed', 'noframes', 'iframe', 'plaintext'])
  let cursor = 0
  for (const tag of String(html).matchAll(/<!--[\s\S]*?(?:-->|$)|<\/?([a-z][a-z0-9:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi)) {
    if (!inert.length) output.push(html.slice(cursor, tag.index))
    cursor = tag.index + tag[0].length
    if (!tag[1]) continue
    const name = tag[1].toLowerCase(), closing = tag[0].startsWith('</')
    if (raw.has(inert.at(-1))) {
      if (closing && name === inert.at(-1) && name !== 'plaintext') inert.pop()
      continue
    }
    if (closing) {
      if (name === 'template' && inert.at(-1) === name) inert.pop()
      else if (!inert.length) output.push(tag[0])
      continue
    }
    if (name === 'template' || raw.has(name)) { inert.push(name); continue }
    if (!inert.length) output.push(tag[0])
  }
  if (!inert.length) output.push(html.slice(cursor))
  return output.join('')
}
const elements = (html, tag, predicate) => [...String(html).matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'gi'))].filter(m => predicate(m[1])).map(m => m[2])
const classHas = (tag, name) => attr(tag, 'class').split(/\s+/).includes(name)
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
const countries = new Set()
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b)
  if (regionNames.of(code) !== code && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code)) countries.add(code)
}
const locationCountry = location => {
  const parts = text(location).split(',').map(part => part.trim())
  // Native RMK appends postal codes after the explicit country code.
  const last = parts.at(-1)
  const brazilPostal = parts.at(-2) === 'BR' && /^\d{2}\.\d{3}-\d{3}$/.test(last)
  const suffix = parts.length > 1 && /\d/.test(last) && (/^[\da-z -]+$/i.test(last) || brazilPostal) ? parts.at(-2) : last
  const code = /^(India|IN)$/i.test(suffix) ? 'IN' : suffix.toUpperCase()
  requireProof(countries.has(code), `Unknown native location country: ${location}`)
  return code
}
export const readRmkLocationCountry = locationCountry
const activeInlineScripts = html => {
  const inert = [], scripts = []
  const raw = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'noscript', 'noembed', 'noframes', 'iframe', 'plaintext'])
  let scriptStart = null
  for (const tag of String(html).matchAll(/<!--[\s\S]*?(?:-->|$)|<\/?([a-z][a-z0-9:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi)) {
    if (!tag[1]) continue
    const name = tag[1].toLowerCase(), closing = tag[0].startsWith('</')
    if (raw.has(inert.at(-1))) {
      if (closing && name === inert.at(-1) && name !== 'plaintext') {
        if (name === 'script' && inert.length === 1 && scriptStart !== null) scripts.push(html.slice(scriptStart, tag.index))
        inert.pop(); scriptStart = null
      }
      continue
    }
    if (closing) { if (name === 'template' && inert.at(-1) === name) inert.pop(); continue }
    if (name === 'script' && !inert.length && !attributes(tag[2]).some(m => ['src', 'nomodule'].includes(m[1].toLowerCase()))
      && ['', 'text/javascript', 'application/javascript', 'module'].includes(attr(tag[2], 'type').trim().toLowerCase())) scriptStart = tag.index + tag[0].length
    if (name === 'template' || raw.has(name)) inert.push(name)
  }
  return scripts
}
const verifyTenant = (html, config) => {
  const tokens = activeInlineScripts(html).flatMap(script => {
    const lexical = [...script.matchAll(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|[^\s]/g)]
      .map(match => match[0]).filter(value => !value.startsWith('/*') && !value.startsWith('//'))
    const values = []
    for (let index = 1; index < lexical.length - 2; index++) {
      if (/^(["'])ssoCompanyId\1$/.test(lexical[index]) && ['{', ','].includes(lexical[index - 1]) && lexical[index + 1] === ':') {
        const value = lexical[index + 2].match(/^(["'])([^"']+)\1$/)
        requireProof(value, 'Native company token literal unavailable')
        values.push(value[2])
      }
    }
    return values
  })
  requireProof(tokens.length > 0 && tokens.every(token => token === config.companyToken), 'Native company token mismatch or unavailable')
}
export const verifyRmkCompanyToken = verifyTenant
const nativeUrl = (href, config, pattern) => {
  const url = new URL(href, config.origin)
  requireProof(url.origin === config.origin && !url.username && !url.password && pattern.test(url.pathname), 'Unexpected native URL')
  return url.href
}

export function parseRmkListing(html, config) {
  verifyTenant(html, config)
  html = nativeDom(html)
  const labels = elements(html, 'span', tag => classHas(tag, 'paginationLabel')).map(text)
  const totals = labels.map(label => label.match(/Results\s+(\d+)\s*[–—-]\s*(\d+)\s+of\s+(\d+)$/i))
  requireProof(totals.length && totals.every(Boolean), 'Native pagination range and total required')
  const [start, end, total] = totals[0].slice(1).map(Number)
  requireProof(totals.every(m => m.slice(1).map(Number).join() === [start, end, total].join()), 'Conflicting pagination totals')
  requireProof(Number.isSafeInteger(total) && total > 0 && total <= 10000 && start >= 1 && end >= start && end <= total, 'Invalid pagination range')
  const jobs = elements(html, 'tr', tag => classHas(tag, 'data-row')).map(row => {
    const links = [...row.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].filter(m => classHas(m[1], 'jobTitle-link'))
    requireProof(links.length > 0, 'Native listing role link missing')
    const sourceUrl = nativeUrl(attr(links[0][1], 'href'), config, /^\/job\/[^/]+\/\d+\/$/)
    const title = text(links[0][2])
    requireProof(title && links.every(m => nativeUrl(attr(m[1], 'href'), config, /^\/job\/[^/]+\/\d+\/$/) === sourceUrl && text(m[2]) === title), 'Conflicting responsive role links')
    const rawLocations = [...new Set(spanContents(row, tag => classHas(tag, 'jobLocation')).map(text))]
    const additional = rawLocations.map(value => Number(value.match(/\+(\d+)\s+more…?$/i)?.[1] || 0))
    requireProof(new Set(additional).size === 1, 'Conflicting grouped location counts')
    const locations = rawLocations.map(value => value.replace(/\s*\+\d+\s+more…?$/i, '').trim())
    requireProof(locations.length > 0 && locations.every(Boolean), 'Native listing location missing')
    const codes = locations.map(locationCountry)
    requireProof(new Set(codes).size === 1, 'Mixed native listing country scope')
    return { jobId: new URL(sourceUrl).pathname.split('/').at(-2), title, sourceUrl,
      location: locations.join('; '), locations, expectedLocationCount: locations.length + additional[0], countryCode: codes[0], country: codes[0] === 'IN' ? 'India' : regionNames.of(codes[0]) }
  })
  requireProof(jobs.length === end - start + 1 && new Set(jobs.map(j => j.jobId)).size === jobs.length, 'Native page count or unique IDs do not reconcile')
  const offsets = [...String(html).matchAll(/<a\b([^>]*)>/gi)].map(m => attr(m[1], 'href')).filter(href => /(?:[?&])startrow=/.test(href))
    .map(href => { const url = new URL(href, `${config.origin}/search`); requireProof(url.origin === config.origin && /^\/search\/?$/.test(url.pathname), 'Pagination leaves native search'); return url })
  const next = offsets.find(url => Number(url.searchParams.get('startrow')) === end)
  requireProof(end === total ? !offsets.some(url => Number(url.searchParams.get('startrow')) >= total) : Boolean(next), 'Native continuation missing or inconsistent')
  return { start, end, total, jobs, nextUrl: end === total ? null : next.href }
}

// Preserve nested spans inside source content instead of cutting off at the first child.
const spanContents = (html, predicate) => [...String(html).matchAll(/<span\b([^>]*)>/gi)].filter(m => predicate(m[1])).map(opening => {
  const start = opening.index + opening[0].length
  const tags = /<\/?span\b[^>]*>/gi
  tags.lastIndex = start
  let depth = 1
  for (let match; (match = tags.exec(html));) {
    depth += /^<\//.test(match[0]) ? -1 : 1
    if (depth === 0) return html.slice(start, match.index)
  }
  fail('Unclosed native span content')
})
const propertyHtml = (html, property) => spanContents(html, tag => attr(tag, 'itemprop') === property)[0]
  ?? (property === 'title' ? elements(html, 'h1', tag => attr(tag, 'itemprop') === property)[0] : null) ?? null
const meta = (html, property) => [...String(html).matchAll(/<meta\b([^>]*)>/gi)].filter(m => attr(m[1], 'itemprop') === property).map(m => attr(m[1], 'content'))
export const readRmkCompanyIdentities = html => meta(nativeDom(html), 'hiringOrganization').map(text)
const nativeDate = value => {
  if (!value) return null
  const date = new Date(value)
  requireProof(Number.isFinite(date.getTime()), 'Malformed native date')
  return date.toISOString()
}

export function parseRmkDetail(html, listing, config) {
  verifyTenant(html, config)
  html = nativeDom(html)
  requireProof(text(propertyHtml(html, 'title')) === listing.title, 'Native role title mismatch')
  const applications = [...String(html).matchAll(/<a\b([^>]*)>/gi)].map(m => attr(m[1], 'href')).filter(href => href.includes('/talentcommunity/apply/'))
    .map(href => nativeUrl(href, config, new RegExp(`^/talentcommunity/apply/${listing.jobId}/$`)))
  requireProof(applications.length > 0, 'Native apply identity unavailable')
  const nativeAddresses = spanContents(html, tag => classHas(tag, 'jobGeoLocation')).map(text)
  const locations = [...new Set(nativeAddresses)]
  requireProof(nativeAddresses.length && nativeAddresses.length === listing.expectedLocationCount && listing.locations.every(l => locations.includes(l)), 'Native detail and listing locations conflict')
  const codes = locations.map(locationCountry)
  requireProof(meta(html, 'addressCountry').every(value => codes.includes(locationCountry(value))), 'Native country conflict')
  const indiaLocations = locations.filter((_, index) => codes[index] === 'IN')
  const selectedLocations = indiaLocations.length ? indiaLocations : locations
  const jobDescription = propertyHtml(html, 'description') || null
  const job = { source: config.source, company: config.companyName, jobId: listing.jobId, requisitionId: listing.jobId,
    title: listing.title, location: selectedLocations.join('; '), nativeLocations: locations, country: indiaLocations.length ? 'India' : listing.country,
    city: selectedLocations[0].split(',')[0].trim(),
    sourceUrl: listing.sourceUrl, applyUrl: applications[0], link: applications[0], jobDescription,
    postingDate: nativeDate(meta(html, 'datePosted')[0]), closingDate: nativeDate(meta(html, 'validThrough')[0]),
    scrapedAt: new Date().toISOString() }
  if (job.closingDate && /(?:T|\s)\d{2}:\d{2}/.test(meta(html, 'validThrough')[0])
    && /(?:UTC|GMT|Z\s*$|[+-]\d{2}:?\d{2})/i.test(meta(html, 'validThrough')[0])) job.sourceClosingDateIsExact = true
  job.sourceDetailComplete = hasSourceDescription(job)
  if (!job.sourceDetailComplete) job.sourceDetailFailureKind = 'missing-content'
  return job
}

export function createSuccessFactorsRmkScraper(config) {
  return { async run({ fetchText, signal } = {}) {
    const activeSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(540000)]) : AbortSignal.timeout(540000)
    const get = async url => {
      activeSignal.throwIfAborted()
      if (fetchText) return fetchText(url, { signal: activeSignal })
      const response = await fetch(url, { signal: AbortSignal.any([activeSignal, AbortSignal.timeout(30000)]), headers: { 'user-agent': 'Mozilla/5.0', accept: 'text/html' } })
      requireProof(response.ok, `HTTP ${response.status} from native career site`)
      requireProof(new URL(response.url).origin === config.origin, 'Native request redirected outside employer site')
      return response.text()
    }
    const surface = config.searchUrl ? nativeUrl(config.searchUrl, config, /^\/search\/?$/) : `${config.origin}/search/`
    let url = surface, total = null, pagesFetched = 0
    const seen = new Set(), listed = []
    while (url) {
      requireProof(++pagesFetched <= 400, 'Pagination exceeded bounded native inventory limit')
      const page = parseRmkListing(await get(url), config)
      if (total === null) total = page.total
      requireProof(page.total === total && page.start === listed.length + 1, 'Native total or page range changed')
      for (const job of page.jobs) { requireProof(!seen.has(job.jobId), 'Duplicate native ID across pages'); seen.add(job.jobId); listed.push(job) }
      url = page.nextUrl
      if (url && new URL(surface).searchParams.has('locale')) {
        const nextUrl = new URL(url)
        const locale = new URL(surface).searchParams.get('locale')
        requireProof(!nextUrl.searchParams.has('locale') || nextUrl.searchParams.get('locale') === locale, 'Pagination locale changed')
        nextUrl.searchParams.set('locale', locale)
        url = nextUrl.href
      }
      if (url) {
        const initial = new URL(surface).searchParams
        const continuation = new URL(url).searchParams
        const allowed = new Map([...initial.entries(), ['q', initial.get('q') || ''],
          ['sortColumn', initial.get('sortColumn') || 'referencedate'], ['sortDirection', initial.get('sortDirection') || 'desc']])
        for (const key of new Set(continuation.keys())) {
          requireProof(continuation.getAll(key).length === 1, 'Duplicate pagination scope parameter')
          if (key !== 'startrow') requireProof(allowed.has(key) && continuation.get(key) === allowed.get(key), 'Pagination search scope changed')
        }
        for (const [key, value] of initial) if (key !== 'startrow') requireProof(continuation.get(key) === value, 'Pagination search scope dropped')
      }
    }
    requireProof(listed.length === total, 'Full native inventory did not reconcile')
    const selected = listed.filter(job => job.countryCode === 'IN' || job.expectedLocationCount > job.locations.length), mapped = new Array(selected.length)
    let next = 0, failure = null
    await Promise.all(Array.from({ length: Math.min(4, selected.length) }, async () => {
      while (!failure) {
        const index = next++
        if (index >= selected.length) return
        try { mapped[index] = parseRmkDetail(await get(selected[index].sourceUrl), selected[index], config) }
        catch (error) { failure ||= error }
      }
    }))
    if (failure) throw failure
    activeSignal.throwIfAborted()
    const jobs = mapped.filter(job => job.country === 'India')
    const sourceComplete = config.sourceScopeComplete !== false
    if (!sourceComplete || jobs.some(job => job.sourceDetailComplete === false)) for (const job of jobs) job.sourceListingComplete = false
    return attachInventoryEvidence(jobs, { status: sourceComplete ? 'complete-inventory' : 'coverage-gap', firstParty: true, listingComplete: sourceComplete,
      surface, pagesFetched, reportedTotal: total, indiaFacetCount: jobs.length,
      verifiedAt: new Date().toISOString(), reason: sourceComplete ? 'native-rmk-full-pagination-stable-total-unique-ids-detail-health-separate'
        : 'native-rmk-surface-pagination-complete-additional-employer-scope-unresolved' })
  } }
}
