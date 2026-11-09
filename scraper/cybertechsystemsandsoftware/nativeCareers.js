import { createHash } from 'node:crypto'
import { readNativeDocument, decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readUniqueLiteralJSON } from './literalJSON.js'
import { CYBERTECH_SYSTEMS_AND_SOFTWARE_CATALOG as catalog } from './catalog.js'

const origin = 'https://cybertech.com', careersURL = catalog.companyCareerPage
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const norm = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const text = node => node.inert || ['script', 'style'].includes(node.tag) ? '' : norm(
  node.tag === 'title' ? decodeNativeEntities(node.raw || '') : node.children.map(child => typeof child === 'string' ? decodeNativeEntities(child) : text(child)).join(' '),
)
const descendants = (node, predicate) => node.inert ? [] : [
  ...(predicate(node) ? [node] : []),
  ...node.children.filter(child => typeof child !== 'string').flatMap(child => descendants(child, predicate)),
]
const plainHTML = html => {
  const document = readNativeDocument(html)
  return text(document.nodes(node => node.tag === 'root')[0])
}
const error = message => Object.assign(new Error('CyberTech coverage gap: ' + message), { code: 'CYBERTECH_COVERAGE_GAP' })
const parsedURL = value => { try { const url = new URL(value, careersURL);return url.origin === origin && !url.username && !url.password && !url.hash ? url : null } catch { return null } }
const roleURL = value => { const url = parsedURL(value);return url && /^\/job\/[^/]+\/$/.test(url.pathname) && !url.search ? url.href : null }
const individualURL = value => { const url = parsedURL(value);return url && /^\/wp-json\/wp\/v2\/job\/\d+$/.test(url.pathname) && !url.search ? url.href : null }
const collectionURL = value => { const url = parsedURL(value);return url && url.pathname === '/wp-json/wp/v2/job' && !url.search ? url.href : null }
const allowed = value => {
  const url = parsedURL(value)
  return Boolean(url && (url.href === careersURL || roleURL(url.href) || individualURL(url.href)
    || /^\/wp-json\/wp\/v2\/(?:job|job-type|job-location)$/.test(url.pathname)))
}
const header = (headers, key) => typeof headers?.get === 'function' ? headers.get(key)
  : Object.entries(headers || {}).find(([name]) => name.toLowerCase() === key)?.[1] ?? null
const count = value => typeof value === 'string' && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null
const firstLink = (record, relation) => Array.isArray(record?._links?.[relation]) && record._links[relation].length === 1 ? record._links[relation][0]?.href : null

export const inspectCareers = html => {
  const document = readNativeDocument(html), links = new Map()
  for (const node of document.nodes(node => node.tag === 'a' && node.attrs.href)) {
    const url = roleURL(node.attrs.href), title = text(node)
    if (!url || !title || /^(?:apply now|read more|view job)$/i.test(title)) continue
    if (!links.has(url)) links.set(url, { url, title, candidateTitles: [] })
    if (!links.get(url).candidateTitles.includes(title)) links.get(url).candidateTitles.push(title)
  }
  const identity = document.nodes(node => /^h[1-6]$/.test(node.tag) && /search jobs at cybertech/i.test(text(node))).length === 1
  return { identity, roleLinks: [...links.values()], originalHTML: html }
}

const criteriaBefore = (main, stop) => {
  let stopped = false
  const visit = node => {
    if (stopped || node.inert || ['script', 'style'].includes(node.tag)) return ''
    if (node === stop) { stopped = true;return '' }
    const parts = []
    for (const child of node.children) {
      if (stopped) break
      parts.push(typeof child === 'string' ? decodeNativeEntities(child) : visit(child))
    }
    return norm(parts.join(' '))
  }
  return visit(main)
}

