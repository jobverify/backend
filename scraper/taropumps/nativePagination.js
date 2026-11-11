import { createHash } from 'node:crypto'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const CAREERS = 'https://www.taropumps.com/careers'
const BOARD = 'https://www.texmo.com/careers/'
const EMPLOYER = 'Texmo Industries'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const clean = value => String(value ?? '').replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim()
const hash = value => createHash('sha256').update(value).digest('hex')
const need = (condition, reason) => {
  if (!condition) throw Object.assign(Error('Taro Pumps current native inventory: ' + reason), {
    softFailure: true, abortRetries: true, failureKind: 'coverage_gap',
  })
}
const only = (nodes, reason) => { need(nodes.length === 1, reason); return nodes[0] }

function employerForm(html) {
  const doc = readNativeDocument(html)
  const form = only(doc.nodes(n => n.tag === 'form' && n.attrs.id === 'jobForm'), 'native inventory form identity changed')
  need(form.attrs.method?.toLowerCase() === 'post' && form.attrs.action === '#JobCard', 'native inventory form action changed')
  const company = only(doc.nodes(n => n.tag === 'select' && n.attrs.name === 'company', form), 'native company selector changed')
  const employer = only(doc.nodes(n => n.tag === 'option' && doc.text(n) === EMPLOYER, company), 'native employer selector changed')
  need(/^\d+$/.test(employer.attrs.value), 'invalid native employer selector identity')
  for (const field of ['location', 'role']) only(doc.nodes(n => n.tag === 'select' && n.attrs.name === field, form), 'native inventory filter changed')
  only(doc.nodes(n => n.tag === 'input' && n.attrs.type === 'hidden' && n.attrs.name === 'pageNumber', form), 'native pagination field changed')
  const scripts = doc.nodes(n => n.tag === 'script' && !n.attrs.src).map(n => n.raw || '')
  need(scripts.some(body => /function\s+PageClick\(pageNo\)/.test(body)
    && body.includes("document.getElementById('pageNumber').value = pageNo;")
    && body.includes("document.getElementById('jobForm').submit();")), 'native pagination submission is not declared')
  const pages = [...new Set(doc.nodes(n => n.tag === 'a' && n.attrs.onclick, form)
    .map(n => /^PageClick\('(\d+)'\);$/.exec(n.attrs.onclick)?.[1]).filter(Boolean).map(Number))].sort((a, b) => a - b)
  need(pages.length > 0 && pages.length <= 20 && pages.every((page, index) => page === index + 1), 'native pagination inventory changed')
  return { doc, form, employer, pages }
}

function cards({ doc, form }) {
  const rows = doc.nodes(n => n.tag === 'a' && doc.hasClass(n, 'careers-item'), form).map(node => {
    const url = new URL(node.attrs.href, BOARD)
    need(url.origin === new URL(BOARD).origin && /^\/career-details\/?$/.test(url.pathname)
      && !url.username && !url.password && !url.port && !url.hash
      && url.searchParams.getAll('id').length === 1 && /^\d+$/.test(url.searchParams.get('id'))
      && url.searchParams.getAll('title').length === 1
      && [...url.searchParams.keys()].every(key => ['id', 'title'].includes(key)), 'native listing role URL changed')
    const values = doc.nodes(n => n.tag === 'p', node).map(n => clean(doc.text(n)))
    need(values.length === 4 && values.every(Boolean) && clean(url.searchParams.get('title')) === values[0], 'native role card identity changed')
    return { id: url.searchParams.get('id'), url: url.href, title: values[0], city: values[1], country: values[2], department: values[3] }
  })
  need(rows.length > 0 && new Set(rows.map(row => row.id)).size === rows.length, 'empty or duplicate native inventory cards')
  return rows
}

