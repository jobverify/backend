import { createHash } from 'node:crypto'
import { attachInventoryEvidence, normalizeInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'

export const SOURCE = 'boat'
export const COMPANY = 'boAt Lifestyle'
export const CAREERS_URL = 'https://www.boat-lifestyle.com/pages/boat-careers'
export const EMPLOYER_URL = 'https://www.linkedin.com/company/boat-lifestyle'
export const OFFICIAL_HANDOFF_URL = 'https://www.linkedin.com/company/boat-lifestyle/jobs/'
export const ORGANIZATION_ID = '13356517'
export const LISTING_URL = 'https://www.linkedin.com/jobs/boat-lifestyle-jobs-worldwide?f_C=13356517&pageNum=0'

const check = (condition, message) => { if (!condition) throw Error(message) }
const activeDocument = html => {
  const doc = document(html)
  const prune = (node, inherited = false) => {
    node.inactive ||= inherited || /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test(node.attrs?.style || '')
    for (const child of node.children.filter(value => typeof value !== 'string')) prune(child, node.inactive)
  }
  prune(doc.root)
  return doc
}
const companyUrlMatches = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && ['www.linkedin.com', 'in.linkedin.com'].includes(url.hostname) && url.pathname.replace(/\/$/, '') === '/company/boat-lifestyle' } catch { return false }
}
const enrichDetail = (detail, job, checkedAt) => {
  const schemas = detail.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')
    .flatMap(node => { try { return [JSON.parse(node.raw)] } catch { return [] } })
    .filter(value => value['@type'] === 'JobPosting')
  check(schemas.length === 1, 'Native JobPosting schema absent or ambiguous')
  const schema = schemas[0]
  check(detail.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical' && node.attrs.href === job.sourceUrl).length === 1,
    'Native detail canonical role identity changed')
  check(schema.hiringOrganization?.name === COMPANY && companyUrlMatches(schema.hiringOrganization.sameAs), 'Detail employer changed')
  check(String(schema.title).trim() === job.title && detail.nodes(node => node.tag === 'h1' && detail.text(node) === job.title).length === 1,
    'Native detail title changed')
  const locations = Array.isArray(schema.jobLocation) ? schema.jobLocation : [schema.jobLocation]
  check(locations.length > 0 && locations.every(value => ['IN', 'India'].includes(value?.address?.addressCountry)), 'Native primary or secondary geography unresolved')
  const listingParts = job.location.split(',').map(value => value.trim())
  check(listingParts.length === 3 && listingParts[2] === 'India'
    && locations.every(value => value.address.addressLocality === listingParts[0]
      && (!value.address.addressRegion || value.address.addressRegion === listingParts[1])),
  'Native structured locality or region contradicts the employer listing')
  check(detail.nodes(node => node.tag === 'span' && detail.hasClass(node, 'topcard__flavor--bullet')
    && detail.text(node) === job.location).length === 1, 'Native visible geography contradicts employer listing')
  check(detail.nodes(node => node.tag === 'a' && detail.hasClass(node, 'topcard__org-name-link') && companyUrlMatches(node.attrs.href) && detail.text(node) === COMPANY).length === 1,
    'Native visible detail employer changed')
  const date = schema.datePosted || null
  check(date === null || typeof date === 'string' && Number.isFinite(Date.parse(date)), 'Native publication invalid')
  check(!date || Date.parse(date) <= Date.parse(checkedAt), 'Native publication is in the future')
  check(!job.postingDate || Date.parse(job.postingDate) <= Date.parse(checkedAt), 'Native listing publication is in the future')
  check(!schema.validThrough || Number.isFinite(Date.parse(schema.validThrough)), 'Native expiry invalid')
  if (schema.validThrough && Date.parse(schema.validThrough) <= Date.parse(checkedAt)) return null
  if (/No longer accepting applications/i.test(detail.text(detail.root))) return null
  const applyButtons = detail.nodes(node => node.tag === 'button' && detail.text(node) === 'Apply'
    && (['job-details-subnav-apply-modal', 'job-details-topcard-apply-modal'].includes(node.attrs['data-modal'])
      || node.attrs['data-tracking-control-name'] === 'public_jobs_apply-link-onsite' && detail.hasClass(node, 'apply-button'))
    && !Object.hasOwn(node.attrs, 'disabled') && node.attrs['aria-disabled'] !== 'true')
  const signInLinks = detail.nodes(node => node.tag === 'a' && node.attrs['data-tracking-control-name'] === 'public_jobs_nav-header-signin')
  check(applyButtons.length > 0 && signInLinks.some(node => {
    try {
      const target = new URL(node.attrs.href)
      return target.origin === 'https://www.linkedin.com' && target.pathname === '/login'
        && target.searchParams.get('session_redirect') === job.sourceUrl
    } catch { return false }
  }), 'Native active application control or matching role sign-in redirect absent')
  const descriptionNodes = detail.nodes(node => detail.hasClass(node, 'show-more-less-html__markup'))
  const prose = node => node.inactive || ['strong', 'b', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tag) ? ''
    : node.children.map(child => typeof child === 'string' ? child : prose(child)).join(' ').replace(/\s+/g, ' ').trim()
  const description = descriptionNodes.length === 1 && detail.nodes(node => ['p', 'li'].includes(node.tag)
    && prose(node).length >= 40 && prose(node).split(/\s+/).length >= 6, descriptionNodes[0]).length > 0
    ? detail.text(descriptionNodes[0]) : null
  const postingDate = !job.postingDate ? date : !date || Date.parse(job.postingDate) <= Date.parse(date) ? job.postingDate : date
  return { ...job, postingDate, nativeListingPublicationDate: job.postingDate, nativeDetailPublicationDate: date,
    closingDate: schema.validThrough || null, nativeJobLocations: locations,
    employmentType: schema.employmentType === 'FULL_TIME' ? 'Full-time' : schema.employmentType || null,
    jobDescription: description, sourceDescription: description, sourceDetailComplete: Boolean(description),
    sourceDetailFailureKind: description ? null : 'missing-content' }
}

