import { createHash } from 'node:crypto'
import { activeIframeSources, decodeNativeEntities, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument as readNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const OFFICIAL = 'https://www.haptik.ai/careers', BOARD = 'https://haptik.freshteam.com/jobs'
const ORIGIN = new URL(BOARD).origin
const clean = value => typeof value === 'string' ? decodeNativeEntities(value).replace(/\s+/g, ' ').trim() : ''
const hash = value => createHash('sha256').update(value).digest('hex')
const fail = message => { throw Error(`Haptik native inventory: ${message}`) }
const cls = (node, name) => (node.attrs.class || '').split(/\s+/).includes(name)
const descendants = (node, predicate) => !node || node.inert ? [] : [ ...(predicate(node) ? [node] : []),
  ...node.children.filter(child => typeof child !== 'string').flatMap(child => descendants(child, predicate)) ]
const tracking = name => /^utm_/.test(name) || ['__hstc', '__hssc', '__hsfp', 'hsCtaTracking'].includes(name)
const recruitingHost = /(?:^|\.)(?:freshteam\.com|workable\.com|greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|smartrecruiters\.com|icims\.com|zohorecruit\.(?:com|in)|darwinbox\.(?:com|in)|successfactors\.(?:com|eu)|taleo\.net|jobs2web\.com|teamtailor\.com|personio\.(?:com|de)|bamboohr\.com|applytojob\.com|breezy\.hr|recruitee\.com|jobvite\.com)$/i
const nativeUrl = (value, id) => {
  let url
  try { url = new URL(decodeNativeEntities(value), BOARD) } catch { fail('invalid native role URL') }
  const path = url.pathname.match(/^\/jobs\/([\w-]{6,40})\/[^/]+$/)
  if (url.origin !== ORIGIN || url.username || url.password || url.port || url.search || url.hash || !path
    || (id && path[1] !== id)) fail('foreign native role identity')
  return { url: url.href, id: path[1] }
}
const publicationDate = value => {
  if (typeof value !== 'string') fail('native publication date unavailable')
  const iso = value.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) UTC$/, '$1T$2Z')
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(iso)) fail('unsupported native publication date')
  const date = new Date(iso)
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 19) !== iso.slice(0, 19)) fail('impossible native publication date')
  return date.toISOString()
}
const countryCodes = new Map(), countryNames = new Intl.DisplayNames(['en'], { type: 'region' })
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = countryNames.of(code)
  if (name !== code && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code)) {
    const canonical = new Intl.Locale('und-' + code).region
    countryCodes.set(code.toLowerCase(), canonical); countryCodes.set(name.toLowerCase(), canonical)
  }
}
for (const [name, code] of Object.entries({ IND: 'IN', USA: 'US', 'United States of America': 'US', UK: 'GB' })) countryCodes.set(name.toLowerCase(), code)
const country = value => typeof value === 'string' ? countryCodes.get(clean(value).toLowerCase()) || null : null
const parseBoard = (html, reasons) => {
  const doc = readNativeDocument(html), roles = new Map()
  if (!doc.nodes(n => ['h1', 'h4', 'title'].includes(n.tag)).some(n => clean(n.tag === 'title' ? n.raw : doc.text(n)) === 'Haptik Careers')) fail('native board employer identity changed')
  const counts = doc.nodes(n => n.tag === 'meta' && (n.attrs.property === 'og:description' || n.attrs.name === 'twitter:description'))
    .map(n => clean(n.attrs.content).match(/^#(\d+) Jobs?\b/)?.[1]).filter(Boolean).map(Number)
  const total = counts.length && new Set(counts).size === 1 && Number.isSafeInteger(counts[0]) ? counts[0] : null
  for (const anchor of doc.nodes(n => n.tag === 'a' && n.attrs.href)) {
    const url = new URL(anchor.attrs.href, BOARD)
    if (url.origin !== ORIGIN || !/^\/jobs\/[^/]+\/[^/]+$/.test(url.pathname)) {
      if (url.origin !== ORIGIN && recruitingHost.test(url.hostname)) reasons.add('additional-native-recruiting-scope-unresolved')
      continue
    }
    const role = nativeUrl(url.href), titles = descendants(anchor, n => cls(n, 'job-title'))
    const locationNodes = descendants(anchor, n => cls(n, 'location-info'))
    if (titles.length !== 1 || locationNodes.length !== 1) fail('native card fields unavailable')
    const locationParts = locationNodes[0].children.filter(n => typeof n === 'string').map(clean).filter(Boolean)
    const item = { id: role.id, url: role.url, title: clean(doc.text(titles[0])), location: locationParts[0] || '', employmentType: locationParts.slice(1).join(' '), nativeLocation: clean(anchor.attrs['data-portal-location']) }
    if (roles.has(item.id) && JSON.stringify(roles.get(item.id)) !== JSON.stringify(item)) fail('ambiguous duplicate native card')
    roles.set(item.id, item)
  }
  if (activeIframeSources(html).some(value => {
    try { const url = new URL(value, BOARD); return url.origin !== ORIGIN && recruitingHost.test(url.hostname) } catch { return true }
  })) reasons.add('additional-native-recruiting-scope-unresolved')
  if (total == null || total !== roles.size) reasons.add('native-listing-count-not-reconciled')
  if (doc.nodes(n => n.tag === 'a' && (n.attrs.rel === 'next' || /^next\b/i.test(doc.text(n)))).length) reasons.add('native-pagination-not-reconciled')
  if (!roles.size && !(total === 0 && doc.nodes(n => n.tag === 'root').some(n => /no (?:current |open )?(?:jobs|openings|positions)/i.test(doc.text(n))))) reasons.add('native-empty-state-unproven')
  return { roles, total }
}
const state = snapshot => JSON.stringify([...snapshot.roles.values()].map(r => [r.id, r.title, r.location, r.employmentType, r.nativeLocation]).sort((a, b) => a[0].localeCompare(b[0])))
const defaultPage = async (url, { signal } = {}) => {
  const response = await fetch(url, { signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(25000)]),
    headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)' } })
  const html = await response.text()
  return { status: response.status, url: response.url, html, contentType: response.headers.get('content-type') }
}

export const createHaptikNativeInventory = (defaults = {}) => ({
  async run(options = {}) {
    const settings = { ...defaults, ...options }, controller = new AbortController()
    const signal = settings.signal ? AbortSignal.any([settings.signal, controller.signal]) : controller.signal
    const maxJobs = settings.maxJobs ?? 0, concurrency = settings.detailConcurrency ?? 2
    if (!Number.isSafeInteger(maxJobs) || maxJobs < 0 || !Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 4) fail('invalid run limits')
    const fetchPage = settings.fetchPage || defaultPage, now = settings.now || (() => new Date().toISOString()), reasons = new Set()
    let requests = 0
    const pageAt = async url => {
      signal.throwIfAborted(); const response = await fetchPage(url, { signal }); signal.throwIfAborted(); requests++
      if (response?.status !== 200 || response.url !== url || typeof response.html !== 'string' || !response.html.trim()
        || Buffer.byteLength(response.html) > 4000000 || (response.contentType != null && !/^text\/html(?:;|$)/i.test(response.contentType))) fail('native page status, URL, or HTML contract changed')
      return response.html
    }
    const officialHtml = await pageAt(OFFICIAL), official = readNativeDocument(officialHtml)
    let bound = false
    const links = [...official.nodes(n => n.tag === 'a' && n.attrs.href).map(n => ({ href: n.attrs.href, kind: 'anchor' })),
      ...activeIframeSources(officialHtml).map(href => ({ href, kind: 'iframe' })),
      ...official.nodes(n => n.tag === 'script' && n.attrs.src).map(n => ({ href: n.attrs.src, kind: 'script' }))]
    for (const anchor of links) {
      let url
      try { url = new URL(anchor.href, OFFICIAL) } catch { continue }
      if (anchor.kind !== 'script' && url.origin === ORIGIN && url.pathname === '/jobs' && !url.hash && !url.username && !url.password
        && [...url.searchParams.keys()].every(tracking)) { bound = true; continue }
      if (/^https?:$/.test(url.protocol) && (recruitingHost.test(url.hostname)
        || (/\b(?:careers|jobs|openings|apply|hiring)\b/i.test(url.pathname) && url.href !== OFFICIAL))) reasons.add('additional-employer-recruiting-scope-unresolved')
    }
    if (!bound) fail('current active first-party careers handoff unavailable')
    const initial = parseBoard(await pageAt(BOARD), reasons), jobs = new Map(), cards = [...initial.roles.values()]
    let next = 0
    const results = await Promise.allSettled(Array.from({ length: concurrency }, async () => {
      try {
        while (next < cards.length) {
          const row = cards[next++]
          let html
          try { html = await pageAt(row.url) } catch (error) { signal.throwIfAborted(); reasons.add(`native-detail-unavailable:${row.id}`); continue }
          const doc = readNativeDocument(html), models = doc.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json')
            .map(n => JSON.parse(n.raw)).filter(m => m['@type'] === 'JobPosting')
          if (models.length !== 1) { reasons.add(`native-role-unavailable:${row.id}`); continue }
          const model = models[0]
          nativeUrl(model.url, row.id)
          const headings = doc.nodes(n => n.tag === 'h1')
          if (model.hiringOrganization?.name !== 'Jio Haptik' || headings.length !== 1
            || clean(doc.text(headings[0])) !== row.title || clean(model.title) !== row.title) fail('native employer/title identity changed')
          const headers = doc.nodes(n => cls(n, 'job-details-header')), contents = doc.nodes(n => cls(n, 'job-details-content'))
          const form = doc.nodes(n => n.tag === 'form' && n.attrs.method?.toLowerCase() === 'post')
            .filter(n => new URL(n.attrs.action, row.url).href === `${ORIGIN}/jobs/${row.id}/applicants`)
          const links = doc.nodes(n => n.tag === 'a' && n.attrs.href === '#applicant-form' && /apply/i.test(doc.text(n)))
          if (headers.length !== 1 || contents.length !== 1 || form.length !== 1 || !links.length) { reasons.add(`native-application-or-content-unavailable:${row.id}`); continue }
          const descriptionNode = contents[0].children.find(n => typeof n !== 'string' && n.tag === 'div')
          const visible = descriptionNode && !descendants(descriptionNode, n => n.tag === 'form').length && extractActiveDescription(doc.text(descriptionNode))
          const structured = typeof model.description === 'string' && extractActiveDescription(decodeNativeEntities(model.description))
          if (!visible || !structured || visible.replace(/\s/g, '') !== structured.replace(/\s/g, '')) { reasons.add(`full-native-description-unavailable:${row.id}`); continue }
          const address = model.jobLocation?.address, code = country(address?.addressCountry)
          const locations = descendants(headers[0], n => cls(n, 'stick-hide-in-mobile') && cls(n, 'text-color'))
            .map(n => clean(n.children.filter(child => typeof child === 'string').join(' ')))
          const location = locations[0], parts = location?.split(',').map(clean), visibleCountry = country(parts?.at(-1))
          const listingCountry = country(row.nativeLocation.split(',').at(-1))
          if (!code || !location || location !== row.location || (visibleCountry && visibleCountry !== code)
            || (listingCountry && listingCountry !== code)) { reasons.add(`native-country-scope-unresolved:${row.id}`); continue }
          const remote = /^remote$/i.test(location)
          const addressParts = [address.addressRegion, address.addressLocality].map(clean).filter(Boolean)
          if (!remote && (!addressParts.length || !addressParts.every(value => parts.includes(value)))) { reasons.add(`native-location-scope-unresolved:${row.id}`); continue }
          if (code !== 'IN') continue
          const postingDate = publicationDate(model.datePosted)
          const city = remote ? null : parts[0], stateName = remote ? null : parts[1] || null
          jobs.set(row.id, { source: 'haptik', company: 'Haptik', nativeEmployerBrand: model.hiringOrganization.name,
            jobId: row.id, requisitionId: row.id, title: row.title,
            location: remote ? 'Remote, India' : [city, stateName, 'India'].filter(Boolean).join(', '), city, state: stateName, country: 'India',
            nativeJobLocation: model.jobLocation, sourceUrl: row.url, applyUrl: row.url + '#applicant-form', link: row.url + '#applicant-form',
            jobDescription: visible, sourceDescription: visible, nativeDescriptionSHA256: hash(model.description),
            postingDate, nativePublicationDate: model.datePosted, closingDate: null,
            department: descendants(headers[0], n => n.tag === 'a' && cls(n, 'link-back')).map(n => doc.text(n))[0] || null,
            employmentType: model.employmentType === 'FULL_TIME' ? 'Full-time' : model.employmentType === 'CONTRACTOR' ? 'Contract' : clean(model.employmentType) || null,
            experienceRequired: visible.match(/\b\d+\s*[-–]\s*\d+\s*(?:years?|yrs?)\b/i)?.[0] || null,
            requiredSkills: [], minimumQualification: null, preferredQualification: null,
            remoteStatus: /\bhybrid\b/i.test(row.title) ? 'Hybrid' : remote ? 'Remote' : 'On-site',
            sourceDetailComplete: true, companyCareerPage: OFFICIAL, companyDomain: 'haptik.ai', atsPlatform: 'freshteam', scrapedAt: new Date(now()).toISOString() })
        }
      } catch (error) { controller.abort(error); throw error }
    }))
    const failure = results.find(r => r.status === 'rejected'); if (failure) throw failure.reason
    const closing = parseBoard(await pageAt(BOARD), reasons)
    if (closing.total !== initial.total || state(closing) !== state(initial)) reasons.add('closing-native-inventory-not-reconciled')
    const healthy = cards.filter(row => jobs.has(row.id) && JSON.stringify(closing.roles.get(row.id)) === JSON.stringify(row)).map(row => jobs.get(row.id))
    const selected = maxJobs ? healthy.slice(0, maxJobs) : healthy
    if (selected.length !== healthy.length) reasons.add('source-job-limit')
    const complete = reasons.size === 0
    if (!complete) selected.forEach(job => Object.assign(job, { sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false }))
    return attachInventoryEvidence(selected, { status: complete ? closing.total === 0 ? 'verified-empty' : 'complete-inventory' : 'discovery-only',
      surface: BOARD, firstParty: true, listingComplete: complete, reportedTotal: closing.total, indiaFacetCount: complete ? healthy.length : null,
      pagesFetched: requests, verifiedAt: new Date(now()).toISOString(), reason: complete ? 'current-employer-native-count-full-details-and-closing-inventory-reconciled'
        : `haptik-native-incomplete:${[...reasons].join(';')}` })
  },
})
