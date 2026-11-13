import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { activeHead, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { createCurrentDeclaredNativeRead, nativeContract } from '../../scraper-support/utils/currentDeclaredNativeRead.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const contract = JSON.parse(readFileSync(new URL('./reviewedNativeContract20261113.json', import.meta.url)))
const digest = value => createHash('sha256').update(value).digest('hex')
const norm = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const canonical = value => JSON.stringify(value, (_key, item) => item && !Array.isArray(item) && typeof item === 'object'
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
const walk = node => [node, ...node.children.filter(child => typeof child !== 'string').flatMap(walk)]
const ancestry = root => {
  const parents = new Map()
  for (const node of walk(root)) for (const child of node.children) if (typeof child !== 'string') parents.set(child, node)
  return parents
}
const pathOf = (node, parents, id, apply) => {
  const result = []
  while (node) {
    const attrs = { ...node.attrs }
    if (attrs['data-id'] === id) attrs['data-id'] = 'NATIVE_ROLE_ID'
    if (attrs.id === 'js-job-detail') attrs['data-jobtitle'] = 'NATIVE_ROLE_TITLE'
    if (node === apply) attrs.href = 'NATIVE_ROLE_APPLY_URL'
    result.unshift({ tag: node.tag, attrs }); node = parents.get(node)
  }
  return result
}
const textOf = html => {
  const doc = readNativeDocument(html)
  return doc.text(doc.nodes(node => node.tag === 'root')[0])
}

// Metadata supplies role-owned geography and identity. The authored article,
// including additional employment conditions, supplies the complete criteria.
// Neither a URL locale nor the provider's default country qualifies geography.
export const readObservedCognizantRole = (html, { sourceUrl, id, css } = {}) => {
  const observation = { id, sourceUrl, nativeCountries: [], nativeLocations: [], nativeRecord: null,
    nativeArticleHtml: null, originalDescription: null, countryComplete: false, criteriaComplete: false,
    indiaCandidate: false, applicationHandoffComplete: false, declaredApplyRoleId: null,
    declaredApplyUrl: null, applicationAvailable: false, job: null, issues: [] }
  try {
    const doc = readNativeDocument(html), root = doc.nodes(node => node.tag === 'root')[0]
    const raw = walk(root), parents = ancestry(root)
    const postings = doc.nodes(node => node.tag === 'script' && node.attrs.id === 'js-job-posting'
      && node.attrs.type === 'application/ld+json')
    nativeContract(postings.length === 1, 'Cognizant native JobPosting is ambiguous')
    const record = JSON.parse(postings[0].raw)
    observation.nativeRecord = record
    const metas = activeHead(html).metas.filter(meta => meta.name === 'JobIdentifier')
    nativeContract(record['@type'] === 'JobPosting' && record.identifier === id && record.url === sourceUrl
      && metas.length === 1 && metas[0].content === id
      && record.hiringOrganization?.name === 'Cognizant', 'Cognizant native role identity changed')
    const locations = Array.isArray(record.jobLocation) ? record.jobLocation : record.jobLocation ? [record.jobLocation] : []
    observation.nativeLocations = structuredClone(locations)
    const countries = locations.map(place => typeof place?.address?.addressCountry === 'string'
      ? norm(place.address.addressCountry) : '')
    observation.nativeCountries = [...new Set(countries.filter(Boolean))]
    observation.countryComplete = locations.length > 0 && countries.every(country => country
      && !/^(?:remote|global|worldwide|unknown|n\/a)$/i.test(country))
    observation.indiaCandidate = observation.countryComplete && countries.every(country => /^(?:India|IN)$/i.test(country))

    const articles = raw.filter(node => node.tag === 'article' && doc.hasClass(node, 'cms-content'))
    nativeContract(articles.length === 1, 'Cognizant complete authored article is ambiguous')
    const article = articles[0]
    const originalArticles = [...html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/gi)]
    nativeContract(originalArticles.length === 1, 'Cognizant original article boundaries changed')
    observation.nativeArticleHtml = originalArticles[0][0]
    const styles = raw.filter(node => node.tag === 'style')
    const declaredStyles = doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'stylesheet')
    const cssQualified = typeof css === 'string' && digest(css) === contract.cssSha256
      && styles.length === 0 && declaredStyles.length === 1
      && new URL(declaredStyles[0].attrs.href, sourceUrl).href === contract.cssUrl
    const criterionNodes = walk(article)
    const markupQualified = criterionNodes.every(node => !node.inert
      && Object.hasOwn(contract.criterionAttributes, node.tag)
      && Object.keys(node.attrs).every(key => contract.criterionAttributes[node.tag].includes(key))
      && (node.attrs.class || '').split(/\s+/).filter(Boolean).every(value => contract.criterionClasses.includes(value)))
    const projected = readVisibleNativeDocument(html.replace('</head>', '<style>' + String(css || '') + '</style></head>'), { strict: true })
    const visibleArticles = projected.nodes(node => node.tag === 'article' && projected.hasClass(node, 'cms-content'))
    const authoredText = doc.text(article), visibleText = visibleArticles.length === 1 ? projected.text(visibleArticles[0]) : ''
    const metadataText = textOf(record.description || '')
    observation.criteriaComplete = cssQualified && markupQualified
      && canonical(pathOf(article, parents, id)) === canonical(contract.articlePath)
      && authoredText.length > 100 && visibleText === authoredText && metadataText.length > 100
      && authoredText.includes(metadataText)
    // Keep original text only when its visible completeness is established;
    // the raw authored article and metadata remain in the audit on every hold.
    if (observation.criteriaComplete) observation.originalDescription = authoredText

    const apply = doc.nodes(node => node.tag === 'a' && doc.hasClass(node, 'js-apply-now'))
    if (apply.length === 1) {
      const url = new URL(apply[0].attrs.href, sourceUrl)
      observation.declaredApplyUrl = url.href
      observation.declaredApplyRoleId = url.searchParams.get('RRID')
      observation.applicationHandoffComplete = url.origin === 'https://talent.cognizant.com' && url.pathname === '/4681/'
        && !url.username && !url.password && !url.hash && [...url.searchParams].length === 3
        && url.searchParams.getAll('RRID').length === 1 && url.searchParams.get('RRID') === id
        && url.searchParams.get('TenantID') === '1' && url.searchParams.get('STID') === '1000000004'
        && canonical(pathOf(apply[0], parents, id, apply[0])) === canonical(contract.applyPath)
        && projected.nodes(node => node.tag === 'a' && projected.hasClass(node, 'js-apply-now')).length === 1
    }
    if (!observation.countryComplete) observation.issues.push('native-location-country-incomplete')
    if (!observation.criteriaComplete) observation.issues.push('full-visible-original-criteria-unqualified')
    if (!observation.applicationHandoffComplete) observation.issues.push('application-role-handoff-unqualified')
    observation.issues.push('usable-current-native-application-unverified')
  } catch (error) { observation.issues.push(error.message) }
  return observation
}

