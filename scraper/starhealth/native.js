import {nativeDate,nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'

export const CAREERS_URL = 'https://www.starhealth.in/careers/'
export const EMPLOYER_URL = 'https://www.linkedin.com/company/star-health-and-allied-insurance-co--ltd/'
export const LISTING_URL = 'https://www.linkedin.com/jobs/search/?f_C=521366&location=India'
const check = (ok, reason) => { if (!ok) throw new Error(reason) }
const activeDocument = html => {
  const doc = document(html)
  const prune = (node, inherited = false) => {
    node.inactive ||= inherited || /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test((node.attrs?.style || '').replace(/\/\*[\s\S]*?\*\//g,''))
    for (const child of node.children.filter(value => typeof value !== 'string')) prune(child, node.inactive)
  }
  prune(doc.root)
  return doc
}
const companyMatches = value => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ['www.linkedin.com', 'in.linkedin.com'].includes(url.hostname)
      && url.pathname.replace(/\/$/, '') === '/company/star-health-and-allied-insurance-co--ltd'
  } catch { return false }
}
const roleKey = value => {
  const url = new URL(value)
  check(url.protocol === 'https:' && ['www.linkedin.com', 'in.linkedin.com'].includes(url.hostname)
    && /^\/jobs\/view\/[^/]+-\d+$/.test(url.pathname), 'Native role URL changed')
  return url.pathname
}

export const collectStarHealthNative = async ({ read, now }) => {
  const clock=()=>new Date(typeof now==='function'?now():now).toISOString()
  let corporate=null
  try {corporate=activeDocument(await read(CAREERS_URL))} catch(error){if(error.status!==403)throw error}
  if(corporate)check(corporate.text(corporate.root).includes('Star Health and Allied Insurance Co Ltd') && corporate.text(corporate.root).includes('Explore job opportunities'), 'Official careers identity changed')
  const firstParty=Boolean(corporate?.nodes(n=>n.tag==='a'&&companyMatches(n.attrs.href)).length)
  const employer = activeDocument(await read(EMPLOYER_URL))
  check(employer.nodes(node => node.tag === 'h1' && employer.text(node) === 'Star Health and Allied Insurance Co. Ltd').length === 1
    && employer.nodes(node => node.attrs['data-semaphore-content-urn'] === 'urn:li:organization:521366').length === 1,
  'Native Star Health employer identity changed')
  check(employer.text(employer.root).includes('No 1 , New Tank Street') && employer.text(employer.root).includes('Chennai, 600034, IN'), 'Native employer registered address changed')
  check(employer.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='about_website').some(n=>{
    try {const u=new URL(n.attrs.href),target=new URL(u.searchParams.get('url'));return u.origin==='https://www.linkedin.com'&&u.pathname==='/redir/redirect'&&target.href==='http://starhl.in/9Lukp7'}catch{return false}
  }),'Exact native employer website changed')
  const listing = activeDocument(await read(LISTING_URL))
  check(listing.nodes(node => node.tag === 'input' && node.attrs.name === 'f_C' && node.attrs.value === '521366'
    && Object.hasOwn(node.attrs, 'checked')).length === 1, 'Native exact employer filter changed')
  const cards = listing.nodes(node => listing.hasClass(node, 'job-search-card'))
  const headings = listing.nodes(node => node.tag === 'h1')
  const total = headings.length === 1 ? Number(listing.text(headings[0]).match(/^(\d+) Jobs in India$/)?.[1]) : NaN
  check(cards.length > 0 && cards.length <= 100 && Number.isSafeInteger(total) && total >= cards.length,
    'Native bounded listing or reported count changed')
  const facts = [], ids = new Set()
  for (const card of cards) {
    const within = predicate => listing.nodes(predicate, card)
    const field = name => listing.text(within(node => listing.hasClass(node, name))[0]) || null
    const id = card.attrs['data-entity-urn']?.match(/^urn:li:jobPosting:(\d+)$/)?.[1]
    const subtitle = within(node => listing.hasClass(node, 'base-search-card__subtitle'))[0]
    check(id && !ids.has(id) && listing.text(subtitle) === 'Star Health and Allied Insurance Co. Ltd'
      && listing.nodes(node => node.tag === 'a' && companyMatches(node.attrs.href), subtitle).length === 1,
    'Native listing exact employer or unique role identity changed')
    ids.add(id)
    const rawUrl = within(node => node.tag === 'a' && listing.hasClass(node, 'base-card__full-link'))[0]?.attrs.href
    const path = roleKey(rawUrl)
    check(path.endsWith(`-${id}`), 'Native role ID differs from its URL')
    const postingDate = within(node => node.tag === 'time')[0]?.attrs.datetime || null
    const date=nativeDate(postingDate,{required:true})
    check(Date.parse(date.iso)<=Date.parse(clock()), 'Native listing public date invalid or future')
    const title = field('base-search-card__title'), location = field('job-search-card__location')
    check(title && location, 'Native listing title or location missing')
    facts.push({ id, path, rawUrl, title, location, postingDate })
  }
  const jobs = []
  let stopReason = 'bounded-native-observation', visited = 0
  for (const fact of facts.slice(0, 20)) {
    let body
    const requestUrl = new URL(fact.rawUrl)
    requestUrl.hostname = 'www.linkedin.com'
    try { body = await read(requestUrl.href) } catch (error) {
      if ([403, 429].includes(error.status)) { stopReason = `native-details-HTTP${error.status}`; break }
      if ([404, 410].includes(error.status)) continue
      throw error
    }
    visited++
    const detail = activeDocument(body)
    check(!detail.nodes(n=>n.tag==='meta'&&/^(?:datePosted|validThrough|closingDate|expiryDate)$/i.test(n.attrs.itemprop||n.attrs.name||n.attrs.property||'')).length,'New native publication or expiry metadata requires reconciliation')
    const containsPosting = value => Array.isArray(value) ? value.some(containsPosting)
      : value && typeof value === 'object' && ([value['@type']].flat().includes('JobPosting')
        || Object.values(value).some(containsPosting))
    for (const node of detail.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')) {
      let value
      try { value = JSON.parse(node.raw) } catch { throw new Error('Native structured data changed or malformed') }
      check(!containsPosting(value), 'New native JobPosting geography, dates and expiry require reconciliation')
    }
    check(detail.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical' && roleKey(node.attrs.href) === fact.path).length === 1,
      'Native detail canonical role changed')
    check(detail.nodes(node => node.tag === 'h1' && detail.text(node) === fact.title).length === 1
      && detail.nodes(node => node.tag === 'a' && detail.hasClass(node, 'topcard__org-name-link')
        && companyMatches(node.attrs.href) && detail.text(node) === 'Star Health and Allied Insurance Co. Ltd').length === 1,
    'Native visible title or employer changed')
    check(detail.nodes(node => node.tag === 'span' && detail.hasClass(node, 'topcard__flavor--bullet')
      && detail.text(node) === fact.location).length === 1, 'Native detail and listing geography differ')
    if (/No longer accepting applications/i.test(detail.text(detail.root))) continue
    const parts = fact.location.split(',').map(value => value.trim())
    if (nativeCountryName(parts.at(-1)) !== 'India') continue
    if (/This job is provided by|provided by apna\.co/i.test(detail.text(detail.root))) continue
    const apply = detail.nodes(node => node.tag === 'button' && detail.text(node) === 'Apply'
      && (['job-details-subnav-apply-modal', 'job-details-topcard-apply-modal'].includes(node.attrs['data-modal'])
        ||node.attrs['data-tracking-control-name']==='public_jobs_apply-link-simple_onsite')
      && !Object.hasOwn(node.attrs, 'disabled') && node.attrs['aria-disabled'] !== 'true')
    check(apply.length > 0 && detail.nodes(node => node.tag === 'a'
      && node.attrs['data-tracking-control-name'] === 'public_jobs_nav-header-signin').some(node => {
      try {
        const target = new URL(node.attrs.href)
        return target.origin === 'https://www.linkedin.com' && target.pathname === '/login'
          && roleKey(target.searchParams.get('session_redirect')) === fact.path
      } catch { return false }
    }), 'Native enabled Apply or same-role sign-in route missing')
    const markup = detail.nodes(node => detail.hasClass(node, 'show-more-less-html__markup'))
    const prose = node => node.inactive || ['strong', 'b', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tag) ? ''
      : node.children.map(child => typeof child === 'string' ? child : prose(child)).join(' ').replace(/\s+/g, ' ').trim()
    const description = markup.length === 1 && prose(markup[0]).length >= 40
      && prose(markup[0]).split(/\s+/).length >= 6 ? detail.text(markup[0]) : null
    const employment = detail.nodes(node => detail.hasClass(node, 'description__job-criteria-item'))
      .find(node => /^Employment type\s/.test(detail.text(node)))
    const sourceUrl = `https://in.linkedin.com${fact.path}`
    jobs.push({ firstParty, nativeEmployerOrganizationId:'521366', source: 'starhealth', company: 'Star Health', title: fact.title, jobId: fact.id, requisitionId: fact.id,
      location: fact.location, country: 'India', city: parts.length >= 3 ? parts[0] : null,
      region: parts.length >= 3 ? parts[1] : null, postingDate: fact.postingDate,
      nativeListingPublicationDate: fact.postingDate, nativeDetailPublicationDate: null, closingDate: null,
      employmentType: employment ? detail.text(employment).replace(/^Employment type\s+/, '') : null,
      sourceUrl, applyUrl: sourceUrl, link: sourceUrl, activeApplyVerified: true,
      jobDescription: description, sourceDescription: description, sourceDetailComplete: Boolean(description),
      sourceDetailStatus: description ? 'complete' : 'partial',
      sourceDetailFailureKind: description ? null : 'missing-content', sourceListingComplete: false,
      sourceScopeComplete: false, lifecycleCleanupAllowed: false, scrapedAt: clock() })
  }
  check(jobs.length > 0, 'No active exact employer explicit-country detail validated; inventory remains unknown')
  return { jobs, firstParty, facts:{nativeRecordCount:cards.length,visitedDetailCount:visited}, reason: `${stopReason}; observed ${cards.length} of reported ${total} India-filtered cards, visited ${visited} details. Only active exact-employer explicit-India details emitted. Unvisited cards and country-ambiguous metro roles excluded. Employer-authored native jobs independently corroborate official employer name and registered address. Corporate outgoing handoff is unproven unless actively linked; firstParty reflects that. Worldwide inventory, secondary scope, precise detail publication and expiry remain unknown.` }
}