function role(html, responseURL, listing, checkedAt) {
  const doc = readNativeDocument(html)
  const title = clean(doc.text(only(doc.nodes(n => n.tag === 'h1'), 'native role title identity changed')))
  need(title === listing.title, 'native role title disagrees with listing')
  const header = only(doc.nodes(n => n.tag === 'div' && doc.hasClass(n, 'career-details-inner')), 'native employer header changed')
  const strong = only(doc.nodes(n => n.tag === 'strong', header), 'native employer identity missing')
  need(clean(doc.text(strong)) === title + ' • ' + EMPLOYER, 'native employer identity changed')
  const paragraph = only(doc.nodes(n => n.tag === 'p', header), 'native role location missing')
  const remainder = clean(doc.text(paragraph)).slice(clean(doc.text(strong)).length).trim()
  need(remainder === listing.city + ', India • ' + listing.department && listing.country === 'India', 'native country/location conflicts with listing')
  const apply = only(doc.nodes(n => n.tag === 'a' && clean(doc.text(n)) === 'Apply now', header), 'native application action missing')
  const applyURL = new URL(apply.attrs.href, responseURL)
  need(applyURL.origin === new URL(BOARD).origin && applyURL.pathname === '/job-application/'
    && applyURL.searchParams.getAll('id').length === 1 && applyURL.searchParams.get('id') === listing.id
    && [...applyURL.searchParams.keys()].every(key => key === 'id') && !applyURL.hash, 'native application identity changed')
  const article = only(doc.nodes(n => n.tag === 'article'), 'native own-role content boundary changed')
  const own = only(doc.nodes(n => n.tag === 'div' && doc.hasClass(n, 'bkg--cream'), article), 'native own-role description boundary changed')
  const contents = doc.nodes(n => n.tag === 'div' && doc.hasClass(n, 'career-details-item--content'), own)
  need(contents.length > 0, 'native own-role description content missing')
  const description = doc.text(own)
  need(description.length >= 160 && hasSourceDescription({ sourceDescription: description })
    && /^Job Description\b/.test(description) && !/About the Hiring Team|Recruiter & Professional Consultant/.test(description), 'native own-role description criteria missing or mixed with recruiter content')
  return {
    title, company: EMPLOYER, source: 'taropumps', jobId: listing.id, requisitionId: listing.id,
    location: listing.city + ', India', city: listing.city, country: 'India', department: listing.department,
    sourceUrl: responseURL, applyUrl: applyURL.href, link: applyURL.href,
    jobDescription: description, sourceDescription: description,
    experienceRequired: null, minimumQualification: null, preferredQualification: null, requiredSkills: [],
    employmentType: null, postingDate: null, closingDate: null, nativeDateUnknown: true,
    originalPublicationDateQualified: false, publicationDateProvenance: null,
    publicExperienceChecked: true, scrapedAt: checkedAt,
    sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    nativeEmployerName: EMPLOYER, sourceDetailComplete: true,
    sourceNativeDetailSha256: hash(html),
    employerBindingEvidence: { officialURL: CAREERS, nativeURL: BOARD,
      employer: EMPLOYER, method: 'current-visible-company-careers-delegation-and-exact-native-role-employer' },
  }
}

function corporateDeclaration(html) {
  const companyDoc = readNativeDocument(html)
  const titles = companyDoc.nodes(n => n.tag === 'title').map(n => clean(n.raw))
  const employerStatements = companyDoc.nodes(n => n.tag === 'p'
    && companyDoc.text(n).includes('Texmo Industries is a space that is engineered for professional growth.')).map(n => companyDoc.text(n))
  need(titles.includes('Careers at Taro Pumps') && employerStatements.length > 0,
    'current official employer identity/delegation missing')
  const handoffs = companyDoc.nodes(n => n.tag === 'a' && clean(companyDoc.text(n)) === 'View all jobs').flatMap(n => {
    try {
      const url = new URL(n.attrs.href, CAREERS)
      return url.origin === new URL(BOARD).origin && url.pathname.replace(/\/$/, '') === '/careers'
        && !url.search && !url.hash && !url.username && !url.password && !url.port
        ? [{ nativeHref: n.attrs.href, url: url.href, text: companyDoc.text(n) }] : []
    } catch { return [] }
  })
  need(handoffs.length > 0, 'current active official careers handoff missing')
  return { titles, employerStatements, handoffs }
}

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const pageSnapshot = model => ({ employerId: model.employer.attrs.value,
  employer: model.doc.text(model.employer), selected: Object.hasOwn(model.employer.attrs, 'selected'),
  pages: model.pages, rows: cards(model) })
const roleSnapshot = job => {
  // Presentation markup and unrelated page assets may change without changing
  // the complete native role facts. Both original response hashes are retained.
  const { sourceNativeDetailSha256, ...facts } = job
  return facts
}

