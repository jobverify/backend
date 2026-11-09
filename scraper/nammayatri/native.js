import {nativeDate,nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'

export const HOME_URL = 'https://nammayatri.in/'
export const EMPLOYER_URL = 'https://www.linkedin.com/company/nammayatri/'
export const LISTING_URL = 'https://www.linkedin.com/jobs/search/?f_C=91666279&location=India'
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
      && url.pathname.replace(/\/$/, '') === '/company/nammayatri'
  } catch { return false }
}
const roleKey = value => {
  const url = new URL(value)
  check(url.protocol === 'https:' && ['www.linkedin.com', 'in.linkedin.com'].includes(url.hostname)
    && /^\/jobs\/view\/[^/]+-\d+$/.test(url.pathname), 'Native role URL changed')
  return url.pathname
}

const assertReviewed=(doc,{social=false}={})=>{
 const sensitive=/^(?:datePublished|datePosted|dateModified|validThrough|closingDate|expiryDate|expirationDate|expiresAt|addressCountry|country|jobLocation)$/i
 check(!doc.nodes(n=>Object.hasOwn(n.attrs,'itemprop')||/JobPosting/i.test(n.attrs.itemtype||'')||n.tag==='meta'&&sensitive.test(n.attrs.name||n.attrs.property||'')).length,'New native country, publication, expiry or microdata requires review')
 const visit=(value,corporateAddress=false)=>{
  if(!value||typeof value!=='object')return
  for(const [key,v] of Object.entries(value)){
   check(!(key==='@type'&&[v].flat().includes('JobPosting'))&&(!sensitive.test(key)||social&&value['@type']==='SocialMediaPosting'&&key==='datePublished'||corporateAddress&&key==='addressCountry'&&v==='IN'),'New native JobPosting, country, publication or expiry requires review')
   visit(v,social&&key==='address'&&value['@type']==='Organization'&&value.name==='Namma Yatri'&&companyMatches(value.url))
  }
 }
 for(const script of doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'))visit(JSON.parse(script.raw))
}

export const collectNammaYatriNative = async ({ read, now }) => {
  const clock=()=>new Date(typeof now==='function'?now():now).toISOString()
  const home = activeDocument(await read(HOME_URL))
  check(home.nodes(n=>n.tag==='astro-island'&&n.attrs['component-url']==='/HomeRoute.bs.a335ce8b.js').length===1, 'Official corporate shell changed; client discovery requires review')
  assertReviewed(home)
  const firstParty=false
  const employer = activeDocument(await read(EMPLOYER_URL))
  check(employer.nodes(node => node.tag === 'h1' && employer.text(node) === 'Namma Yatri').length === 1
    && employer.nodes(node => node.attrs['data-semaphore-content-urn'] === 'urn:li:organization:91666279').length === 1,
  'Native Namma Yatri employer identity changed')
  check(employer.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='about_website').some(n=>{
    try {const u=new URL(n.attrs.href);return u.origin==='https://www.linkedin.com'&&u.pathname==='/redir/redirect'&&new URL(u.searchParams.get('url')).href==='https://www.nammayatri.in/'}catch{return false}
  }),'Native reciprocal corporate website changed')
  assertReviewed(employer,{social:true})
  const socialDates = new Map()
  for(const script of employer.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')){
    const graph=JSON.parse(script.raw)
    for(const post of graph['@graph']||[graph]){
      if(post['@type']!=='SocialMediaPosting')continue
      check(post.author?.name==='Namma Yatri'&&companyMatches(post.author?.url), 'Native social author changed')
      const activity=post.url?.match(/activity-(\d+)-/)?.[1]
      check(activity&&post.mainEntityOfPage===post.url, 'Native social identifier changed')
      const cards=employer.nodes(n=>n.tag==='article'&&n.attrs['data-activity-urn']==='urn:li:activity:'+activity)
      check(cards.length===1, 'Social publication has no exact active feed card')
      const date=nativeDate(post.datePublished,{required:true})
      check(Date.parse(date.iso)<=Date.parse(clock()),'Future native social date')
      for(const link of employer.nodes(n=>n.tag==='a'&&/\/jobs\/view\//.test(n.attrs.href||''),cards[0])){
        const path=roleKey(link.attrs.href), previous=socialDates.get(path)
        if(!previous||date.iso<previous.iso)socialDates.set(path,{...date,title:post.headline})
      }
    }
  }
  const listing = activeDocument(await read(LISTING_URL))
  check(listing.nodes(node => node.tag === 'input' && node.attrs.name === 'f_C' && node.attrs.value === '91666279'
    && Object.hasOwn(node.attrs, 'checked')).length === 1, 'Native exact employer filter changed')
  assertReviewed(listing)
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
    check(id && !ids.has(id) && listing.text(subtitle) === 'Namma Yatri'
      && listing.nodes(node => node.tag === 'a' && companyMatches(node.attrs.href), subtitle).length === 1,
    'Native listing exact employer or unique role identity changed')
    ids.add(id)
    const rawUrl = within(node => node.tag === 'a' && listing.hasClass(node, 'base-card__full-link'))[0]?.attrs.href
    const path = roleKey(rawUrl)
    check(path.endsWith(`-${id}`), 'Native role ID differs from its URL')
    const listingDate = within(node => node.tag === 'time')[0]?.attrs.datetime || null
    check(Date.parse(nativeDate(listingDate,{required:true}).iso)<=Date.parse(clock()),'Future native listing public date')
    const social=socialDates.get(path)
    check(!social||social.title===field('base-search-card__title'), 'Social/listing title conflict')
    const postingDate=social&&social.iso<nativeDate(listingDate,{required:true}).iso?social.raw:listingDate
    const date=nativeDate(postingDate,{required:true})
    check(Date.parse(date.iso)<=Date.parse(clock()), 'Native listing public date invalid or future')
    const title = field('base-search-card__title'), location = field('job-search-card__location')
    check(title && location, 'Native listing title or location missing')
    facts.push({ id, path, rawUrl, title, location, postingDate, listingDate, socialPublicationDate:social?.raw??null })
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
    assertReviewed(detail)
    const primary=detail.nodes(n=>detail.hasClass(n,'top-card-layout__entity-info'))
    check(primary.length===1&&detail.nodes(n=>n.tag==='h1'&&detail.text(n)===fact.title,primary[0]).length===1,'Primary native role container changed')
    check(detail.nodes(n=>n.tag==='time',primary[0]).length===0,'New primary role publication time requires earliest-publication review')
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
        && companyMatches(node.attrs.href) && detail.text(node) === 'Namma Yatri').length === 1,
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
    jobs.push({ firstParty, nativeEmployerOrganizationId:'91666279', source: 'nammayatri', company: 'Namma Yatri', title: fact.title, jobId: fact.id, requisitionId: fact.id,
      location: fact.location, country: 'India', city: parts.length >= 3 ? parts[0] : null,
      region: parts.length >= 3 ? parts[1] : null, postingDate: fact.postingDate,
      nativeListingPublicationDate: fact.listingDate, nativeEmployerSocialPublicationDate:fact.socialPublicationDate, nativeDetailPublicationDate: null, closingDate: null,
      employmentType: employment ? detail.text(employment).replace(/^Employment type\s+/, '') : null,
      sourceUrl, applyUrl: sourceUrl, link: sourceUrl, activeApplyVerified: true,
      jobDescription: description, sourceDescription: description, sourceDetailComplete: Boolean(description),
      sourceDetailStatus: description ? 'complete' : 'partial',
      sourceDetailFailureKind: description ? null : 'missing-content', sourceListingComplete: false,
      sourceScopeComplete: false, lifecycleCleanupAllowed: false, scrapedAt: clock() })
  }
  check(jobs.length > 0, 'No active exact employer explicit-country detail validated; inventory remains unknown')
  return { jobs, firstParty, facts:{nativeRecordCount:cards.length,visitedDetailCount:visited}, reason: `${stopReason}; observed ${cards.length} of reported ${total} India-filtered cards, visited ${visited} details. Only active exact-employer explicit-India details emitted. Unvisited cards and country-ambiguous metro roles excluded. Employer-authored native jobs and reciprocal official domain independently corroborate exact employer. Earliest observed same-role employer social date is preserved when earlier than listing date. Corporate outgoing handoff is unproven unless actively linked; firstParty reflects that. Worldwide inventory, secondary scope, precise detail publication and expiry remain unknown.` }
}






