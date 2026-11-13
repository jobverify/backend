import { decodeHTML } from 'entities'
import { runVerifiedEmployerLinkedIn } from '../../scraper-support/shared/verifiedEmployerLinkedIn.js'
import { activeHead, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const SOURCE = 'airtelpaymentsbank'
const COMPANY = 'Airtel Payments Bank'
const OFFICIAL = 'https://www.airtelpayments.bank.in/'
const EMPLOYER = 'https://www.linkedin.com/company/airtelpaymentsbank'
const LISTING_PATH = '/jobs/airtel-payments-bank-jobs-worldwide'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36'
const classes = (node, value) => (node.attrs?.class || '').split(/\s+/).includes(value)
const norm = value => String(value || '').replace(/\s+/g, ' ').trim()
const fail = message => { throw new Error('Airtel Payments Bank native ' + message) }
const one = (nodes, label) => nodes.length === 1 ? nodes[0] : fail(label + ' identity changed')
const children = (node, predicate) => [ ...(predicate(node) ? [node] : []),
  ...node.children.filter(child => typeof child !== 'string').flatMap(child => children(child, predicate)) ]
const bodyText = node => node.inert || ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'script', 'style'].includes(node.tag)
  ? '' : norm(node.children.map(child => typeof child === 'string' ? decodeHTML(child) : bodyText(child)).join(' '))
const authoredText = node => ['script', 'style'].includes(node.tag) ? ''
  : norm((node.raw || '') + node.children.map(child => typeof child === 'string' ? decodeHTML(child) : authoredText(child)).join(' '))