const inspectDetailUnsafe = (html, url, post, careerTitle) => {
  const document = readNativeDocument(html), mains = document.nodes(node => node.attrs.id === 'main-content')
  const headings = document.nodes(node => node.tag === 'h1'), canonicals = document.nodes(node => node.tag === 'link' && (node.attrs.rel || '').split(/\s+/).includes('canonical'))
  const openGraphURLs = document.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:url')
  const identityURLs = [...canonicals.map(node => node.attrs.href), ...openGraphURLs.map(node => node.attrs.content)]
  const urlIdentityBound = canonicals.length <= 1 && openGraphURLs.length <= 1 && identityURLs.length > 0
    && identityURLs.every(value => roleURL(value) === url)
  const declaredAlternates = document.nodes(node => node.tag === 'link' && (node.attrs.rel || '').split(/\s+/).includes('alternate')
    && node.attrs.type === 'application/json')
  const alternates = declaredAlternates.map(node => individualURL(node.attrs.href)).filter(Boolean)
  const title = headings.length === 1 ? text(headings[0]) : null
  const main = mains.length === 1 ? mains[0] : null
  const applyHeadings = main ? descendants(main, node => /^h[1-6]$/.test(node.tag) && /^apply now$/i.test(text(node))) : []
  const criteriaText = main && applyHeadings.length === 1 ? criteriaBefore(main, applyHeadings[0]) : null
  const issues = []
  const postTitle = post ? plainHTML(post.title.rendered) : null
  if (!main || !title || !urlIdentityBound
    || !criteriaText || criteriaText.length < 200 || declaredAlternates.length !== 1 || alternates.length !== 1
    || (post && (title !== postTitle || alternates[0] !== firstLink(post, 'self')
    || !criteriaText.includes(plainHTML(post.content.rendered)))) || (careerTitle && careerTitle !== title)) issues.push('native-role-title-url-or-criteria-unreconciled')
  const forms = main ? descendants(main, node => node.tag === 'form').map(form => ({ attrs: { ...form.attrs },
    controls: descendants(form, node => ['input', 'select', 'textarea'].includes(node.tag)).map(control => ({ tag: control.tag, attrs: { ...control.attrs },
      text: text(control), options: control.tag === 'select' ? descendants(control, node => node.tag === 'option').map(option => ({ attrs: { ...option.attrs }, text: text(option) })) : [] })) })) : []
  const controls = forms.flatMap(form => form.controls)
  const titleFields = controls.filter(control => control.attrs.name === 'input_11')
  const urlFields = controls.filter(control => control.attrs.name === 'input_12')
  const applicationBound = issues.length === 0 && forms.length === 1 && titleFields.length === 1 && urlFields.length === 1
    && titleFields[0].attrs.value === title && urlFields[0].attrs.value === url
  const fields = main ? descendants(main, node => /^h[1-6]$/.test(node.tag)).flatMap(heading => {
    const label = text(heading)
    if (!['Qualification', 'Experience', 'Shift Timings', 'Job Role'].includes(label)) return []
    const parents = document.nodes(node => node.children.includes(heading))
    const value = parents.length === 1 && text(parents[0]).startsWith(label) ? text(parents[0]).slice(label.length).trim() : null
    return [{ label, value }]
  }) : []
  return { bound: issues.length === 0, title, criteriaText, alternates, issues, fields, originalHTML: html,
    application: { forms, boundToRole: applicationBound, activationVerified: false, allControlsQualified: false,
      interpretation: 'Original declared HTML controls only; complete original page also preserves scripts, styles and inactive models.' } }
}

// Parsing a single original role/model is synchronous. Keep its bad bytes in
// rawPages, while caller cancellation and awaited audit failures remain outside
// this boundary and still propagate.
export const inspectDetail = (html, url, post = null, careerTitle = null) => {
  try { return inspectDetailUnsafe(html, url, post, careerTitle) }
  catch (caught) {
    return { bound: false, title: null, criteriaText: null, alternates: [], fields: [], originalHTML: html,
      issues: ['native-role-html-or-model-malformed'], parseError: { name: caught.name, message: caught.message },
      application: { forms: [], boundToRole: false, activationVerified: false, allControlsQualified: false } }
  }
}

const validRecord = (record, endpoint) => {
  try {
    return Boolean(record && Number.isSafeInteger(record.id) && record.id > 0
      && record.type === 'job' && record.status === 'publish' && typeof record.title?.rendered === 'string'
      && plainHTML(record.title.rendered) && typeof record.content?.rendered === 'string'
      && roleURL(record.link) && individualURL(firstLink(record, 'self'))
      && new URL(firstLink(record, 'self')).pathname.split('/').at(-1) === String(record.id)
      && collectionURL(firstLink(record, 'collection')) === endpoint)
  } catch { return false }
}

const defaultFetch = async (url, { signal } = {}) => {
  const response = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.any([AbortSignal.timeout(15000), ...(signal ? [signal] : [])]),
    headers: { Accept: 'text/html,application/json', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)' } })
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > 8 * 1024 * 1024) throw error('Native body exceeds retained-input limit')
  return { html: bytes.toString('utf8'), status: response.status, url: response.url,
    headers: Object.fromEntries(response.headers), bodyBase64: bytes.toString('base64') }
}

