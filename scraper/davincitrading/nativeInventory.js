import { createHash } from 'node:crypto'
import { readNativeDocument, decodeNativeEntities, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const H = 'https://davincitrading.com/', C = H + 'careers/'
const B = 'https://job-boards.eu.greenhouse.io/davinciderivatives', TOKEN = 'davinciderivatives'
const LOADER_SHA256 = 'cb79b752a0f3431a00783c7570b6e23106601baad76e7310d75c92e47b09d05b'
const clean = value => decodeNativeEntities(value).replace(/\s+/g, ' ').trim()
const folded = value => clean(value).toLowerCase(), compact = value => clean(value).replace(/\s/g, '')
const cls = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const children = node => node.children.filter(child => typeof child !== 'string')
const descendants = (node, predicate) => !node || node.inert ? [] : [...(predicate(node) ? [node] : []), ...children(node).flatMap(child => descendants(child, predicate))]
const hash = value => createHash('sha256').update(value).digest('hex')
class DaVinciIdentityError extends Error {
  constructor(message) { super('Da Vinci native identity: ' + message); this.name = 'DaVinciIdentityError'; this.abortRetries = true }
}
const valid = (condition, message) => { if (!condition) throw new DaVinciIdentityError(message) }
const one = (nodes, label) => { valid(nodes.length === 1, 'expected one ' + label); return nodes[0] }
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const id = value => Number.isSafeInteger(value) && value > 0
const parse = value => { try { return JSON.parse(value) } catch { throw new DaVinciIdentityError('invalid native JSON') } }
const nativeUrl = postingId => B + '/jobs/' + postingId
const countries = new Map(), regionNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = regionNames.of(code)
  if (name && !['ZZ', 'XA', 'XB', 'UN', 'EU', 'EZ', 'QO'].includes(code)) { countries.set(folded(name), code); countries.set(folded(code), code) }
}
for (const [name, code] of [['Hong Kong', 'HK'], ['United States of America', 'US'], ['USA', 'US'], ['UK', 'GB']]) countries.set(folded(name), code)
const country = value => typeof value === 'string' ? countries.get(folded(value)) || null : null
const locationScopes = value => clean(value).split(/\s*(?:\/|;|\|)\s*/).map(label => ({ label, country: country(label.split(',').at(-1)) }))
const countryFields = value => Object.entries(value).filter(([key]) => /^(?:country|countrycode|isocountrycode|addresscountry)$/.test(key.toLowerCase().replaceAll('_', '')))
const nativeGeography = (row, job, reasons) => {
  const scopes = locationScopes(row.location), codes = scopes.map(scope => scope.country).filter(Boolean)
  let unresolved = scopes.some(scope => !scope.country)
  for (const value of [row, job]) for (const [, field] of countryFields(value)) {
    const code = country(field)
    if (!code) unresolved = true
    else valid(codes.includes(code), 'explicit native country contradicts posting geography')
  }
  if (unresolved) reasons.add('native-country-unresolved:' + row.id)
  return { scopes, india: scopes.filter(scope => scope.country === 'IN'), unresolved }
}
const nativeDate = (value, now) => {
  if (value == null || value === '') return null
  valid(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.parse(now), 'invalid or future native publication timestamp')
  return new Date(value).toISOString()
}
const structured = doc => doc.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json').flatMap(node => {
  const value = parse(node.raw)
  return Array.isArray(value['@graph']) ? value['@graph'] : [value]
})
const corporatePage = (html, url) => {
  const doc = readVisibleNativeDocument(html), native = readNativeDocument(html)
  valid(one(native.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical'), 'first-party canonical').attrs.href === url, 'first-party canonical changed')
  const organizations = structured(native).filter(value => value['@type'] === 'Organization')
  valid(organizations.length && organizations.every(value => value.name === 'Da Vinci Trading'
    && (!value['@id'] || value['@id'] === H + '#organization')), 'first-party employer identity conflicts')
  valid(one(doc.nodes(n => n.tag === 'main'), 'first-party main'), 'first-party content unavailable')
  return doc
}
const corporateRole = value => {
  let url
  try { url = new URL(value, H) } catch { throw new DaVinciIdentityError('invalid first-party posting URL') }
  valid(url.origin === new URL(H).origin && /^\/job\/[a-z0-9-]+\/$/.test(url.pathname) && !url.search && !url.hash && !url.username && !url.password, 'first-party posting URL identity conflicts')
  return url.href
}
const corporateCards = doc => {
  const roles = new Map()
  for (const card of doc.nodes(n => n.tag === 'a' && cls(n, 'job-card'))) {
    const url = corporateRole(card.attrs.href), title = doc.text(one(descendants(card, n => cls(n, 'job-card__title')), 'first-party card title'))
    const location = doc.text(one(descendants(card, n => cls(n, 'job-card__location')), 'first-party card location'))
    valid(title && location && !roles.has(url), 'first-party card identity duplicate or missing')
    roles.set(url, { url, title, location })
  }
  return roles
}
const readCorporateDetail = (html, row) => {
  const doc = corporatePage(html, row.url), title = doc.text(one(doc.nodes(n => n.tag === 'h1'), 'first-party posting heading'))
  valid(folded(title) === folded(row.title), 'first-party posting title conflicts')
  const raw = one(readNativeDocument(html).nodes(n => n.tag === 'script' && !n.attrs.src && !Object.hasOwn(n.attrs, 'nomodule')
    && /^(?:|text\/javascript|application\/javascript)$/i.test(n.attrs.type || '')
    && /\bGrnhse\.Iframe|\b(?:var|let|const)\s+jobId\b/.test(n.raw || '')), 'active native application loader').raw
  const postingId = raw.match(/\bvar\s+jobId\s*=\s*'([1-9]\d*)';/)?.[1]
  valid(postingId && hash(raw.replaceAll(postingId, '__POSTING_ID__').replaceAll('Apply for ' + title, '__APPLY_TITLE__')) === LOADER_SHA256,
    'current active application loader/handoff identity changed')
  one(doc.nodes(n => n.attrs.id === 'grnhse_app'), 'native application loader target')
  const embeds = readNativeDocument(html).nodes(n => n.tag === 'script' && (n.attrs.src || '').includes('/embed/job_board/js'))
  valid(embeds.length === 1 && embeds[0].attrs.src === 'https://boards.eu.greenhouse.io/embed/job_board/js?for=' + TOKEN, 'native application embed employer/account identity conflicts')
  const schemas = structured(readNativeDocument(html)).filter(value => value['@type'] === 'JobPosting')
  valid(schemas.length <= 1, 'ambiguous first-party structured posting')
  const schema = schemas[0], organization = schema?.hiringOrganization
  if (schema?.identifier != null) valid(schema.identifier.name === 'Greenhouse' && String(schema.identifier.value) === postingId, 'structured posting/application handoff identity conflicts')
  if (organization) valid(organization['@id'] === H + '#organization' || organization.name === 'Da Vinci Trading'
    && ['https://davincitrading.com', H].includes(organization.sameAs), 'structured posting employer identity conflicts')
  return { ...row, postingId, schema, country: country(schema?.jobLocation?.address?.addressCountry), corporateDatePosted: schema?.datePosted ?? null }
}
const ATS = /(?:^|\.)(?:greenhouse\.io|myworkdayjobs\.com|myworkdaysite\.com|ashbyhq\.com|lever\.co|workable\.com|careers-page\.com|manatal\.com|smartrecruiters\.com|icims\.com|jobvite\.com|bamboohr\.com|teamtailor\.com|zohorecruit\.(?:com|in)|darwinbox\.(?:com|in)|dayforcehcm\.com)$/i
const scope = (html, base, reasons, references) => {
  const doc = readNativeDocument(html), frames = node => node.activeFrame ? [node] : node.inert ? [] : children(node).flatMap(frames)
  if (doc.nodes(n => n.tag === 'root').flatMap(frames).length) reasons.add('additional-active-frame-hiring-scope')
  for (const node of doc.nodes(n => n.tag === 'a' && n.attrs.href || n.tag === 'script' && n.attrs.src)) {
    // The current native consent question has a malformed prose href. Its exact
    // privacy label/prose pair is not another hiring inventory. Real URLs,
    // including a changed ATS destination with that label, remain in scope.
    if (node.tag === 'a' && node.attrs.href === 'For more information, please see the Privacy Statement'
      && doc.text(node) === 'Privacy Statement' && /^https:\/\/job-boards\.eu\.greenhouse\.io\/davinciderivatives\/jobs\/\d+$/.test(base)) continue
    let url
    try { url = new URL(node.attrs.href || node.attrs.src, base) } catch { continue }
    if (url.protocol === 'mailto:' || url.protocol === 'tel:') continue
    const role = url.origin === new URL(B).origin && url.pathname.match(/^\/davinciderivatives\/jobs\/([1-9]\d*)$/)
    if (role && !url.search && !url.hash) { references.native.add(role[1]); continue }
    if (url.origin === new URL(H).origin && /^\/job\/[a-z0-9-]+\/$/.test(url.pathname) && !url.search && !url.hash) { references.corporate.add(url.href); continue }
    if (node.tag === 'script' && url.origin === 'https://job-boards.cdn.greenhouse.io' && url.pathname.startsWith('/assets/')) continue
    if (node.tag === 'script' && url.origin === 'https://boards.eu.greenhouse.io' && url.pathname === '/embed/job_board/js' && url.searchParams.get('for') === TOKEN) continue
    const hiring = ATS.test(url.hostname) || /(?:^|\.)(?:jobs?|careers?|hiring|recruitment)\./i.test(url.hostname)
      || /\b(?:careers?|jobs?|openings?|open positions|join our team|opportunities)\b/i.test(doc.text(node))
    if (!hiring) continue
    if (url.origin === new URL(H).origin && ['/', '/careers', '/careers/'].includes(url.pathname) && !url.search) continue
    if (url.origin === new URL(B).origin && url.pathname === '/davinciderivatives' && [...url.searchParams].every(([key, value]) => key === 'page' && /^[1-9]\d*$/.test(value))) continue
    reasons.add('additional-public-hiring-scope:' + url.origin + url.pathname)
  }
}
const readModel = (html, isJob) => {
  const native = readNativeDocument(html), scripts = native.nodes(n => n.tag === 'script' && !n.attrs.src && !Object.hasOwn(n.attrs, 'nomodule')
    && /^(?:|text\/javascript|application\/javascript)$/i.test(n.attrs.type || '') && (n.raw || '').includes('window.__remixContext'))
  const assignment = one(scripts, 'active native model').raw.match(/^\s*window\.__remixContext\s*=\s*([\s\S]+);\s*$/)
  valid(assignment, 'invalid native static model declaration')
  const model = parse(assignment[1]), loaders = model.state?.loaderData, root = loaders?.root
  valid(model.state?.errors === null && object(root) && root.urlToken === TOKEN && root.internal === false && root.preview === false
    && root.isJobPost === isJob && root.boardConfiguration?.job_board_id === 4000939101 && root.boardConfiguration.job_board_public_url === B,
  'native public employer/board identity conflicts')
  return { doc: readVisibleNativeDocument(html), loaders }
}
const readBoard = (html, page, reasons) => {
  const { doc, loaders } = readModel(html, false), board = loaders['routes/$url_token'], posts = board?.jobPosts
  valid(board?.urlToken === TOKEN && board.board?.name === 'Da Vinci' && board.board.public_url === B && board.board.redirect_to === null, 'native board employer identity changed')
  valid(['departmentIds', 'officeIds'].every(key => Array.isArray(board[key]) && board[key].length === 0)
    && object(board.customFieldFilters) && Object.keys(board.customFieldFilters).length === 0, 'native board inventory is filtered')
  valid(object(posts) && Array.isArray(posts.data) && Number.isSafeInteger(posts.total) && posts.total >= 0 && posts.total <= 5000 && posts.page === page
    && posts.count === posts.data.length && posts.total_pages === Math.max(1, Math.ceil(posts.total / 50))
    && posts.data.length === Math.min(50, Math.max(0, posts.total - (page - 1) * 50)), 'native pagination/count inventory does not reconcile')
  valid(doc.nodes(n => n.tag === 'h1' && doc.text(n) === 'Current openings at Da Vinci').length === 1
    && doc.nodes(n => /^h[1-6]$/.test(n.tag) && doc.text(n) === posts.total + ' jobs').length === 1, 'native visible board/count identity conflicts')
  const anchors = doc.nodes(n => n.tag === 'a' && (n.attrs.href || '').startsWith(B + '/jobs/')), rows = new Map()
  for (const row of posts.data) {
    valid(id(row.id) && id(row.internal_job_id) && clean(row.title) && clean(row.location) && row.absolute_url === nativeUrl(row.id)
      && !rows.has(String(row.id)), 'native board posting identity invalid or duplicate')
    const anchor = one(anchors.filter(n => n.attrs.href === row.absolute_url), 'native visible posting')
    const badges = descendants(anchor, n => cls(n, 'tag-container'))
    let visibleIdentity = doc.text(anchor)
    if (badges.length) {
      const title = one(children(anchor).filter(n => n.tag === 'p' && cls(n, 'body--medium')), 'native visible posting title')
      const location = one(children(anchor).filter(n => n.tag === 'p' && cls(n, 'body--metadata')), 'native visible posting location')
      valid(children(anchor).length === 2 && badges.length === 1 && title.children.includes(badges[0]), 'unreviewed native badge placement')
      const badge = badges[0], ellipse = one(children(badge), 'native badge shape'), label = one(children(ellipse), 'native badge label')
      valid(badge.tag === 'span' && ellipse.tag === 'span' && cls(ellipse, 'ellipse') && label.tag === 'span' && cls(label, 'tag-text')
        && children(label).length === 0 && doc.text(label) === 'New' && doc.text(badge) === 'New', 'unreviewed native posting badge')
      // This publication badge is separate from both identity fields. Preserve
      // title words and geography; do not strip arbitrary matching prose.
      visibleIdentity = title.children.filter(child => child !== badge).map(child => typeof child === 'string' ? decodeNativeEntities(child) : doc.text(child)).join(' ') + ' ' + doc.text(location)
    }
    valid(folded(visibleIdentity) === folded(clean(row.title) + ' ' + clean(row.location)), 'native visible title/location conflicts')
    rows.set(String(row.id), row)
  }
  if (anchors.length !== rows.size) reasons.add('unaccounted-native-board-posting-links')
  return { rows, total: posts.total, pages: posts.total_pages }
}
const descriptionText = value => {
  if (typeof value !== 'string') return null
  const doc = readVisibleNativeDocument(value), text = doc.text(one(doc.nodes(n => n.tag === 'root'), 'native content root'))
  return extractActiveDescription(text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
}
const readDetail = (html, row, official, reasons, now) => {
  const { doc, loaders } = readModel(html, true), data = loaders['routes/$url_token_.jobs_.$job_post_id'], job = data?.jobPost, postingId = String(row.id)
  valid(data?.urlToken === TOKEN && data.jobPostId === postingId && object(job) && job.post_type === 'job_post' && job.company_name === 'Da Vinci'
    && job.hiring_plan_id === row.internal_job_id && job.public_url === nativeUrl(postingId) && folded(job.title) === folded(row.title)
    && clean(job.job_post_location) === clean(row.location), 'native employer/posting identity conflicts')
  valid(data.submitPath === 'https://boards.eu.greenhouse.io/davinciderivatives/jobs/' + postingId
    && data.confirmationPath === '/davinciderivatives/jobs/' + postingId + '/confirmation', 'native application route identity conflicts')
  valid(doc.text(one(doc.nodes(n => n.tag === 'h1'), 'native posting heading')).trim() === clean(row.title), 'native visible posting title conflicts')
  valid(clean(doc.text(one(doc.nodes(n => cls(n, 'job__location')), 'native visible posting geography'))) === clean(row.location), 'native visible country/location geography conflicts')
  const form = one(doc.nodes(n => n.tag === 'form' && n.attrs.id === 'application-form'), 'native role application form')
  valid(new URL(form.attrs.action, B).href === nativeUrl(postingId), 'native rendered application identity conflicts')
  if (job.redirect_to !== null || /\b(?:this (?:job|position|role) (?:is |has been )?(?:closed|filled|expired)|no longer accepting applications)\b/i.test(doc.text(one(doc.nodes(n => n.tag === 'body'), 'native posting body')))) {
    reasons.add('native-posting-not-public-or-active:' + postingId); return null
  }
  const geography = nativeGeography(row, job, reasons), india = geography.india
  if (official) {
    valid(folded(official.title) === folded(row.title) && clean(official.location) === clean(row.location), 'corporate/native posting title/location conflicts')
    valid(!official.country || geography.scopes.some(scope => scope.country === official.country) || geography.unresolved, 'corporate/native explicit country conflicts')
  }
  const fragments = ['introduction', 'content', 'conclusion'].map(key => descriptionText(job[key])), body = fragments[1]
  const descriptions = doc.nodes(n => cls(n, 'job__description')), fullText = fragments.filter(Boolean).join('\n\n')
  const full = Boolean(body && descriptions.length === 1 && compact(doc.text(descriptions[0])) === compact(fullText))
  if (!full) reasons.add('native-full-description-incomplete:' + postingId)
  valid(job.published_at === row.published_at, 'native original publication timestamp conflicts')
  const posted = nativeDate(job.published_at, now)
  if (job.application_deadline != null && (!Number.isFinite(Date.parse(job.application_deadline)) || Date.parse(job.application_deadline) <= Date.parse(now))) {
    reasons.add('native-application-deadline-passed-or-unresolved:' + postingId); return null
  }
  return { source: 'davincitrading', company: 'Da Vinci Trading', jobId: postingId,
    requisitionId: row.requisition_id == null || clean(row.requisition_id) === '' ? null : String(row.requisition_id),
    title: clean(row.title), department: clean(row.department?.name) || null, country: india.length ? 'India' : null,
    location: india.map(scope => scope.label).join(' / ') || clean(row.location), locations: india.map(scope => scope.label),
    city: india.length === 1 && india[0].label.includes(',') && !/^Remote,/i.test(india[0].label) ? india[0].label.split(',')[0] : null,
    sourceUrl: official?.url || nativeUrl(postingId), applyUrl: nativeUrl(postingId), link: nativeUrl(postingId),
    jobDescription: full ? fullText : null, sourceDescription: full ? fullText : null, sourceDetailComplete: full,
    sourceDetailFailureKind: full ? null : 'missing-content', nativeDescriptionSHA256: full ? hash(fullText) : null,
    postingDate: posted, sourcePublicationDateUnavailable: !posted, closingDate: job.application_deadline ?? null,
    sourceNativeCountryEvidence: { location: row.location, nativeDetailLocation: job.job_post_location, scopes: geography.scopes,
      selectedIndiaLocations: india.map(scope => scope.label), corporateAddress: official?.schema?.jobLocation?.address ?? null },
    sourceNativeEmployerEvidence: { brand: 'Da Vinci', companyWebsite: H, boardToken: TOKEN, nativeBoardId: 4000939101, nativeInternalJobId: row.internal_job_id, legalEmployer: null },
    sourceNativeDates: { publishedAt: job.published_at ?? null, updatedAt: row.updated_at ?? null, corporateDatePosted: official?.corporateDatePosted ?? null } }
}
const state = row => JSON.stringify([row?.id, row?.internal_job_id, clean(row?.title), clean(row?.location), row?.absolute_url, row?.published_at, row?.updated_at, row?.requisition_id, row?.department, row && countryFields(row)])
const defaultFetchPage = async (url, init) => {
  const response = await fetch(url, { ...init, redirect: 'follow' })
  return { status: response.status, url: response.url, body: await response.text(), contentType: response.headers.get('content-type') }
}
export const createDaVinciNativeInventory = (defaults = {}) => ({
  async run(options = {}) {
    const settings = { ...defaults, ...options }, signal = settings.signal, load = settings.fetchPage || defaultFetchPage
    valid(!settings.fetchText || settings.fetchPage, 'current native transport requires fetchPage')
    const maxJobs = settings.maxJobs ?? 0, maxPages = settings.maxPages ?? 50, now = new Date((settings.now || (() => new Date().toISOString()))()).toISOString()
    valid(Number.isSafeInteger(maxJobs) && maxJobs >= 0 && Number.isSafeInteger(maxPages) && maxPages > 0 && maxPages <= 100, 'invalid native output/enumeration budget')
    signal?.throwIfAborted()
    let requests = 0
    const reasons = new Set(), references = { native: new Set(), corporate: new Set() }
    const pageAt = async url => {
      signal?.throwIfAborted()
      const response = await load(url, { method: 'GET', headers: { Accept: 'text/html' }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000) })
      signal?.throwIfAborted(); requests++
      valid(response?.url === url, 'native response redirected outside its verified employer binding')
      if (response.status !== 200) { const error = Error('Da Vinci public native HTTP ' + response.status); error.status = response.status; throw error }
      valid(typeof response.body === 'string' && Buffer.byteLength(response.body) <= 4 * 1024 * 1024 && /^text\/html\b/i.test(response.contentType || ''), 'native public response format changed')
      scope(response.body, response.url, reasons, references)
      return response.body
    }
    const corporateScope = async () => {
      const home = corporatePage(await pageAt(H), H), careers = corporatePage(await pageAt(C), C)
      return { home: corporateCards(home), roles: corporateCards(careers) }
    }
    const enumerate = async () => {
      const rows = new Map(); let total, pages
      for (let page = 1; page <= maxPages; page++) {
        const result = readBoard(await pageAt(B + (page === 1 ? '' : '?page=' + page)), page, reasons)
        valid(total == null || total === result.total && pages === result.pages, 'native pagination total changed')
        total = result.total; pages = result.pages
        for (const [postingId, row] of result.rows) { valid(!rows.has(postingId), 'duplicate native posting across pages'); rows.set(postingId, row) }
        if (page === pages) break
      }
      valid(rows.size === total, 'native pagination budget exhausted before complete inventory')
      return rows
    }
    const initial = await corporateScope(), official = new Map()
    valid(initial.roles.size > 0, 'current first-party native employer handoff unavailable')
    for (const row of initial.roles.values()) {
      const detail = readCorporateDetail(await pageAt(row.url), row)
      valid(!official.has(detail.postingId), 'first-party native posting mapping duplicate')
      official.set(detail.postingId, detail)
    }
    const native = await enumerate(), jobs = []
    if (native.size !== official.size || [...official.keys()].some(postingId => !native.has(postingId))) reasons.add('corporate-native-posting-inventories-differ')
    for (const [postingId, row] of native) {
      const job = readDetail(await pageAt(nativeUrl(postingId)), row, official.get(postingId), reasons, now)
      if (job?.country === 'India') jobs.push(job)
    }
    const closing = await corporateScope(), after = await enumerate()
    if (JSON.stringify([...initial.roles]) !== JSON.stringify([...closing.roles]) || JSON.stringify([...initial.home]) !== JSON.stringify([...closing.home])) reasons.add('closing-corporate-inventory-changed')
    if (native.size !== after.size || [...native].some(([postingId, row]) => state(row) !== state(after.get(postingId)))) reasons.add('closing-native-inventory-changed')
    if ([...references.native].some(postingId => !native.has(postingId) || !after.has(postingId))
      || [...references.corporate].some(url => !initial.roles.has(url) || !closing.roles.has(url))) reasons.add('advertised-posting-identities-unreconciled')
    const healthy = jobs.filter(job => state(native.get(job.jobId)) === state(after.get(job.jobId))
      && (!official.get(job.jobId) || JSON.stringify(initial.roles.get(job.sourceUrl)) === JSON.stringify(closing.roles.get(job.sourceUrl))))
    const selected = maxJobs ? healthy.slice(0, maxJobs) : healthy
    if (selected.length !== healthy.length) reasons.add('source-job-limit')
    const complete = reasons.size === 0
    for (const job of selected) Object.assign(job, { scrapedAt: now, sourceListingComplete: complete, sourceScopeComplete: complete,
      lifecycleCleanupAllowed: complete, companyCareerPage: C, companyDomain: 'davincitrading.com', atsPlatform: 'greenhouse-eu+first-party-careers' })
    return attachInventoryEvidence(selected, { status: complete ? native.size ? 'complete-inventory' : 'verified-empty' : 'discovery-only',
      firstParty: true, surface: C, listingComplete: complete, reportedTotal: complete ? native.size : null, indiaFacetCount: complete ? healthy.length : null,
      pagesFetched: requests, verifiedAt: now, reason: complete ? 'davinci-corporate-and-native-public-inventories-reconciled' : 'davinci-native-incomplete:' + [...reasons].join(';') })
  },
})
