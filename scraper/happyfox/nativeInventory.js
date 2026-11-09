import { createHash } from 'node:crypto'
import { readNativeDocument, decodeNativeEntities, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const HUB = 'https://www.happyfox.com/jobs/'
const NATIVE = 'https://hiring.happyfox.co'
const FILTER_SHA256 = '14d067dc19770327ded48fa4b2970b3deb5f39999c268b2eb62ac2c649512dd0'
const hash = text => createHash('sha256').update(text).digest('hex')
const clean = value => decodeNativeEntities(value).replace(/\s+/g, ' ').trim()
const folded = value => clean(value).replace(/[\u2010-\u2015]/g, '-').replace(/\s*-\s*/g, '-').toLowerCase()
const cls = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const descendants = (node, predicate) => !node || node.inert ? [] : [ ...(predicate(node) ? [node] : []),
  ...node.children.filter(child => typeof child !== 'string').flatMap(child => descendants(child, predicate)) ]
class HappyFoxIdentityError extends Error {
  constructor(message) { super('HappyFox native identity: ' + message); this.name = 'HappyFoxIdentityError' }
}
const valid = (condition, message) => { if (!condition) throw new HappyFoxIdentityError(message) }
const one = (nodes, name) => { valid(nodes.length === 1, 'expected one ' + name); return nodes[0] }
const urlAt = (value, base) => {
  let url
  try { url = new URL(value, base) } catch { throw new HappyFoxIdentityError('invalid public URL') }
  valid(url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.search, 'public URL identity conflicts')
  return url
}
const regionUrl = value => {
  const url = urlAt(value, HUB)
  valid(url.origin === 'https://www.happyfox.com' && /^\/jobs\/[a-z-]+\/$/.test(url.pathname) && !url.hash, 'regional country URL changed')
  return url.href
}
const roleUrl = value => {
  const url = urlAt(value, HUB)
  valid(url.origin === NATIVE && /^\/jobs\/[a-z0-9-]+\/$/.test(url.pathname)
    && ['', '#apply-section'].includes(url.hash), 'native role/application URL identity conflicts')
  url.hash = ''
  return url.href
}
const ATS = /(?:^|\.)(?:ashbyhq\.com|smartrecruiters\.com|lever\.co|greenhouse\.io|workable\.com|myworkdayjobs\.com|icims\.com|jobvite\.com|recruiterbox\.com|trakstar\.com|careers-page\.com|bamboohr\.com|freshteam\.com|zohorecruit\.com|teamtailor\.com|applytojob\.com|darwinbox\.(?:in|com))$/i
const additionalHiringScope = (html, base, reasons) => {
  const document = readNativeDocument(html)
  const frames = node => node.activeFrame ? [node] : node.inert ? []
    : node.children.filter(child => typeof child !== 'string').flatMap(frames)
  const parents = new Map()
  const index = node => { for (const child of node.children.filter(child => typeof child !== 'string')) { parents.set(child, node); index(child) } }
  document.nodes(n => n.tag === 'root').forEach(index)
  const configuredStoryVideo = frame => {
    const parent = parents.get(frame), figure = parent && parents.get(parent)
    return base === HUB && !Object.hasOwn(frame.attrs, 'src') && !Object.hasOwn(frame.attrs, 'srcdoc')
      && frame.attrs.title === 'The HappyFox company story' && Object.hasOwn(frame.attrs, 'data-video-embed')
      && frame.attrs['data-consent-video-src'] === 'https://www.youtube-nocookie.com/embed/Ap5oBUhI7QQ?rel=0'
      && parent && cls(parent, 'consent-video') && Object.hasOwn(parent.attrs, 'data-consent-video')
      && figure?.tag === 'figure' && cls(figure, 'hero-video') && figure.attrs['data-design-component'] === 'hero-video'
  }
  if (document.nodes(n => n.tag === 'root').flatMap(frames).some(frame => !configuredStoryVideo(frame))) reasons.add('additional-active-frame-hiring-scope')
  const nodes = document.nodes(n => n.tag === 'a' && n.attrs.href || n.tag === 'script' && n.attrs.src
    && /^(?:|module|(?:text|application)\/(?:javascript|ecmascript))$/i.test(n.attrs.type || ''))
  for (const node of nodes) {
    let url
    try { url = new URL(node.tag === 'a' ? node.attrs.href : node.attrs.src, base) } catch { reasons.add('additional-invalid-hiring-scope'); continue }
    const hiring = ATS.test(url.hostname) || /(?:^|\.)(?:jobs?|careers?|hiring|recruit(?:ment)?)\./i.test(url.hostname)
      || /\b(?:careers?|jobs?|openings?|open positions|join our team|opportunities)\b/i.test(document.text(node))
    if (!hiring) continue
    if (url.origin === 'https://www.happyfox.com' && /^\/jobs\/(?:[a-z-]+\/)?$/.test(url.pathname) && !url.search) continue
    if (url.origin === 'https://www.happyfox.com' && url.pathname === '/jobs' && !url.search) continue
    if (url.origin === NATIVE && /^\/jobs\/[a-z0-9-]+\/$/.test(url.pathname) && !url.search && ['', '#apply-section'].includes(url.hash)) continue
    // Signed static assets of the current first-party application form do not
    // provide another recruiting inventory. They are never fetched or executed.
    if (url.hostname === 'hf-hiring.s3.amazonaws.com' && /^\/static\//.test(url.pathname)) continue
    reasons.add('additional-public-hiring-scope')
  }
}
const verifyCorporatePage = (html, url, reasons) => {
  const document = readVisibleNativeDocument(html)
  valid(one(document.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical'), 'corporate canonical').attrs.href === url, 'corporate canonical URL changed')
  valid(one(document.nodes(n => n.tag === 'meta' && n.attrs.property === 'og:url'), 'corporate public URL').attrs.content === url, 'corporate public URL conflicts')
  const scripts = document.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json')
  const schemas = scripts.map(n => { try { return JSON.parse(n.raw) } catch { throw new HappyFoxIdentityError('corporate WebPage metadata invalid') } })
  const schema = one(schemas.filter(row => row?.['@type'] === 'WebPage'), 'corporate WebPage metadata')
  valid(schema.url === url && schema['@id'] === url + '#webpage' && schema.isPartOf?.['@id'] === 'https://www.happyfox.com/#website'
    && /HappyFox/.test(schema.name || ''), 'corporate employer/page identity conflicts')
  additionalHiringScope(html, url, reasons)
  return document
}
const parseHub = (html, reasons) => {
  const document = verifyCorporatePage(html, HUB, reasons)
  const main = one(document.nodes(n => n.tag === 'main'), 'corporate careers main')
  const links = descendants(main, n => n.tag === 'a' && /^Open positions in .+$/i.test(document.text(n)))
  const regions = new Map(), bindings = new Map()
  for (const anchor of links) {
    const label = document.text(anchor).replace(/^Open positions in\s+/i, ''), url = regionUrl(anchor.attrs.href)
    const country = /^India$/i.test(label) ? 'India' : /^(?:the )?(?:USA|United States)$/i.test(label) ? 'United States' : 'other:' + folded(label)
    if (!bindings.has(url)) bindings.set(url, new Set())
    bindings.get(url).add(country)
    if (country.startsWith('other:')) { reasons.add('additional-unresolved-country-entry-scope'); continue }
    valid(!regions.has(country) || regions.get(country) === url, 'ambiguous country entry')
    regions.set(country, url)
  }
  valid(regions.size === 2 && new Set(regions.values()).size === 2, 'India and USA country scope unavailable')
  return { entries: regions, bindings }
}
const parseRegionalPage = (html, url, country, reasons) => {
  const document = verifyCorporatePage(html, url, reasons), broad = readNativeDocument(html)
  const board = one(document.nodes(n => Object.hasOwn(n.attrs, 'data-job-board')), 'regional job board')
  const client = one(document.nodes(n => n.tag === 'script' && !n.attrs.src && n.raw?.includes('[data-job-board]')), 'local filtering client')
  valid(hash(client.raw) === FILTER_SHA256, 'local filtering client changed; complete pagination unverified')
  const count = document.text(one(descendants(board, n => Object.hasOwn(n.attrs, 'data-job-count')), 'regional role count')).match(/^(\d+) open positions?$/)
  valid(count && Number.isSafeInteger(Number(count[1])) && Number(count[1]) <= 500, 'regional inventory count unavailable')
  const nav = one(descendants(board, n => n.tag === 'nav' && n.attrs['aria-label'] === 'Job locations'), 'regional location navigation')
  const locations = descendants(nav, n => n.tag === 'a').map(n => ({ url: regionUrl(n.attrs.href), label: document.text(n) }))
  valid(locations.length > 0 && new Set(locations.map(row => row.url)).size === locations.length, 'regional city navigation ambiguous')
  const self = one(locations.filter(row => row.url === url), 'assigned regional location')
  const departments = descendants(board, n => n.tag === 'section' && Object.hasOwn(n.attrs, 'data-job-department'))
  const cards = descendants(board, n => n.tag === 'article' && Object.hasOwn(n.attrs, 'data-job-opening'))
  valid(cards.length === Number(count[1]) && broad.nodes(n => n.tag === 'article' && Object.hasOwn(n.attrs, 'data-job-opening')).length === cards.length,
    'regional inventory card count incomplete or hidden')
  const roles = []
  for (const section of departments) {
    const department = document.text(one(descendants(section, n => n.tag === 'h3'), 'department title'))
    valid(folded(department) === folded(section.attrs['data-job-department']), 'department identity conflicts')
    for (const card of descendants(section, n => n.tag === 'article' && Object.hasOwn(n.attrs, 'data-job-opening'))) {
      const title = document.text(one(descendants(card, n => n.tag === 'h4'), 'advertised role title'))
      const metadata = one(descendants(card, n => n.tag === 'p'), 'advertised role location and type')
      const fields = metadata.children.filter(child => typeof child === 'string').map(clean).filter(Boolean)
      valid(title && fields.length === 2 && fields.every(Boolean), 'advertised role metadata unavailable')
      const apply = one(descendants(card, n => n.tag === 'a' && cls(n, 'job-opening__apply')), 'advertised role application')
      valid(document.text(apply) === 'Apply now', 'advertised role application changed')
      const nativeUrl = roleUrl(apply.attrs.href)
      if (country === 'India') valid(folded(fields[0]) === folded(self.label), 'assigned India city conflicts with native card')
      roles.push({ url: nativeUrl, id: new URL(nativeUrl).pathname.split('/')[2], title, location: fields[0], employmentType: fields[1],
        department, country, regionUrl: url, regionLabel: self.label })
    }
  }
  valid(roles.length === cards.length, 'regional department inventory incomplete')
  return { roles, locations }
}
const roleContent = node => ({ ...node, children: node.children.filter(child => typeof child === 'string'
  || !(cls(child, 'job-actions') || child.tag === 'form' || child.tag === 'script' || child.tag === 'style'))
  .map(child => typeof child === 'string' ? child : roleContent(child)) })
const parseNativeDetail = (html, row, countryEntries, reasons) => {
  const document = readVisibleNativeDocument(html)
  additionalHiringScope(html, row.url, reasons)
  const title = clean(decodeNativeEntities(one(document.nodes(n => n.tag === 'title'), 'native document title').raw))
  valid(folded(title) === folded(row.title + ' - Careers at HappyFox'), 'native title/employer identity conflicts')
  valid(document.nodes(n => n.tag === 'a' && ['https://www.happyfox.com', 'https://www.happyfox.com/'].includes(n.attrs.href)).length >= 1,
    'native reciprocal employer website unavailable')
  valid(folded(document.text(one(document.nodes(n => n.tag === 'h1' && cls(n, 'job-title')), 'native role title'))) === folded(row.title), 'native role title identity conflicts')
  for (const canonical of document.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical')) valid(canonical.attrs.href === row.url, 'native canonical identity conflicts')
  for (const meta of document.nodes(n => n.tag === 'meta' && n.attrs.property === 'og:url')) valid(meta.attrs.content === row.url, 'native canonical public URL identity conflicts')
  valid(document.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json').length === 0, 'native structured identity contract changed')
  const meta = one(document.nodes(n => cls(n, 'job-meta')), 'native role metadata')
  const fields = descendants(meta, n => n.tag === 'span').map(n => document.text(n))
  valid(fields.length === 3 && folded(fields[0]) === folded(row.location) && folded(fields[1]) === folded(row.department), 'native city/department identity conflicts')
  const back = one(document.nodes(n => n.tag === 'a' && /^Back to .+ openings$/.test(document.text(n))), 'native reciprocal regional link')
  valid(row.country === 'India' ? back.attrs.href === row.regionUrl : [row.regionUrl, HUB].includes(back.attrs.href), 'native reciprocal city route identity conflicts')
  const application = one(document.nodes(n => n.attrs.id === 'apply-section'), 'role application section')
  const form = one(descendants(application, n => n.tag === 'form' && cls(n, 'application-form')), 'role application form')
  valid(form.attrs.method?.toLowerCase() === 'post' && form.attrs.enctype === 'multipart/form-data'
    && (!form.attrs.action || urlAt(form.attrs.action, row.url).href === row.url), 'native application role identity conflicts')
  const main = one(document.nodes(n => n.tag === 'main'), 'native role main')
  const explicitCountries = descendants(main, n => cls(n, 'meta-job-location-country') || n.attrs.itemprop === 'addressCountry')
    .map(n => clean(n.attrs.content || document.text(n)))
  valid(explicitCountries.every(country => (row.country === 'India' ? ['india', 'in', 'ind'] : ['united states', 'united states of america', 'us', 'usa']).includes(country.toLowerCase())),
    'explicit native country conflicts with assigned regional country')
  if (/\b(?:this (?:role|position) (?:is|has been) (?:closed|filled)|no longer accepting applications)\b/i.test(document.text(main))) {
    reasons.add('native-role-closed:' + row.id); return null
  }
  const blocks = document.nodes(n => cls(n, 'job-description'))
  const description = blocks.length === 1 ? extractActiveDescription(document.text(roleContent(blocks[0]))) : null
  if (!description) reasons.add('native-description-unavailable:' + row.id)
  const experience = description?.match(/\b(\d+\s*(?:-\s*\d+|\+)?)\s*(?:years?|yrs?)\b/i)?.[0] || null
  return { source: 'happyfox', company: 'HappyFox', nativeEmployerBrand: 'HappyFox', jobId: row.id, requisitionId: null,
    title: row.title, department: fields[1], country: row.country, city: row.country === 'India' ? fields[0] : null,
    location: row.country === 'India' ? fields[0] + ', India' : fields[0], sourceUrl: row.url, applyUrl: row.url + '#apply-section', link: row.url + '#apply-section',
    employmentType: /^full time$/i.test(row.employmentType) ? 'Full-time' : row.employmentType,
    experienceRequired: experience, publicExperienceChecked: Boolean(description && !experience),
    remoteStatus: /^(?:In Person|On-site)$/i.test(fields[2]) ? 'On-site' : /^Hybrid$/i.test(fields[2]) ? 'Hybrid' : /^Remote$/i.test(fields[2]) ? 'Remote' : null,
    sourceDescription: description, jobDescription: description, nativeDescriptionSHA256: description ? hash(description) : null,
    sourceDetailComplete: Boolean(description), sourceDetailFailureKind: description ? null : 'missing-content',
    postingDate: null, closingDate: null, sourcePublicationDateUnavailable: true,
    sourceNativeEmployerEvidence: { brand: 'HappyFox', nativeHost: NATIVE, reciprocalWebsite: 'https://www.happyfox.com/', legalEmployer: null },
    sourceNativeCountryEvidence: { countryEntryUrl: countryEntries.get(row.country), countryEntryLabel: row.country === 'India' ? 'Open positions in India' : 'Open positions in the USA',
      regionalPageUrl: row.regionUrl, regionalLocation: row.regionLabel, assignedListingLocation: row.location, nativeDetailLocation: fields[0], nativeRegionalBacklink: back.attrs.href,
      explicitNativeCountries: explicitCountries },
    sourcePublicationDateMeaning: 'No native job publication date is exposed; observation time is separate.',
    companyCareerPage: HUB, companyDomain: 'happyfox.com', atsPlatform: 'first-party-astro-careers' }
}
const defaultFetchPage = async (url, init) => {
  const response = await fetch(url, { ...init, redirect: 'error' })
  return { status: response.status, url: response.url, contentType: response.headers.get('content-type'), body: await response.text() }
}
const rowState = row => JSON.stringify([row?.url, row?.title, row?.location, row?.employmentType, row?.department, row?.country, row?.regionUrl])
export const createHappyFoxNativeInventory = (defaults = {}) => ({
  async run(options = {}) {
    const settings = { ...defaults, ...options }, signal = settings.signal, fetchPage = settings.fetchPage || defaultFetchPage
    const now = settings.now || (() => new Date().toISOString()), maxJobs = settings.maxJobs ?? 0, reasons = new Set()
    valid(Number.isSafeInteger(maxJobs) && maxJobs >= 0, 'invalid output cap')
    valid(!settings.fetchText || settings.fetchPage, 'current native response transport requires fetchPage')
    signal?.throwIfAborted()
    let requests = 0
    const regionalReferences = new Set(), postingReferences = new Set()
    const pageAt = async url => {
      signal?.throwIfAborted()
      const response = await fetchPage(url, { method: 'GET', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000),
        headers: { Accept: 'text/html' } })
      signal?.throwIfAborted(); requests++
      valid(response.url === url, 'native response redirected')
      if (response.status !== 200) throw Error('HappyFox public native HTTP ' + response.status)
      valid(typeof response.body === 'string' && Buffer.byteLength(response.body) <= 4 * 1024 * 1024 && /^text\/html\b/i.test(response.contentType || ''), 'native response format changed')
      const document = readNativeDocument(response.body)
      for (const anchor of document.nodes(n => n.tag === 'a' && n.attrs.href)) {
        let target
        try { target = new URL(anchor.attrs.href, url) } catch { continue }
        target.hash = ''
        if (target.search) continue
        if (target.origin === 'https://www.happyfox.com' && /^\/jobs\/[a-z-]+\/$/.test(target.pathname)) regionalReferences.add(target.href)
        if (target.origin === NATIVE && /^\/jobs\/[a-z0-9-]+\/$/.test(target.pathname)) postingReferences.add(target.href)
      }
      return response.body
    }
    const collect = async () => {
      const { entries, bindings } = parseHub(await pageAt(HUB), reasons)
      const queue = [...entries].map(([country, url]) => ({ country, url })), seen = new Map(), roles = new Map()
      while (queue.length) {
        const next = queue.shift()
        if (seen.has(next.url)) { valid(seen.get(next.url) === next.country, 'conflicting regional country scope'); continue }
        valid(seen.size < 20, 'regional inventory page budget exhausted')
        seen.set(next.url, next.country)
        const page = parseRegionalPage(await pageAt(next.url), next.url, next.country, reasons)
        for (const location of page.locations) {
          const assigned = [...entries].find(([, url]) => url === location.url)?.[0]
          valid(!assigned || assigned === next.country, 'conflicting country entry in regional navigation')
          queue.push({ country: next.country, url: location.url })
        }
        for (const row of page.roles) {
          valid(!roles.has(row.url), 'duplicate native posting identity')
          roles.set(row.url, row)
        }
      }
      const unsafeRegions = new Set()
      for (const [url, country] of seen) {
        const directConflict = bindings.has(url) && [...bindings.get(url)].some(assigned => assigned !== country)
        const rootConflict = [...(bindings.get(entries.get(country)) || [])].some(assigned => assigned !== country)
        if (directConflict || rootConflict) { unsafeRegions.add(url); reasons.add('conflicting-country-binding:' + url) }
      }
      return { entries, seen, roles, unsafeRegions }
    }
    const initial = await collect(), jobs = new Map()
    for (const row of initial.roles.values()) {
      const html = await pageAt(row.url)
      if (initial.unsafeRegions.has(row.regionUrl)) continue
      const job = parseNativeDetail(html, row, initial.entries, reasons)
      if (job?.country === 'India') jobs.set(row.url, job)
    }
    const closing = await collect()
    if ([...regionalReferences].some(url => !initial.seen.has(url) || !closing.seen.has(url))) reasons.add('unassigned-additional-regional-hiring-scope')
    if ([...postingReferences].some(url => !initial.roles.has(url) || !closing.roles.has(url))) reasons.add('unreconciled-additional-native-posting-scope')
    if (JSON.stringify([...initial.entries]) !== JSON.stringify([...closing.entries]) || JSON.stringify([...initial.seen]) !== JSON.stringify([...closing.seen])
      || initial.roles.size !== closing.roles.size || [...initial.roles].some(([url, row]) => rowState(row) !== rowState(closing.roles.get(url)))) reasons.add('closing-native-inventory-changed')
    const healthy = [...jobs].filter(([url, job]) => !closing.unsafeRegions.has(job.sourceNativeCountryEvidence.regionalPageUrl)
      && rowState(initial.roles.get(url)) === rowState(closing.roles.get(url))).map(([, job]) => job)
    const selected = maxJobs ? healthy.slice(0, maxJobs) : healthy
    if (selected.length !== healthy.length) reasons.add('source-job-limit')
    const complete = reasons.size === 0, verifiedAt = new Date(now()).toISOString()
    for (const job of selected) Object.assign(job, { scrapedAt: verifiedAt, sourceListingComplete: complete, sourceScopeComplete: complete, lifecycleCleanupAllowed: complete })
    return attachInventoryEvidence(selected, { status: complete ? initial.roles.size ? 'complete-inventory' : 'verified-empty' : 'discovery-only',
      firstParty: true, surface: HUB, listingComplete: complete, reportedTotal: complete ? initial.roles.size : null,
      indiaFacetCount: complete ? healthy.length : null, pagesFetched: requests, verifiedAt,
      reason: complete ? 'happyfox-current-country-bound-static-inventory-reconciled' : 'happyfox-native-incomplete:' + [...reasons].join(';') })
  },
})