const boundedCallback = (callback, value, signal) => new Promise((resolve, reject) => {
  const abort = () => reject(signal.reason)
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()
  else Promise.resolve().then(() => { signal.throwIfAborted(); return callback(value) }).then(resolve, reject)
    .finally(() => signal.removeEventListener('abort', abort))
})

// Current application evidence ends at a branded shell whose declared main
// program returns HTTP403. Preserve actual records while withholding unknown
// application availability; this guard cannot establish an India zero.
export const runCognizantCurrent20261113 = async (options, { extractSearchResults, extractPaginationSummary, maxPages, headers }) => {
  const urls = new Set(['https://careers.cognizant.com/india-en/jobs/'])
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const reader = createCurrentDeclaredNativeRead('cognizant', url => urls.has(url), {
    // This remains below the unchanged registered source budget of 300000ms.
    signal: options.signal, sourceTimeoutMs: 120000,
    fetchImpl: async (url, init) => {
      // Preserve this reader's existing public HTTP context. A paired current
      // response proves the generic helper profile repeats page one for page two.
      const response = await fetchImpl(url, { ...init, headers: { ...init.headers, ...headers } })
      if (response.status !== 200) {
        void response.body?.cancel().catch(() => {})
        throw Object.assign(new Error('Cognizant public HTTP ' + response.status + ' for ' + url), {
          status: response.status, softFailure: true, upstreamOutage: true, abortRetries: true,
          failureKind: [401, 403, 429, 451].includes(response.status) ? 'blocked_or_access_denied' : 'network_or_timeout',
        })
      }
      const mime = response.headers.get('content-type') || ''
      const expectedMime = url === contract.cssUrl ? /text\/css/i : /\/main\.[a-f0-9]+\.js$/.test(new URL(url).pathname)
        ? /(?:application|text)\/(?:java|ecma)script/i : /text\/html|application\/xhtml\+xml/i
      if (!expectedMime.test(mime)) {
        void response.body?.cancel().catch(() => {})
        nativeContract(false, 'Cognizant native response MIME changed')
      }
      return response
    },
  })
  const observations = [], listings = [], seen = new Set()
  const audit = { source: 'cognizant', recordKind: 'vacancy-rows', sourceScopeComplete: false,
    configuredBoardComplete: false, lifecycleCleanupAllowed: false, companyGlobalTotal: null, companyIndiaTotal: null,
    observedRecordCount: 0, observedVacancyCount: 0, closingStable: false, observations, applicationEvidence: null,
    nativePages: [] }
  let css = '', next = [...urls][0], reportedTotal = null
  try {
  for (let page = 1; next && page <= Math.min(maxPages, 8); page++) {
    const response = await reader.read(next), html = response.originalText
    const summary = extractPaginationSummary(html), records = extractSearchResults(html)
    // The real eighth response omits navigation but keeps its native page
    // number in the active document title. It establishes this partial page,
    // never a terminal/global inventory or absence of further vacancies.
    const titles = activeHead(html).titles
    const titlePage = titles.length === 1
      ? titles[0].match(/^Your first job at Cognizant is just the beginning of your journey \| Cognizant Careers - Page (\d+)$/)?.[1] : null
    const nativePage = summary.currentPage ?? (titlePage ? Number(titlePage) : null)
    nativeContract(records.length > 0 && nativePage === page && Number.isSafeInteger(summary.totalJobCount)
      && (reportedTotal === null || reportedTotal === summary.totalJobCount), 'Cognizant current listing inventory changed')
    audit.nativePages.push({ url: next, nativePage, observedRows: records.length,
      continuationKnown: summary.hasNext || summary.totalPages === page })
    reportedTotal = summary.totalJobCount
    const doc = readNativeDocument(html)
    const sheets = doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'stylesheet')
    nativeContract(sheets.length === 1 && new URL(sheets[0].attrs.href, next).href === contract.cssUrl,
      'Cognizant declared native stylesheet changed')
    if (!css) { urls.add(contract.cssUrl); css = (await reader.read(contract.cssUrl)).originalText }
    for (const record of records) {
      const roleUrl = new URL(record.sourceUrl)
      nativeContract(!seen.has(record.jobId) && /^\d+$/.test(record.jobId)
        && roleUrl.origin === 'https://careers.cognizant.com' && roleUrl.pathname.startsWith('/india-en/jobs/'),
      'Cognizant native listing identity or URL changed')
      seen.add(record.jobId); listings.push(record); urls.add(record.sourceUrl)
    }
    if (!summary.hasNext) next = null
    else {
      const links = doc.nodes(node => node.tag === 'li' && doc.hasClass(node, 'next'))
        .flatMap(node => doc.nodes(child => child.tag === 'a', node))
      nativeContract(links.length === 1, 'Cognizant next-page declaration changed')
      const url = new URL(links[0].attrs.href, next)
      nativeContract(url.origin === 'https://careers.cognizant.com' && url.pathname === '/india-en/jobs/'
        && [...url.searchParams].length === 1 && url.searchParams.get('page') === String(page + 1)
        && ['', '#results'].includes(url.hash),
      'Cognizant next-page native scope changed')
      // The native #results fragment scrolls this SSR page; HTTP does not send it.
      url.hash = ''
      next = url.href; urls.add(next)
    }
  }
  for (let offset = 0; offset < listings.length; offset += 4) {
    await Promise.all(listings.slice(offset, offset + 4).map(async record => {
      const page = await reader.read(record.sourceUrl)
      observations.push(readObservedCognizantRole(page.originalText, { sourceUrl: record.sourceUrl, id: record.jobId, css }))
    }))
  }
  audit.observedRecordCount = audit.observedVacancyCount = observations.length
  audit.reportedPartialListingTotal = reportedTotal
  const candidate = observations.find(row => row.indiaCandidate && row.criteriaComplete && row.applicationHandoffComplete)
  if (candidate) {
    urls.add(candidate.declaredApplyUrl)
    try {
      const application = await reader.read(candidate.declaredApplyUrl), doc = readNativeDocument(application.originalText)
      const bases = doc.nodes(node => node.tag === 'base')
      const mains = doc.nodes(node => node.tag === 'script' && node.attrs.type === 'module' && /^main\.[a-f0-9]+\.js$/.test(node.attrs.src || ''))
      nativeContract(bases.length === 1 && bases[0].attrs.href === '/4681/' && mains.length === 1,
        'Cognizant public application renderer unqualified')
      const mainUrl = new URL(mains[0].attrs.src, new URL(bases[0].attrs.href, candidate.declaredApplyUrl)).href
      urls.add(mainUrl)
      const program = await reader.read(mainUrl)
      audit.applicationEvidence = { roleId: candidate.id, declaredUrl: candidate.declaredApplyUrl,
        declaredMainUrl: mainUrl, mainSha256: program.bodySHA256, available: false,
        reason: 'current-program-form-and-role-lookup-not-yet-qualified' }
    } catch (error) {
      reader.signal.throwIfAborted()
      audit.applicationEvidence = { roleId: candidate.id, declaredUrl: candidate.declaredApplyUrl,
        available: false, reason: error.message }
    }
  }
  const jobs = []
  if (options.onAudit) await boundedCallback(options.onAudit, structuredClone(audit), reader.signal)
  reader.signal.throwIfAborted()
  attachSourceObservationEvidence(jobs, audit)
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: audit, configurable: true })
  return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: 'https://careers.cognizant.com/india-en/jobs/',
    firstParty: true, listingComplete: false, reportedTotal: null, indiaFacetCount: null,
    lifecycleCleanupAllowed: false, pagesFetched: reader.pages.length, verifiedAt: new Date().toISOString(),
    reason: 'native-partial-listing-and-full-authored-criteria-retained;current-usable-application-unverified;company-scope-and-closing-unverified;cleanup-forbidden' })
  } catch (error) {
    audit.observedRecordCount = audit.observedVacancyCount = observations.length
    audit.reportedPartialListingTotal = reportedTotal
    audit.failure = error?.message || String(error)
    if (error && typeof error === 'object' && Object.isExtensible(error)) error.sourceAudit = structuredClone(audit)
    throw error
  }
}