// The current board is a native HTML POST search. Do not infer an India zero
// from its foreign-only first page or rename other group employers as Taro.
export async function runNativeTexmoInventory({ fetchImpl = globalThis.fetch, signal, maxPages = 12,
  maxDetails = 60, now = () => new Date().toISOString() } = {}) {
  signal?.throwIfAborted()
  need(Number.isSafeInteger(maxPages) && maxPages >= 1 && maxPages <= 20
    && Number.isSafeInteger(maxDetails) && maxDetails >= 1 && maxDetails <= 100, 'invalid native acquisition limits')
  const checkedAt = now(), receipts = [], requestBudget = 100
  const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(150000)]) : AbortSignal.timeout(150000)
  const read = async (url, body, closing = false) => {
    deadline.throwIfAborted()
    need(receipts.length < requestBudget, 'native request budget exhausted')
    const response = await fetchImpl(url, { method: body ? 'POST' : 'GET', body,
      signal: AbortSignal.any([deadline, AbortSignal.timeout(20000)]), credentials: 'omit',
      ...(closing ? { cache: 'no-store' } : {}),
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml',
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) } })
    deadline.throwIfAborted()
    if (response.status !== 200) throw Object.assign(Error('Taro Pumps current native public HTTP ' + response.status), {
      status: response.status, softFailure: true, abortRetries: true,
      failureKind: [401, 403, 429, 451].includes(response.status) ? 'blocked_or_access_denied' : 'coverage_gap',
    })
    const requested = new URL(url), final = new URL(response.url)
    need(final.origin === requested.origin && final.pathname.replace(/\/$/, '') === requested.pathname.replace(/\/$/, '')
      && final.search === requested.search && !final.hash && !final.username && !final.password && !final.port, 'native HTTP final identity changed')
    need(/^text\/html\b/i.test(response.headers.get('content-type') || ''), 'native HTTP content type changed')
    need(Number(response.headers.get('content-length') || 0) <= 3000000, 'native response budget exceeded')
    const html = await response.text()
    need(Buffer.byteLength(html) <= 3000000, 'native response budget exceeded')
    receipts.push({ url, method: body ? 'POST' : 'GET', responseURL: response.url, status: response.status, sha256: hash(html) })
    return { html, url: response.url }
  }
  const corporate = await read(CAREERS), declaration = corporateDeclaration(corporate.html)
  const initial = employerForm((await read(BOARD)).html), employerId = initial.employer.attrs.value
  const jobs = [], seen = new Set(), listingRecords = [], selectedPages = []
  let inspectedDetails = 0, publishedPages = 1
  for (let page = 1; page <= Math.min(publishedPages, maxPages); page++) {
    const body = new URLSearchParams({ company: employerId, location: '', role: '', pageNumber: String(page) }).toString()
    const current = employerForm((await read(BOARD, body)).html)
    need(current.employer.attrs.value === employerId && Object.hasOwn(current.employer.attrs, 'selected'), 'native employer filter changed')
    need(page === 1 || current.pages.length === publishedPages, 'native pagination inventory changed')
    publishedPages = current.pages.length
    need(current.pages.includes(page), 'native current pagination identity missing')
    const snapshot = pageSnapshot(current)
    selectedPages.push({ page, body, snapshot })
    for (const listing of snapshot.rows) {
      need(!seen.has(listing.id), 'native pagination repeated a role identity')
      seen.add(listing.id)
      listingRecords.push(listing)
    }
  }
  // Keep room for every selected listing page, every selected complete role,
  // and the branded declaration to be read again. A detail needs two reads.
  const transportDetailAllowance = Math.max(0, Math.floor((requestBudget - receipts.length - selectedPages.length - 1) / 2))
  const indiaRows = listingRecords.filter(listing => listing.country === 'India')
  const selected = indiaRows.slice(0, Math.min(maxDetails, transportDetailAllowance))
  for (const listing of selected) {
    const detail = await read(listing.url)
    jobs.push(role(detail.html, detail.url, listing, checkedAt))
    inspectedDetails++
  }
  need(jobs.length > 0, 'no qualified native India roles; whole-employer inventory remains unknown')
  for (let index = 0; index < selected.length; index++) {
    const listing = selected[index], detail = await read(listing.url, undefined, true)
    const closing = role(detail.html, detail.url, listing, checkedAt)
    need(same(roleSnapshot(jobs[index]), roleSnapshot(closing)), 'closing native full role criteria changed')
    jobs[index].sourceNativeClosingEvidence = { fullRoleCriteriaRechecked: true,
      openingDetailSHA256: jobs[index].sourceNativeDetailSha256, closingDetailSHA256: closing.sourceNativeDetailSha256,
      currentAvailabilityBasis: 'closing-current-selected-employer-listing-and-native-application-action' }
  }
  for (const page of selectedPages) {
    const closing = employerForm((await read(BOARD, page.body, true)).html)
    need(same(pageSnapshot(closing), page.snapshot), 'closing selected native employer listing inventory changed')
  }
  const closingDeclaration = corporateDeclaration((await read(CAREERS, undefined, true)).html)
  need(same(closingDeclaration, declaration), 'closing current corporate employer handoff declaration changed')
  deadline.throwIfAborted()
  const audit = {
    source: 'taropumps', employer: EMPLOYER, checkedAt, receipts,
    totalObserved: listingRecords.length, observedListingCount: listingRecords.length, listingRecords, inspectedDetails,
    publishedPages, selectedPages: selectedPages.map(page => ({ page: page.page, body: page.body, snapshot: page.snapshot })),
    requestBudget, transportDetailAllowance, requestedDetailLimit: maxDetails,
    selectedDetailLimit: selected.length, omittedIndiaDetails: indiaRows.length - selected.length,
    listingPaginationComplete: selectedPages.length === publishedPages,
    closingListingMatches: true, closingCorporateHandoffMatches: true, fullRoleCriteriaRechecked: true,
    corporateDeclaration: declaration, closingCorporateDeclaration: closingDeclaration,
    sourceScopeComplete: false, lifecycleCleanupAllowed: false,
  }
  attachSourceObservationEvidence(jobs, { source: 'taropumps', recordKind: 'vacancy-rows',
    observedRecordCount: listingRecords.length, observedVacancyCount: listingRecords.length,
    sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { configurable: true, value: audit })
  jobs[0].nativeCollectionEvidence = audit
  return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: BOARD, firstParty: true,
    listingComplete: false, lifecycleCleanupAllowed: false, pagesFetched: receipts.length,
    reportedTotal: null, indiaFacetCount: jobs.length, verifiedAt: checkedAt,
    reason: 'Current branded employer delegation, selected Texmo Industries native listing pages and full own-role criteria rechecked unchanged; whole-employer inventory and cleanup remain unqualified.' })
}
