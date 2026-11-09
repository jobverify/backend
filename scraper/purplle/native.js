import {nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import {isNativeBareCityInPublicScope} from '../../scraper-support/shared/nativeCityScope.js'
import {getValidIndiaCityForJob} from '../../src/utils/publicJobLocationScope.js'

export const CAREERS_URL='https://www.purplle.com/careers'
export const EMPLOYER_URL = 'https://www.linkedin.com/company/purplle-com/'
export const LISTING_URL = 'https://www.linkedin.com/jobs/search/?f_C=2706205&location=India'
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
const allNodes=node=>[node,...node.children.filter(n=>typeof n!=='string').flatMap(allNodes)]
const reviewNativeFields=doc=>{
 const nodes=allNodes(doc.root)
 for(const n of nodes)check(!Object.keys(n.attrs||{}).some(k=>/^data-.*(?:country|job-location|expiry|expiration|date-posted|date-published)/i.test(k))&&!(n.tag==='meta'&&/(?:country|joblocation|dateposted|datepublished|published_time|validThrough|closingDate|expiryDate)/i.test(n.attrs.name||n.attrs.property||'')),'New native country/date/expiry carrier requires reconciliation')
 const containsPosting=v=>v&&typeof v==='object'&&([v['@type']].flat().includes('JobPosting')||Object.values(v).some(containsPosting))
 for(const n of nodes.filter(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'))check(!containsPosting(JSON.parse(n.raw)),'New native JobPosting requires country, date, expiry and application reconciliation')
 check(!nodes.some(n=>/JobPosting/i.test(n.attrs?.itemtype||'')||/(?:^|\s)(?:addressCountry|jobLocation|hiringOrganization|datePosted|datePublished|dateModified|validThrough|closingDate|expiryDate)(?:\s|$)/i.test(n.attrs?.itemprop||'')||n.tag==='meta'&&/^(?:addressCountry|jobLocation|datePosted|datePublished|dateModified|validThrough|closingDate|expiryDate)$/i.test(n.attrs.name||n.attrs.property||'')),'New native country, publication or expiry metadata requires reconciliation')
 return doc
}
const companyMatches = value => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ['www.linkedin.com', 'in.linkedin.com'].includes(url.hostname)
      && url.pathname.replace(/\/$/, '') === '/company/purplle-com'
  } catch { return false }
}
const roleKey = value => {
  const url = new URL(value)
  check(url.protocol === 'https:' && ['www.linkedin.com', 'in.linkedin.com'].includes(url.hostname)
    && /^\/jobs\/view\/[^/]+-\d+$/.test(url.pathname), 'Native role URL changed')
  return url.pathname
}

export const collectPurplleNative = async ({ read, now }) => {
  const clock=()=>new Date(typeof now==='function'?now():now).toISOString()
  const corporate=reviewNativeFields(activeDocument(await read(CAREERS_URL))),links=corporate.nodes(n=>n.tag==='a')
  check(links.some(n=>{try{const u=new URL(n.attrs.href);return u.protocol==='https:'&&u.hostname==='www.linkedin.com'&&u.pathname.replace(/\/$/,'')==='/company/2706205'}catch{return false}})&&links.some(n=>n.attrs.href==='mailto:career@purplle.com'),'Purplle active careers contact or exact employer handoff changed')
  check(!corporate.nodes(n=>corporate.hasClass(n,'panel-title')).length,'Purplle now exposes active role panels; country, description and apply review required')
  const employer = reviewNativeFields(activeDocument(await read(EMPLOYER_URL)))
  check(employer.nodes(node => node.tag === 'h1' && employer.text(node) === 'Purplle.com').length === 1
    && employer.nodes(node => node.attrs['data-semaphore-content-urn'] === 'urn:li:organization:2706205').length === 1,
  'Native Purplle employer identity changed')
  check(employer.nodes(node => node.tag === 'a' && node.attrs['data-tracking-control-name'] === 'about_website').some(node => {
    try {
      const redirect = new URL(node.attrs.href), target = new URL(redirect.searchParams.get('url'))
      return redirect.origin === 'https://www.linkedin.com' && redirect.pathname === '/redir/redirect'
        && ['http:', 'https:'].includes(target.protocol) && !target.username && !target.password
        && target.hostname === 'www.purplle.com'
    } catch { return false }
  }), 'Native employer reciprocal website changed')
  const listing = reviewNativeFields(activeDocument(await read(LISTING_URL)))
  check(listing.nodes(node => node.tag === 'input' && node.attrs.name === 'f_C' && node.attrs.value === '2706205'
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
    check(id && !ids.has(id) && listing.text(subtitle) === 'Purplle.com'
      && listing.nodes(node => node.tag === 'a' && companyMatches(node.attrs.href), subtitle).length === 1,
    'Native listing exact employer or unique role identity changed')
    ids.add(id)
    const rawUrl = within(node => node.tag === 'a' && listing.hasClass(node, 'base-card__full-link'))[0]?.attrs.href
    const path = roleKey(rawUrl)
    check(path.endsWith(`-${id}`), 'Native role ID differs from its URL')
    const postingDate = within(node => node.tag === 'time')[0]?.attrs.datetime || null
    const date=nativeDate(postingDate)
    check(!date.iso||Date.parse(date.iso)<=Date.parse(clock()), 'Native listing public date invalid or future')
    const title = field('base-search-card__title'), location = field('job-search-card__location')
    check(title && location, 'Native listing title or location missing')
    facts.push({ id, path, rawUrl, title, location, postingDate })
  }
  const jobs = []
  let stopReason = 'bounded-detail-limit', visited = 0
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
    const detail = reviewNativeFields(activeDocument(body))
    const primary=detail.nodes(n=>detail.hasClass(n,'top-card-layout__entity-info'))
    check(primary.length===1&&!allNodes(primary[0]).some(n=>n.tag==='time'),'New primary role public time requires earliest publication and expiry reconciliation')
    check(detail.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical' && roleKey(node.attrs.href) === fact.path).length === 1,
      'Native detail canonical role changed')
    check(detail.nodes(node => node.tag === 'h1' && detail.text(node) === fact.title).length === 1
      && detail.nodes(node => node.tag === 'a' && detail.hasClass(node, 'topcard__org-name-link')
        && companyMatches(node.attrs.href) && detail.text(node) === 'Purplle.com').length === 1,
    'Native visible title or employer changed')
    check(detail.nodes(node => node.tag === 'span' && detail.hasClass(node, 'topcard__flavor--bullet')
      && detail.text(node) === fact.location).length === 1, 'Native detail and listing geography differ')
    if (/No longer accepting applications/i.test(detail.text(detail.root))) continue
    const parts = fact.location.split(',').map(value => value.trim())
    const explicitIndia=parts.at(-1)==='India'
    const cityOnlyScope=!explicitIndia&&isNativeBareCityInPublicScope(fact.location,{extraLabels:['mumbai metropolitan region']})
    if(!explicitIndia&&!cityOnlyScope)continue
    const apply = detail.nodes(node => node.tag === 'button' && detail.text(node) === 'Apply'
      && ['job-details-subnav-apply-modal', 'job-details-topcard-apply-modal'].includes(node.attrs['data-modal'])
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
    jobs.push({ source: 'purplle', company: 'Purplle', title: fact.title, jobId: fact.id, requisitionId: fact.id,
      location: fact.location, country: explicitIndia?'India':null, city: cityOnlyScope?getValidIndiaCityForJob({country:null,location:fact.location}):parts.length>=3?parts[0]:null,
      region: parts.length >= 3 ? parts[1] : null, postingDate: fact.postingDate,
      nativeListingPublicationDate: fact.postingDate, nativeDetailPublicationDate: null, closingDate: null,
      employmentType: employment ? detail.text(employment).replace(/^Employment type\s+/, '') : null,
      sourceUrl, applyUrl: sourceUrl, link: sourceUrl, activeApplyVerified: true,
      jobDescription: description, sourceDescription: description, sourceDetailComplete: Boolean(description),
      sourceDetailFailureKind: description ? null : 'missing-content', sourceListingComplete: false,
      sourceScopeComplete: false, lifecycleCleanupAllowed: false, scrapedAt: clock() })
  }
  check(jobs.length > 0, 'No active exact employer public-location detail validated; inventory remains unknown')
  const countryUnknownRecoveredCount=jobs.filter(job=>job.country===null).length
  return { jobs, firstParty:true,inventoryStatus:'coverage-gap',facts:{nativeRecordCount:cards.length,nativeReportedIndiaFilteredCount:total,visitedDetailCount:visited,stopReason,countryUnknownRecoveredCount}, reason: `${stopReason}; observed ${cards.length} of reported ${total} India-filtered cards, visited ${visited} details. Only active exact-employer details satisfying existing public location policy emitted; ${countryUnknownRecoveredCount} retain unknown country. Unvisited cards remain unverified. Worldwide inventory, secondary scope, precise detail publication and expiry remain unknown.` }
}