const bankUrl = value => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'www.airtelpayments.bank.in'
      && !url.port && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/'
  } catch { return false }
}
const employerUrl = value => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ['www.linkedin.com', 'in.linkedin.com'].includes(url.hostname)
      && !url.port && !url.username && !url.password && !url.search && !url.hash
      && ['/company/airtelpaymentsbank', '/company/airtelpaymentsbank/'].includes(url.pathname)
  } catch { return false }
}
const corporateHandoff = html => {
  const document = readVisibleNativeDocument(html, { strict: true })
  return activeHead(html).titles.includes('Airtel Payments Bank: The Safe Second Account for Daily Transactions')
    && document.nodes(node => node.tag === 'a' && employerUrl(node.attrs.href)).length === 1
    && document.nodes(node => node.tag === 'root').some(node => document.text(node).includes('Open a Safe Second Account with Airtel Payments Bank'))
}
const reciprocalEmployer = html => {
  const document = readVisibleNativeDocument(html, { strict: true })
  const link = one(document.nodes(node => node.tag === 'a' && node.attrs['data-tracking-control-name'] === 'about_website'), 'reciprocal employer website')
  let target
  try {
    const url = new URL(link.attrs.href)
    if (url.protocol !== 'https:' || url.hostname !== 'www.linkedin.com' || url.pathname !== '/redir/redirect'
      || url.searchParams.getAll('url').length !== 1) return fail('reciprocal employer website identity changed')
    target = url.searchParams.get('url')
  } catch { return fail('reciprocal employer website identity changed') }
  if (!bankUrl(target)) fail('reciprocal employer website identity changed')
}
const activeApplication = (document, raw, button, roleUrl) => {
  const parents = new Map()
  const index = node => {
    for (const child of node.children.filter(value => typeof value !== 'string')) { parents.set(child, node); index(child) }
  }
  document.nodes(node => node.tag === 'root').forEach(index)
  const enabled = node => {
    for (let ancestor = node; ancestor; ancestor = parents.get(ancestor)) {
      if ((ancestor === node || ancestor.tag === 'fieldset') && Object.hasOwn(ancestor.attrs, 'disabled')) return false
      if (Object.hasOwn(ancestor.attrs, 'aria-disabled') && norm(ancestor.attrs['aria-disabled']).toLowerCase() !== 'false') return false
    }
    return true
  }
  if (!enabled(button)) fail('application control disabled or unverified')
  const modalId = button.attrs['data-modal']
  const tracking = modalId ? 'public_jobs_apply-link-offsite_contextual-sign-in-modal_join-link' : 'public_jobs_nav-header-signin'
  const selected = node => node.tag === 'a' && node.attrs['data-tracking-control-name'] === tracking
  const rawRoot = one(raw.nodes(node => node.tag === 'root'), 'native application document')
  const rawScope = modalId ? one(children(rawRoot, node => node.tag === 'div' && node.attrs.id === modalId), 'native application modal') : rawRoot
  const activeScope = modalId ? one(document.nodes(node => node.tag === 'div' && node.attrs.id === modalId), 'active application modal') : null
  const rawLinks = children(rawScope, selected)
  const activeLinks = activeScope ? children(activeScope, node => !node.inert && selected(node)) : document.nodes(selected)
  if (!rawLinks.length || activeLinks.length !== rawLinks.length || activeLinks.some(node => !enabled(node))) fail('selected active application handoff unavailable or disabled')
  for (const node of activeLinks) {
    let handoff, target
    try { handoff = new URL(node.attrs.href); target = new URL(handoff.searchParams.get('session_redirect')) }
    catch { fail('active application handoff URL identity changed') }
    const trusted = url => url.protocol === 'https:' && ['www.linkedin.com', 'in.linkedin.com'].includes(url.hostname)
      && !url.port && !url.username && !url.password && !url.hash
    if (!trusted(handoff) || !trusted(target) || !['/login', '/signup/cold-join'].includes(handoff.pathname)
      || handoff.searchParams.getAll('session_redirect').length !== 1 || target.pathname !== new URL(roleUrl).pathname) fail('active application handoff role identity changed')
  }
}
const roleSnapshotUrl = (value, id) => {
  let url
  try { url = new URL(value) } catch { fail('role URL identity changed') }
  const authority = String(value).match(/^https:\/\/([^/?#]+)/i)?.[1]
  if (url.protocol !== 'https:' || !['www.linkedin.com', 'in.linkedin.com'].includes(url.hostname)
    || authority?.toLowerCase() !== url.hostname || url.port || url.username || url.password || url.hash
    || !/^\/jobs\/view\/[^/]+-\d+$/.test(url.pathname) || !/^\d+$/.test(id || '') || !url.pathname.endsWith('-' + id)) fail('trusted role URL identity changed')
  const allowedQuery = new Set(['position', 'pageNum', 'refId', 'trackingId', 'trk'])
  if ([...url.searchParams.keys()].some(key => !allowedQuery.has(key) || url.searchParams.getAll(key).length !== 1)) fail('role URL query identity changed')
  // Both native LinkedIn hosts are supported. Tracking values may refresh;
  // protocol/authority/query are checked before comparing the role identity.
  return 'https://www.linkedin.com' + url.pathname
}
const boardSnapshot = html => {
  const document = readVisibleNativeDocument(html, { strict: true })
  const count = document.text(one(document.nodes(node => classes(node, 'results-context-header__job-count')), 'inventory count'))
  const query = document.text(one(document.nodes(node => classes(node, 'results-context-header__query-search')), 'inventory query'))
  if (!/^\d+$/.test(count) || Number(count) > 100 || query.toLowerCase() !== 'airtel payments bank jobs in worldwide') fail('inventory count or employer identity changed')
  if (Number(count) === 0) { const error = new Error('Empty employer native board is not a whole-company zero'); error.code = 'AIRTEL_EMPTY_PUBLIC_BOARD'; throw error }
  if (!document.nodes(node => node.tag === 'root').some(node => document.text(node).includes("You've viewed all jobs for this search"))) fail('inventory terminal missing')
  const list = one(document.nodes(node => node.tag === 'ul' && classes(node, 'jobs-search__results-list')), 'inventory container')
  const cards = children(list, node => !node.inert && classes(node, 'job-search-card'))
  if (cards.length !== Number(count)) fail('incomplete active inventory cards')
  const rows = cards.map(card => {
    const id = card.attrs['data-entity-urn']?.match(/^urn:li:jobPosting:(\d+)$/)?.[1]
    const title = document.text(one(children(card, node => !node.inert && node.tag === 'h3' && classes(node, 'base-search-card__title')), 'card title'))
    const location = document.text(one(children(card, node => !node.inert && classes(node, 'job-search-card__location')), 'card geography'))
    const link = one(children(card, node => !node.inert && node.tag === 'a' && classes(node, 'base-card__full-link')), 'card link')
    if (!id || !title || !location) fail('card identity changed')
    return { id, title, location, url: roleSnapshotUrl(link.attrs.href, id) }
  })
  if (new Set(rows.map(row => row.id)).size !== Number(count)) fail('duplicate native inventory')
  return rows.sort((left, right) => left.id.localeCompare(right.id))
}
const activeRole = (html, roleUrl) => {
  const document = readVisibleNativeDocument(html, { strict: true })
  const raw = readNativeDocument(html)
  const title = document.text(one(document.nodes(node => node.tag === 'h1' && classes(node, 'top-card-layout__title')), 'active role title'))
  const employer = document.text(one(document.nodes(node => node.tag === 'a' && classes(node, 'topcard__org-name-link')), 'active role employer'))
  const location = document.text(one(document.nodes(node => node.tag === 'span' && classes(node, 'topcard__flavor') && classes(node, 'topcard__flavor--bullet')), 'active role geography'))
  const application = one(document.nodes(node => node.tag === 'button' && node.attrs.id === 'topbar-apply'), 'active application')
  if (!title || !location || employer !== COMPANY || document.text(application) !== 'Apply') fail('active role identity or application changed')
  activeApplication(document, raw, application, roleUrl)
  const description = one(document.nodes(node => node.tag === 'div' && classes(node, 'show-more-less-html__markup')), 'full visible description')
  const text = document.text(description)
  // The shared reader retains the original native HTML. Reject any authored
  // text hidden by the current document rather than using it as completeness.
  const rawDescription = one(raw.nodes(node => node.tag === 'div' && classes(node, 'show-more-less-html__markup')), 'full native description')
  if (!bodyText(description) || norm(decodeHTML(authoredText(rawDescription))) !== norm(decodeHTML(text))) fail('full visible authored criteria incomplete or hidden')
  return { nativeTitle: title, nativeEmployer: employer, nativeLocation: location,
    fullCriteriaObserved: true, visibleDescription: text }
}

export async function runAirtelPaymentsBankNative({ fetchImpl = fetch, signal, now = () => new Date().toISOString(), maxJobs } = {}) {
  signal?.throwIfAborted()
  const verifiedAt = now()
  const audit = { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: 0, observedVacancyCount: 0,
    sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null, lifecycleCleanupAllowed: false,
    sourceListingComplete: false, boardUrl: null, closingStable: false, pagesFetched: 0, observations: [] }
  let openingRows = null
  const read = async (input, options = {}) => {
    signal?.throwIfAborted()
    const headers = new Headers(options.headers)
    headers.set('User-Agent', USER_AGENT)
    const response = await fetchImpl(input, { ...options, headers })
    signal?.throwIfAborted(); options.signal?.throwIfAborted()
    if (!response.url) fail('response URL identity missing')
    if (!response.ok) return response
    const requested = new URL(input)
    const html = await response.clone().text()
    signal?.throwIfAborted(); options.signal?.throwIfAborted()
    audit.pagesFetched++
    if (requested.pathname === '/company/airtelpaymentsbank') reciprocalEmployer(html)
    if (requested.pathname === LISTING_PATH) {
      const rows = boardSnapshot(html)
      if (openingRows && JSON.stringify(rows) !== JSON.stringify(openingRows)) fail('closing inventory identity or geography changed')
      if (!openingRows) { openingRows = rows; audit.boardUrl = String(input); audit.observedRecordCount = audit.observedVacancyCount = rows.length }
      else audit.closingStable = true
    }
    if (requested.pathname.startsWith('/jobs/view/')) {
      const criteria = activeRole(html, requested)
      audit.observations.push({ id: requested.pathname.match(/-(\d+)$/)?.[1], sourceUrl: response.url, ...criteria })
    }
    return response
  }
  const evidence = (jobs, complete, reason) => {
    attachSourceObservationEvidence(jobs, audit)
    Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: audit, configurable: true })
    return attachInventoryEvidence(jobs, { status: complete ? 'complete-inventory' : 'coverage-gap', surface: audit.boardUrl || EMPLOYER,
      firstParty: true, listingComplete: complete, lifecycleCleanupAllowed: false, pagesFetched: audit.pagesFetched,
      reportedTotal: complete ? audit.observedVacancyCount : null, indiaFacetCount: null, verifiedAt, reason })
  }
  try {
    const jobs = await runVerifiedEmployerLinkedIn({ source: SOURCE, companyName: COMPANY, companyTenant: SOURCE,
      companyId: '13361480', officialUrl: OFFICIAL, companyJobsUrl: EMPLOYER, listingPath: LISTING_PATH,
      validateOfficialHandoff: ({ home }) => corporateHandoff(home),
    }, { signal, fetchImpl: read, now: () => verifiedAt, maxJobs })
    const deadline = AbortSignal.timeout(15000)
    const closingSignal = signal ? AbortSignal.any([signal, deadline]) : deadline
    const closing = await read(audit.boardUrl, { signal: closingSignal, redirect: 'follow', headers: { Accept: 'text/html' } })
    await closing.text()
    closingSignal.throwIfAborted()
    if (!closing.ok || closing.url !== audit.boardUrl || !audit.closingStable) fail('closing native inventory unavailable')
    audit.sourceListingComplete = true
    return evidence(jobs.map(job => ({ ...job, sourceDescription: job.jobDescription,
      sourceScopeComplete: false, lifecycleCleanupAllowed: false })), true,
    'complete-current-corporate-declared-employer-feed;whole-company-scope-unverified;cleanup-forbidden')
  } catch (error) {
    signal?.throwIfAborted()
    if (error.code !== 'AIRTEL_EMPTY_PUBLIC_BOARD') throw error
    return evidence([], false, 'empty-employer-feed;whole-company-inventory-unverified;cleanup-forbidden')
  }
}
