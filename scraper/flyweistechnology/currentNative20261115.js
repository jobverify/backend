import { createHash } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { readNativeDocument, decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { parseEightfoldJson } from '../../scraper-support/utils/recruitmentEightfoldData.js'

const SOURCE = 'flyweistechnology', COMPANY = 'Flyweis Technology'
const OFFICIAL = 'https://www.flyweis.technology/', ORIGIN = 'https://flyweis.technology', BOARD = ORIGIN + '/careers'
const STYLES = {
  '/_next/static/css/8ac2af147fdd4582.css': '4910d9fcd19489bab5a8f33ce21b61dec8576fc322c61d20f5db4c375c01030c',
  '/_next/static/css/f19dbbf993f3b973.css': '728cc0b90a816cae17b95f62b714d614bcf52262f039769d31bd7993e575a0c3',
  '/_next/static/css/3ad56064251c9581.css': 'a10da25a72f0559457d817f97847fc27656e842a86fd4247c2ac2ea7d6debec3',
  '/_next/static/css/c37ef131e7ddc94a.css': 'db762ed4e21b623e2b3d7544d8f517c03ada2234d125d8e4a60968383615ce09',
  '/_next/static/css/d5216807d843bf9d.css': 'aee4440b8342fb8ed61da1d3e56e669a9cdee16f3082fad83578402e2c773548',
  '/_next/static/css/46804a84a3f95bbc.css': '957a14b9ce7b84e6a2200c593696be00e5edbd40fc5c08b54e6a730da90e740e',
  '/_next/static/css/b83a55a9d343c40f.css': '9c589253dc94a2b3d918e13f2866b99332e588189db0affa732006fb36743742',
}
// Finite base CSS releases alter TechWall CTA spacing and the enquiry modal.
// Keep full-byte hashes and paired ordered declarations, applying every rule
// to the visible reader; never normalize or strip CSS at run time.
const STYLE_PROFILES = [
  ['/_next/static/css/8ac2af147fdd4582.css','/_next/static/css/f19dbbf993f3b973.css','/_next/static/css/3ad56064251c9581.css'],
  ['/_next/static/css/c37ef131e7ddc94a.css','/_next/static/css/f19dbbf993f3b973.css','/_next/static/css/3ad56064251c9581.css'],
  ['/_next/static/css/d5216807d843bf9d.css','/_next/static/css/f19dbbf993f3b973.css','/_next/static/css/3ad56064251c9581.css'],
  // This release separates the complete company/role rules from the home CSS.
  { home: ['/_next/static/css/46804a84a3f95bbc.css','/_next/static/css/f19dbbf993f3b973.css'], careers: ['/_next/static/css/46804a84a3f95bbc.css','/_next/static/css/f19dbbf993f3b973.css','/_next/static/css/b83a55a9d343c40f.css'] },
]
const sha = value => createHash('sha256').update(value).digest('hex')
const text = value => typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : ''
const need = (ok, message) => { if (!ok) throw Object.assign(Error('Flyweis current native: ' + message), { softFailure: true, abortRetries: true, failureKind: 'surface_drift_or_fail_closed' }) }
const one = (values, label) => { need(values.length === 1, 'expected one ' + label); return values[0] }
const unique = values => [...new Set(values)]
const within = (node, predicate) => node.inert ? [] : [ ...(predicate(node) ? [node] : []), ...node.children.filter(child => typeof child !== 'string').flatMap(child => within(child, predicate)) ]
const hasClass = (node, prefix) => (node.attrs.class || '').split(/\s+/).some(value => value.startsWith(prefix))
const canonical = (document, expected) => need(one(document.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical'), 'own canonical').attrs.href === expected, 'own canonical identity changed')
const snapshot = rows => JSON.stringify([...rows].sort((a, b) => a.url.localeCompare(b.url)))
const schemaContexts = (value, depth = 0) => {
  need(depth <= 12, 'native schema context nesting bound')
  if (Array.isArray(value)) { need(value.length <= 100, 'native schema context array bound'); value.forEach(item => schemaContexts(item, depth + 1)); return }
  if (!value || typeof value !== 'object') return
  if (Object.hasOwn(value, '@context')) need(typeof value['@context'] === 'string' && /^https?:\/\/schema\.org\/?$/.test(value['@context']), 'native schema context override')
  need(Object.keys(value).length <= 100, 'native schema context object bound')
  for (const [key, child] of Object.entries(value)) if (key !== '@context') schemaContexts(child, depth + 1)
}
const dispose = operation => { try { void Promise.resolve(operation()).catch(() => {}) } catch {} }
const wait = (operation, signal, disposeLate) => new Promise((resolve, reject) => {
  let done = false
  const abort = () => { if (!done) { done = true; signal.removeEventListener('abort', abort); reject(signal.reason) } }
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) { abort(); return }
  Promise.resolve().then(() => { signal.throwIfAborted(); return operation() }).then(value => {
    if (signal.aborted || done) { abort(); if (disposeLate) dispose(() => disposeLate(value)); return }
    done = true; signal.removeEventListener('abort', abort); resolve(value)
  }, error => { if (!done) { done = true; signal.removeEventListener('abort', abort); reject(error) } })
})

function corporate(page, visible) {
  need(visible.nodes(n => n.tag === 'title').length === 1, 'corporate page title missing')
  const title = visible.nodes(n => n.tag === 'title')[0]
  need(decodeNativeEntities(title.raw || '') === 'Flyweis Technology | Enterprise AI, ERP, Cloud & Security Partner', 'corporate publisher identity changed')
  const links = visible.nodes(n => n.tag === 'a' && /Careers/.test(visible.text(n)))
    .map(n => new URL(n.attrs.href, page.url).href)
  return one(unique(links.filter(url => url === 'https://www.flyweis.technology/careers')), 'visible corporate careers handoff')
}

function listing(page, visible) {
  canonical(visible, BOARD)
  need(decodeNativeEntities(one(visible.nodes(n => n.tag === 'title'), 'careers title').raw) === 'Careers at Flyweis Technology | Open Roles', 'careers publisher identity changed')
  const cards = visible.nodes(n => n.tag === 'li' && hasClass(n, 'company_jobCard__')), ids = new Set(), rows = []
  need(cards.length > 0 && cards.length <= 20, 'coverage-gap: no bounded visible current native vacancies')
  for (const card of cards) {
    const title = visible.text(one(within(card, n => n.tag === 'h3'), 'listing title'))
    const links = within(card, n => n.tag === 'a' && n.attrs.href)
    const detail = one(links.filter(n => /^\/careers\/[a-z0-9-]+$/.test(n.attrs.href) && visible.text(n) === 'View details'), 'own detail handoff')
    const url = new URL(detail.attrs.href, BOARD).href, apply = url + '/apply'
    need(!ids.has(url), 'duplicate listing native identity'); ids.add(url)
    need(links.some(n => new URL(n.attrs.href, BOARD).href === apply && visible.text(n) === 'Apply now'), 'listing application identity changed')
    const labels = within(card, n => n.tag === 'p').map(n => visible.text(n))
    const location = one(labels.filter(value => value.startsWith('Location: ')), 'native listing location').slice(10)
    const experience = one(labels.filter(value => value.startsWith('Experience: ')), 'native listing experience').slice(12)
    need(title && location && experience, 'incomplete native listing')
    rows.push({ title, url, apply, location, experience, originalVisibleListing: visible.text(card) })
  }
  return rows
}

function role(page, visible, row, now) {
  canonical(visible, row.url)
  const schemaNodes = visible.nodes(n => n.tag === 'script' && !Object.hasOwn(n.attrs, 'src')
    && (n.attrs.type || '').split(';', 1)[0].trim().toLowerCase() === 'application/ld+json')
  let posting
  try { posting = parseEightfoldJson(one(schemaNodes, 'own JobPosting').raw) } catch { need(false, 'own JobPosting is unreadable') }
  schemaContexts(posting)
  need(Object.keys(posting || {}).every(key => ['@context', '@type', 'title', 'description', 'employmentType', 'hiringOrganization', 'jobLocation', 'datePosted', 'validThrough'].includes(key)), 'additional native criteria require review')
  need(posting?.['@context'] === 'https://schema.org' && posting['@type'] === 'JobPosting'
    && posting.title === row.title && posting.hiringOrganization?.['@type'] === 'Organization'
    && posting.hiringOrganization.name === COMPANY && posting.hiringOrganization.sameAs === ORIGIN, 'own native title/employer identity changed')
  const address = posting.jobLocation?.address
  need(posting.jobLocation?.['@type'] === 'Place' && address?.['@type'] === 'PostalAddress'
    && address.addressCountry === 'IN' && address.addressLocality === 'Noida' && address.addressRegion === 'UP', 'native own work-country/worksite unqualified')
  need(posting.employmentType === 'FULL_TIME', 'native employment type changed')
  const posted = typeof posting.datePosted === 'string' ? Date.parse(posting.datePosted + 'T00:00:00Z') : NaN
  need(typeof posting.datePosted === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(posting.datePosted) && Number.isFinite(posted)
    && new Date(posted).toISOString().slice(0, 10) === posting.datePosted
    && posting.datePosted <= now.slice(0, 10), 'native publication date unavailable or future')
  need(posting.validThrough == null || Number.isFinite(Date.parse(posting.validThrough)) && Date.parse(posting.validThrough) > Date.parse(now), 'native vacancy expired')
  const article = one(visible.nodes(n => n.tag === 'article' && hasClass(n, 'company_jobDetail__')), 'visible full native role')
  const headings = within(article, n => /^h[1-3]$/.test(n.tag)).map(n => visible.text(n))
  need(headings[0] === row.title && ['About the role', 'Key responsibilities', 'Required skills', 'Qualifications', 'Still have questions?']
    .every(label => headings.includes(label)), 'native full role sections missing')
  const criteria = new Map(); let section = null
  for (const child of article.children.filter(node => typeof node !== 'string')) {
    if (child.tag === 'h2') {
      const label = visible.text(child)
      section = ['About the role', 'Key responsibilities', 'Required skills', 'Qualifications'].includes(label) ? label : null
      if (section) { need(!criteria.has(section), 'duplicate native criteria section'); criteria.set(section, []) }
    } else if (section) criteria.get(section).push(child)
  }
  for (const label of ['Key responsibilities', 'Required skills', 'Qualifications']) {
    const items = (criteria.get(label) || []).flatMap(node => within(node, child => child.tag === 'li'))
    need(items.length > 0 && items.every(item => visible.text(item).length >= 2), 'native criteria section empty: ' + label)
  }
  const paragraph = one(within(article, n => n.tag === 'p' && visible.text(n) === text(posting.description)), 'schema/native authored introduction')
  need(paragraph && typeof posting.description === 'string' && posting.description.length >= 100, 'native authored introduction unavailable')
  const facts = one(within(article, n => n.tag === 'ul' && hasClass(n, 'company_jobFacts__')), 'native role facts')
  need(visible.text(facts).includes(row.location) && visible.text(facts).includes(row.experience), 'native listing/own placement or experience changed')
  const applications = within(article, n => n.tag === 'a' && visible.text(n) === 'Apply now')
  need(applications.length === 2 && applications.every(n => new URL(n.attrs.href, page.url).href === row.apply), 'native visible application changed')
  const raw = readNativeDocument(page.html), originalArticle = one(raw.nodes(n => n.tag === 'article' && hasClass(n, 'company_jobDetail__')), 'original full native role')
  const description = visible.text(article)
  need(description.length >= 600 && raw.text(originalArticle) === description, 'native authored criteria hidden or incomplete')
  const all = node => [node, ...node.children.filter(child => typeof child !== 'string').flatMap(all)]
  need(all(originalArticle).every(n => !n.inert && !Object.hasOwn(n, 'raw')
    && ['article', 'h1', 'h2', 'h3', 'p', 'ul', 'ol', 'li', 'div', 'span', 'strong', 'b', 'em', 'i', 'br', 'a'].includes(n.tag)), 'unreviewed native authored criteria elements')
  // Current lifecycle notices can be siblings of the authored article. Keep
  // their proof in the stylesheet-qualified own role main, including at close.
  const owner = one(visible.nodes(n => n.tag === 'main'), 'visible own role main')
  need(within(owner, n => n === article).length === 1, 'native role article outside current own main')
  const currentRole = visible.text(owner)
  need(!/\b(?:this|the)\s+(?:job|position|role|vacancy|opportunity|requisition)\s+(?:(?:has|have)\s+been\s+|(?:is|was)\s+)(?:(?:currently|now|temporarily)\s+)?(?:filled|closed|expired|cancelled|canceled|unavailable|(?:not|no\s+longer)\s+(?:available|open|accepting\s+applications))\b/i.test(currentRole)
    && !/\b(?:applications?\s+(?:for\s+(?:this|the)\s+(?:job|position|role|vacancy)\s+)?(?:are|is|have\s+been|has\s+been)\s+(?:closed|no\s+longer\s+(?:accepted|being\s+accepted))|no\s+longer\s+accepting\s+applications)\b/i.test(currentRole), 'native vacancy closed')
  return { url: row.url, posting, description, nativeArticle: originalArticle, location: row.location, experience: row.experience }
}

export const createCurrentFlyweisScraper = () => ({ async run(options = {}) {
  const now = typeof options.now === 'function' ? options.now() : options.now || new Date().toISOString()
  need(typeof now === 'string' && Number.isFinite(Date.parse(now)), 'invalid capture time')
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(90000)])
  signal.throwIfAborted()
  need(!options.fetchText, 'legacy text-only transport cannot verify current public careers surface')
  const allowed = new Set([OFFICIAL]), receipts = [], styleCache = new Map(), prior = new Map()
  let requests = 0, aggregate = 0, styleProfile = null
  const read = async (url, kind = 'html') => {
    signal.throwIfAborted(); need(allowed.has(url) && ++requests <= 48, 'public read outside current native declaration/budget')
    if (!options.fetchImpl) {
      const pause = 1000 - (Date.now() - (prior.get(new URL(url).origin) || 0))
      if (pause > 0) await delay(pause, undefined, { signal })
    }
    prior.set(new URL(url).origin, Date.now())
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(20000)])
    const response = await wait(() => (options.fetchImpl || globalThis.fetch)(url, { method: 'GET', redirect: 'manual', credentials: 'omit', signal: deadline,
      headers: { Accept: kind === 'css' ? 'text/css' : 'text/html,application/xhtml+xml' } }), deadline, late => late.body?.cancel())
    const chunks = []; let bytes = 0, reader
    try {
      need(response.status === 200 && response.url === url && response.redirected !== true, 'public HTTP status/final URL changed: ' + response.status)
      const mime = (response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase()
      need(kind === 'css' ? mime === 'text/css' : ['text/html', 'application/xhtml+xml'].includes(mime), 'native response type changed')
      reader = response.body?.getReader(); need(reader, 'native response body unavailable')
      for (;;) {
        const part = await wait(() => reader.read(), deadline); deadline.throwIfAborted()
        if (part.done) break
        bytes += part.value.byteLength; aggregate += part.value.byteLength
        need(bytes <= 4e6 && aggregate <= 24e6, 'public response byte budget reached'); chunks.push(Buffer.from(part.value))
      }
    } finally { if (reader) { dispose(() => reader.cancel()); dispose(() => reader.releaseLock()) } else dispose(() => response.body?.cancel()) }
    const html = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
    const page = { url, status: response.status, html, bodySHA256: sha(html) }; receipts.push(page); return page
  }
  const page = async (url, closing = false) => {
    const result = await read(url), raw = readNativeDocument(result.html)
    need(!raw.nodes(n => n.tag === 'base').length, 'unreviewed native base')
    const styleNodes = raw.nodes(n => n.tag === 'link' && n.attrs.rel === 'stylesheet')
    const styles = styleNodes.map(n => new URL(n.attrs.href, url)), home = new URL(url).pathname === '/'
    const matched = STYLE_PROFILES.find(profile => {
      const legacy = Array.isArray(profile), expected = legacy ? profile.slice(0, home ? 3 : 2) : profile[home ? 'home' : 'careers']
      return styles.length === expected.length && styles.every((value, i) =>
        value.origin === new URL(url).origin && !value.search && !value.hash && value.pathname === expected[i] &&
        (legacy || (Object.keys(styleNodes[i].attrs).sort().join(',') === 'data-precedence,href,rel' &&
          styleNodes[i].attrs.href === expected[i] && styleNodes[i].attrs['data-precedence'] === 'next')))
    })
    need(matched, 'native stylesheet declarations changed')
    need(!styleProfile || styleProfile === matched, 'native stylesheet release changed during acquisition')
    styleProfile = matched
    const css = []
    for (const style of styles) {
      allowed.add(style.href)
      if (!styleCache.has(style.href) || closing) {
        const current = await read(style.href, 'css'); need(current.bodySHA256 === STYLES[style.pathname], 'unreviewed native stylesheet bytes')
        styleCache.set(style.href, current.html)
      }
      css.push(styleCache.get(style.href))
    }
    const visible = readVisibleNativeDocument(result.html.replace('</head>', '<style>' + css.join('\n') + '</style></head>'), { strict: true })
    return { page: result, visible }
  }
  const publisher = await page(OFFICIAL), handoff = corporate(publisher.page, publisher.visible)
  allowed.add(handoff); const delegated = await page(handoff)
  canonical(delegated.visible, BOARD); allowed.add(BOARD)
  const board = await page(BOARD), rows = listing(board.page, board.visible), staged = []
  for (const row of rows) { allowed.add(row.url); const own = await page(row.url); staged.push({ row, detail: role(own.page, own.visible, row, now) }) }
  for (const item of staged) {
    const own = await page(item.row.url), closing = role(own.page, own.visible, item.row, now)
    need(JSON.stringify(closing) === JSON.stringify(item.detail), 'closing native full criteria changed')
  }
  const closingBoard = await page(BOARD, true)
  need(snapshot(listing(closingBoard.page, closingBoard.visible)) === snapshot(rows), 'closing native listing membership changed')
  const closingDelegated = await page(handoff, true); canonical(closingDelegated.visible, BOARD)
  const closingPublisher = await page(OFFICIAL, true)
  need(corporate(closingPublisher.page, closingPublisher.visible) === handoff, 'closing corporate handoff changed')
  signal.throwIfAborted()
  const jobs = staged.map(({ row, detail }) => ({ source: SOURCE, company: COMPANY, title: row.title,
    jobId: new URL(row.url).pathname.split('/').at(-1), requisitionId: null, sourceUrl: row.url, link: row.url, applyUrl: row.apply,
    country: 'India', city: detail.posting.jobLocation.address.addressLocality, location: row.location,
    jobDescription: detail.description, sourceDescription: detail.description, sourceNativeJobPosting: detail.posting,
    sourceNativeFullArticle: detail.nativeArticle, sourceNativeListingRecord: row, sourceNativeEmployerHandoff: { officialURL: OFFICIAL, handoff, canonicalCareers: BOARD },
    postingDate: detail.posting.datePosted, sourcePostedDateRaw: detail.posting.datePosted, sourceDatePrecision: 'calendar-date', firstEverPostedAt: null,
    closingDate: null, sourceSchemaExpiryRaw: detail.posting.validThrough || null,
    nativeDateSemantics: 'native publication calendar assertion; first publication and real application deadline unqualified',
    employmentType: detail.posting.employmentType, remoteStatus: null,
    sourceNativeExperience: row.experience, sourceCanonicalUrlUsedAsPostingIdentity: true,
    sourceDetailComplete: true, sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false, scrapedAt: now,
    companyCareerPage: BOARD, companyDomain: 'flyweis.technology', atsPlatform: 'first-party-server-rendered-careers' }))
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: { source: SOURCE, originalResponses: receipts,
    observedRecords: rows, ownFullCriteriaClosingReconciled: true, corporateHandoffClosingReconciled: true, sourceScopeComplete: false, lifecycleCleanupAllowed: false } })
  attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: rows.length,
    observedVacancyCount: rows.length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
  return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: BOARD, firstParty: true, listingComplete: false,
    lifecycleCleanupAllowed: false, reportedTotal: null, indiaFacetCount: null, pagesFetched: requests, verifiedAt: now,
    reason: 'current own visible vacancies; schema native country/employer; full authored criteria and current corporate handoff closing reconciled; whole-company scope unqualified' })
} })