export const runNative = async ({ fetchText = defaultFetch, signal, onAudit = () => {}, now = () => new Date().toISOString(), maxJobs = null } = {}) => {
  const rawPages = [], issues = [], cache = new Map()
  const issue = (kind, fields = {}) => issues.push({ kind, ...fields })
  const load = async (url, force = false) => {
    signal?.throwIfAborted()
    if (!allowed(url)) { issue('native-url-blocked', { url });return null }
    if (!force && cache.has(url)) return cache.get(url)
    let page
    try {
      const response = await fetchText(url, { signal })
      signal?.throwIfAborted()
      const html = typeof response === 'string' ? response : response?.html
      const bytes = typeof response?.bodyBase64 === 'string' ? Buffer.from(response.bodyBase64, 'base64') : null
      const metadataOK = typeof response !== 'string' && response?.status === 200 && response?.url === url
      page = { url, status: response?.status ?? null, finalURL: response?.url ?? null, headers: response?.headers ?? {},
        originalHTML: typeof html === 'string' ? html : null, bodyBase64: bytes?.toString('base64') ?? null,
        bodySHA256: bytes ? digest(bytes) : null, transportQualified: metadataOK,
        usable: typeof html === 'string' && (typeof response === 'string' || metadataOK) && (!bytes || bytes.toString('utf8') === html) }
      if (!page.usable) issue('native-response-unavailable-or-contradictory', { url, status: page.status, finalURL: page.finalURL })
    } catch (caught) {
      signal?.throwIfAborted()
      page = { url, usable: false, transportQualified: false, originalHTML: null, error: { name: caught.name, message: caught.message } }
      issue('native-response-failed', { url, message: caught.message })
    }
    rawPages.push(page);if (!force) cache.set(url, page)
    return page
  }
  const json = page => {
    if (!page?.usable) return null
    try {
      const parsed = readUniqueLiteralJSON(page.originalHTML)
      if (parsed.duplicateKeys.length) { page.duplicateKeys = parsed.duplicateKeys;issue('native-json-duplicate-keys', { url: page.url, duplicateKeys: parsed.duplicateKeys });return null }
      return parsed.value
    } catch (caught) { issue('native-json-malformed', { url: page.url, message: caught.message });return null }
  }
  const collection = async (url, phase) => {
    const rows = [], pages = [], seen = new Set(), base = new URL(url)
    let current = url, reportedTotal = null, reportedPages = null
    while (current && pages.length < 30) {
      const nextURL = parsedURL(current)
      if (!nextURL || nextURL.pathname !== base.pathname || seen.has(current)
        || [...base.searchParams].some(([key, value]) => nextURL.searchParams.get(key) !== value)
        || [...nextURL.searchParams.keys()].some(key => !base.searchParams.has(key) && !['page', 'per_page'].includes(key))) {
        issue('native-pagination-unreconciled', { url: current, phase });break
      }
      seen.add(current)
      const page = await load(current, true);pages.push(page)
      const data = json(page)
      if (!Array.isArray(data)) { issue('native-collection-schema-unavailable', { url: current, phase });break }
      rows.push(...data)
      const total = count(header(page.headers, 'x-wp-total')), totalPages = count(header(page.headers, 'x-wp-totalpages'))
      if (reportedTotal == null) { reportedTotal = total;reportedPages = totalPages }
      if (total == null || totalPages == null || total !== reportedTotal || totalPages !== reportedPages) issue('native-count-unreconciled', { url: current, phase })
      current = header(page.headers, 'link')?.match(/<([^>]+)>;\s*rel=["']?next["']?/)?.[1] ?? null
    }
    const observedIDs = rows.map(row => row?.id)
    const duplicates = observedIDs.filter((id, index) => observedIDs.indexOf(id) !== index)
    if (duplicates.length) issue('native-id-duplicate', { phase, ids: [...new Set(duplicates)] })
    const complete = reportedTotal != null && rows.length === reportedTotal && duplicates.length === 0
      && (reportedTotal === 0 || pages.length === reportedPages) && !current
    if (!complete) issue('native-collection-incomplete', { phase, reportedTotal, observedRecords: rows.length })
    return { rows, reportedTotal, reportedPages, pagesFetched: pages.length, complete }
  }
  const openingPage = await load(careersURL)
  if (!openingPage?.usable) throw error('Careers HTTP response unavailable')
  const opening = inspectCareers(openingPage.originalHTML)
  if (!opening.identity || !opening.roleLinks.length) throw error('Careers identity or public role links changed')
  let endpoint = null
  const seedPosts = [], detailCache = new Map()
  for (const link of opening.roleLinks) {
    const page = await load(link.url)
    if (!page?.usable) continue
    const detail = inspectDetail(page.originalHTML, link.url);detailCache.set(link.url, { page, detail })
    if (!detail.bound) issue('native-bootstrap-detail-unreconciled', { url: link.url, issues: detail.issues })
    for (const alternate of detail.alternates) {
      const post = json(await load(alternate)), candidate = collectionURL(firstLink(post, 'collection'))
      if (candidate && validRecord(post, candidate) && post.link === link.url) { seedPosts.push(post);endpoint = candidate;break }
    }
    if (endpoint) break
  }
  const nativeOpening = endpoint ? await collection(endpoint, 'opening') : { rows: [], complete: false }
  const models = new Map()
  const incorporate = (rows, phase) => {
    for (const post of rows) {
      if (!validRecord(post, endpoint)) { issue('native-job-schema-unreconciled', { phase, id: post?.id ?? null });continue }
      models.set(post.link, post)
    }
  }
  incorporate(seedPosts, 'bootstrap');incorporate(nativeOpening.rows, 'opening')
  if (!models.size || !nativeOpening.complete) {
    for (const link of opening.roleLinks) {
      const page = await load(link.url)
      if (!page?.usable) continue
      const detail = inspectDetail(page.originalHTML, link.url);detailCache.set(link.url, { page, detail })
      for (const alternate of detail.alternates) { const post = json(await load(alternate));if (endpoint && validRecord(post, endpoint) && post.link === link.url) { incorporate([post], 'career-fallback');break } }
    }
  }
  const locationData = new Map(), typeData = new Map()
  const collectDetail = async post => {
    const page = await load(post.link)
    if (page?.usable) {
      const detail = inspectDetail(page.originalHTML, post.link, post, opening.roleLinks.find(link => link.url === post.link)?.title ?? null)
      detailCache.set(post.link, { page, detail })
      if (!detail.bound) issue('native-role-detail-unreconciled', { id: post.id, issues: detail.issues })
    }
    const relations = post._links?.['wp:term']
    if (!Array.isArray(relations)) { issue('native-taxonomy-relations-unreconciled', { id: post.id });return }
    for (const relation of relations) {
      if (!relation || typeof relation !== 'object') { issue('native-taxonomy-relation-unreconciled', { id: post.id });continue }
      if (!['job-location', 'job-type'].includes(relation.taxonomy)) continue
      const url = parsedURL(relation.href)
      if (!url || url.pathname !== `/wp-json/wp/v2/${relation.taxonomy}` || url.searchParams.get('post') !== String(post.id)) { issue('native-taxonomy-relation-unreconciled', { id: post.id });continue }
      const result = await collection(url.href, `role-${post.id}-${relation.taxonomy}`)
      const expected = post[relation.taxonomy]
      const coherent = Array.isArray(expected) && expected.every(id => Number.isSafeInteger(id)) && result.complete
        && result.rows.every(term => term && term.taxonomy === relation.taxonomy && expected.includes(term.id)
          && typeof term.name === 'string' && norm(term.name))
        && result.rows.length === expected.length
      const entry = { originalTerms: result.rows, declaredTermIDs: expected, postID: post.id, relationURL: url.href, coherent }
      ;(relation.taxonomy === 'job-location' ? locationData : typeData).set(post.link, entry)
      if (!coherent) issue('native-taxonomy-unreconciled', { id: post.id, taxonomy: relation.taxonomy })
    }
  }
  for (const post of models.values()) await collectDetail(post)
  const nativeClosing = endpoint ? await collection(endpoint, 'closing') : { rows: [], complete: false }
  const originalURLs = new Set(models.keys())
  incorporate(nativeClosing.rows, 'closing')
  for (const post of models.values()) if (!originalURLs.has(post.link)) await collectDetail(post)
  if (JSON.stringify(nativeOpening.rows) !== JSON.stringify(nativeClosing.rows)) issue('native-opening-closing-records-differ')
  const closingPage = await load(careersURL, true)
  const closing = closingPage?.usable ? inspectCareers(closingPage.originalHTML) : null
  if (!closing?.identity || JSON.stringify(opening.roleLinks) !== JSON.stringify(closing.roleLinks)) issue('career-opening-closing-links-unreconciled')
  const observations = []
  const finalTerms = (entry, post, taxonomy) => {
    if (!entry) return null
    const ids = post[taxonomy]
    const relations = Array.isArray(post._links?.['wp:term']) ? post._links['wp:term'].filter(relation => relation?.taxonomy === taxonomy) : []
    const coherent = entry.coherent && entry.postID === post.id && Array.isArray(ids)
      && JSON.stringify([...entry.declaredTermIDs].sort((a, b) => a - b)) === JSON.stringify([...ids].sort((a, b) => a - b))
      && relations.length === 1 && relations[0].href === entry.relationURL
    if (entry.coherent && !coherent) issue('native-taxonomy-opening-closing-unreconciled', { id: post.id, taxonomy })
    return { ...entry, coherent: Boolean(coherent), finalDeclaredTermIDs: ids ?? null, finalPostID: post.id }
  }
  for (const post of models.values()) {
    const cached = detailCache.get(post.link), detail = cached?.page.usable ? inspectDetail(cached.page.originalHTML, post.link, post,
      opening.roleLinks.find(link => link.url === post.link)?.title ?? null) : null
    if (detail && !detail.bound) issue('native-final-detail-unreconciled', { id: post.id, issues: detail.issues })
    const locations = finalTerms(locationData.get(post.link), post, 'job-location'), types = finalTerms(typeData.get(post.link), post, 'job-type')
    const employment = types?.coherent && types.originalTerms.length === 1 ? norm(types.originalTerms[0].name) : null
    observations.push({ title: plainHTML(post.title.rendered), jobId: String(post.id), requisitionId: null,
      sourceUrl: post.link, applyUrl: post.link, company: catalog.companyName, source: catalog.source,
      location: null, locations: [], city: null, state: null, country: null,
      department: null, employmentType: employment, experienceRequired: detail?.bound ? detail.fields.find(field => field.label === 'Experience')?.value || null : null,
      minimumQualification: null, preferredQualification: null, requiredSkills: [], postingDate: null, closingDate: null, remoteStatus: null,
      jobDescription: detail?.bound ? detail.criteriaText : null, sourceDescription: detail?.bound ? detail.criteriaText : null,
      sourceNativeWordPressPost: post, sourceNativeLocations: locations ?? null,
      sourceNativeApplication: detail?.application ?? { forms: [], boundToRole: false, activationVerified: false, allControlsQualified: false },
      sourceNativeCriteriaFields: detail?.fields ?? [], sourceNativeRoleDetail: { url: post.link, bodySHA256: cached?.page.bodySHA256 ?? null, bound: detail?.bound === true, issues: detail?.issues ?? ['native-detail-unavailable'] },
      sourceListedOnCareersPage: opening.roleLinks.some(link => link.url === post.link),
      sourceNativeRecruitmentStatus: null, sourceCountryScopeUnresolved: true, sourceDetailComplete: false,
      sourceListingComplete: false, lifecycleCleanupAllowed: false, publicExperienceChecked: false,
      companyCareerPage: careersURL, companyDomain: catalog.companyDomain, atsPlatform: catalog.atsPlatform,
    })
  }
  for (const link of opening.roleLinks) if (!models.has(link.url)) observations.push({ title: link.title,
    company: catalog.companyName, source: catalog.source, sourceUrl: link.url, applyUrl: link.url, jobId: null, requisitionId: null,
    location: null, locations: [], city: null, state: null, country: null, jobDescription: null, postingDate: null, closingDate: null,
    sourceNativeWordPressPost: null, sourceListedOnCareersPage: true, sourceCountryScopeUnresolved: true,
    sourceDetailComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false })
  const audit = { source: catalog.source, observations, rawPages, issues, openingCareerLinks: opening.roleLinks,
    closingCareerLinks: closing?.roleLinks ?? null, nativeOpening, nativeClosing, observedPublishedNativeCount: models.size,
    nativeCollectionURL: endpoint, authoritativeSourceTotal: null, authoritativeIndiaFacetCount: null,
    sourceScopeComplete: false, applicationActivationVerified: false, lifecycleCleanupAllowed: false,
    qualification: 'Published native content observations, not verified active recruitment, complete source or country inventory. Raw content dates remain original metadata, not recruitment publication claims.' }
  await onAudit(structuredClone(audit));signal?.throwIfAborted()
  const limit = Number.isSafeInteger(maxJobs) && maxJobs >= 0 ? maxJobs : null
  const jobs = (limit == null ? observations : observations.slice(0, limit)).map(job => ({ ...job, link: job.applyUrl, scrapedAt: now() }))
  Object.defineProperty(jobs, 'sourceAudit', { value: audit })
  return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: careersURL, firstParty: openingPage.transportQualified,
    listingComplete: false, pagesFetched: rawPages.filter(page => page.usable).length, reportedTotal: null, indiaFacetCount: null,
    verifiedAt: now(), reason: 'cybertech-native-published-records-and-original-role-criteria-retained-country-availability-activation-and-full-source-scope-unresolved' })
}