export const run = async ({ fetchImpl = fetch, signal, timeoutMs = 45000, now = () => new Date().toISOString() } = {}) => {
  signal?.throwIfAborted()
  check(Number.isFinite(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 180000, 'Invalid boAt deadline')
  const controller = new AbortController()
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
  const retainedResponses = []
  let firstParty = false, listener, timer
  const gap = (reason, cause) => Object.assign(new Error(`boAt coverage gap: ${reason}`, { cause }), {
    code: 'BOAT_COVERAGE_GAP', retainedResponses,
    sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    inventoryEvidence: normalizeInventoryEvidence({ status: 'coverage-gap', surface: LISTING_URL,
      firstParty, listingComplete: false, pagesFetched: retainedResponses.length, reportedTotal: null,
      indiaFacetCount: null, verifiedAt: now(), reason }),
  })
  const interrupted = new Promise((_, reject) => {
    listener = () => reject(combined.reason)
    combined.addEventListener('abort', listener, { once: true })
    timer = setTimeout(() => controller.abort(Error('boAt aggregate deadline exceeded')), timeoutMs)
  })
  const inspect = async () => {
    const read = async url => {
      combined.throwIfAborted()
      const response = await fetchImpl(url, { signal: combined, redirect: 'manual',
        headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0' } })
      combined.throwIfAborted()
      if (response.status !== 200 || response.url !== url) throw Object.assign(Error('Native HTTP status or final URL changed'), { status: response.status })
      const body = await response.text()
      combined.throwIfAborted()
      check(typeof body === 'string' && body.trim() && Buffer.byteLength(body) <= 5000000, 'Native body absent or oversized')
      retainedResponses.push({ url, finalUrl: response.url, status: response.status, body,
        bodySHA256: createHash('sha256').update(body).digest('hex') })
      return activeDocument(body)
    }
    const official = await read(CAREERS_URL)
    check(official.nodes(node => node.tag === 'a' && node.attrs.href === OFFICIAL_HANDOFF_URL).length > 0,
      'Official careers LinkedIn delegation changed')
    firstParty = true
    const employer = await read(EMPLOYER_URL)
    check(employer.nodes(node => node.tag === 'h1' && employer.text(node) === COMPANY).length === 1
      && employer.nodes(node => node.attrs['data-semaphore-content-urn'] === `urn:li:organization:${ORGANIZATION_ID}`).length === 1,
    'Native employer identity changed')
    check(employer.nodes(node => node.tag === 'a' && node.attrs['data-tracking-control-name'] === 'about_website').some(node => {
      try {
        const redirect = new URL(node.attrs.href), target = new URL(redirect.searchParams.get('url'))
        return redirect.origin === 'https://www.linkedin.com' && redirect.pathname === '/redir/redirect'
          && ['http:', 'https:'].includes(target.protocol) && !target.username && !target.password
          && target.hostname.toLowerCase() === 'www.boat-lifestyle.com'
      } catch { return false }
    }), 'Native employer website identity changed')
    const listing = await read(LISTING_URL)
    check(listing.nodes(node => node.tag === 'input' && node.attrs.name === 'f_C' && node.attrs.value === ORGANIZATION_ID
      && Object.hasOwn(node.attrs, 'checked')).length === 1, 'Native employer search filter changed')
    const cards = listing.nodes(node => listing.hasClass(node, 'job-search-card'))
    check(cards.length > 0 && cards.length <= 100, 'Native search empty or exceeds reviewed page bound')
    const headings = listing.nodes(node => node.tag === 'h1')
    const nativeTotal = headings.length === 1 ? listing.text(headings[0]).match(/^(\d+) Boat Lifestyle Jobs in Worldwide$/)?.[1] : null
    check(nativeTotal && Number(nativeTotal) === cards.length, 'Native total does not reconcile; pagination requires review')
    const jobs = []
    const ids = new Set()
    for (const card of cards) {
      const within = predicate => listing.nodes(predicate, card)
      const field = className => listing.text(within(node => listing.hasClass(node, className))[0]) || null
      const id = card.attrs['data-entity-urn']?.match(/^urn:li:jobPosting:(\d+)$/)?.[1]
      const subtitle = within(node => listing.hasClass(node, 'base-search-card__subtitle'))[0]
      check(id && !ids.has(id) && listing.text(subtitle) === COMPANY, 'Native card employer or identity changed')
      ids.add(id)
      const companyLinks = listing.nodes(node => node.tag === 'a', subtitle)
      check(companyLinks.some(node => {
        try { const url = new URL(node.attrs.href); return ['www.linkedin.com', 'in.linkedin.com'].includes(url.hostname) && url.pathname === '/company/boat-lifestyle' } catch { return false }
      }), 'Native card employer link changed')
      const rawUrl = within(node => node.tag === 'a' && listing.hasClass(node, 'base-card__full-link'))[0]?.attrs.href
      const url = new URL(rawUrl)
      check(url.protocol === 'https:' && ['in.linkedin.com', 'www.linkedin.com'].includes(url.hostname)
        && url.pathname.startsWith('/jobs/view/') && url.pathname.endsWith(`-${id}`), 'Native card URL changed')
      url.search = ''
      const location = field('job-search-card__location')
      const title = field('base-search-card__title')
      check(title && location, 'Native card required fields absent')
      const parts = location.split(',').map(part => part.trim())
      const country = parts.at(-1) === 'India' ? 'India' : null
      const postingDate = within(node => node.tag === 'time')[0]?.attrs.datetime || null
      check(!postingDate || /^\d{4}-\d{2}-\d{2}$/.test(postingDate) && Number.isFinite(Date.parse(postingDate)), 'Native card publication invalid')
      if (country !== 'India') continue
      const job = { source: SOURCE, company: COMPANY, title, jobId: id, requisitionId: id,
        location, country, city: parts.length >= 3 ? parts[0] : null,
        postingDate, closingDate: null, sourceUrl: url.href, applyUrl: url.href, link: url.href,
        jobDescription: null, sourceDescription: null, sourceDetailComplete: false,
        sourceDetailFailureKind: 'detail-unavailable', sourceListingComplete: false,
        sourceScopeComplete: false, lifecycleCleanupAllowed: false, scrapedAt: now() }
      let detail
      try { detail = await read(url.href) } catch (error) {
        combined.throwIfAborted()
        if ([404, 410].includes(error.status)) continue
        jobs.push(job)
        continue
      }
      const enriched = enrichDetail(detail, job, now())
      if (enriched) jobs.push(enriched)
    }
    check(jobs.length > 0, 'No employer-bound explicit India roles; whole-company inventory unknown')
    return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: LISTING_URL, firstParty,
      listingComplete: false, pagesFetched: retainedResponses.length, reportedTotal: null, indiaFacetCount: null,
      verifiedAt: now(), reason: 'Native employer-filtered card inventory; whole-company coverage incomplete; unavailable details remain partial' })
  }
  try { return await Promise.race([inspect(), interrupted]) }
  catch (error) {
    if (signal?.aborted) throw signal.reason
    if (error?.code === 'BOAT_COVERAGE_GAP') throw error
    throw gap('Native recruiting transport or contract unavailable', error)
  } finally {
    clearTimeout(timer)
    combined.removeEventListener('abort', listener)
    controller.abort(Error('boAt inspection ended'))
  }
}

export default run
