import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const clean = s => typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : ''
const decode = s => String(s ?? '').replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => { const code = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n); return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '' })
  .replace(/&(quot|apos|lt|gt|nbsp|amp);/gi, (_, n) => ({ quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', amp: '&' })[n.toLowerCase()])
const withoutComments = h => String(h ?? '').replace(/<!--[\s\S]*?-->/g, '')
const document = h => withoutComments(h).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
const visible = h => clean(decode(document(decode(h)).replace(/<[^>]*>/g, ' ')))
const attr = (tag, name) => decode(tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, 'is'))?.[2])
const classes = tag => attr(tag, 'class').split(/\s+/)
const hasClass = (tag, name) => classes(tag).includes(name)
const error = message => { throw new Error('Verified LinkedIn ' + message) }
const elementAt = (html, index) => {
  const open = html.slice(index).match(/^<([a-z][\w-]*)\b[^>]*>/i)
  if (!open) return error('malformed HTML inventory')
  const tag = open[1], pattern = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi'); pattern.lastIndex = index
  let depth = 0, end = null
  for (let m; (m = pattern.exec(html));) { depth += /^<\//.test(m[0]) ? -1 : 1; if (depth === 0) { end = m.index; return { tag: open[0], inner: html.slice(index + open[0].length, end), outer: html.slice(index, pattern.lastIndex) } } }
  return error('unterminated HTML inventory')
}
const elements = (html, tag, predicate) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'gi'))].filter(m => predicate(m[0])).map(m => elementAt(html, m.index))
const one = (items, reason) => items.length === 1 ? items[0] : error(reason)
const links = html => elements(document(html), 'a', () => true).map(x => ({ href: attr(x.tag, 'href'), text: visible(x.inner), tag: x.tag }))
const strictUrl = (value, base) => {
  if (!clean(value)) return error('missing URL identity')
  let u; try { u = new URL(value, base) } catch { return error('invalid URL identity') }
  if (u.protocol !== 'https:' || u.username || u.password || u.hash) return error('unsafe URL identity')
  return u
}
const linkedin = u => ['www.linkedin.com', 'in.linkedin.com'].includes(u.hostname) && !u.port
const companyIdentity = (value, config, jobsAllowed = false) => {
  const u = strictUrl(value); const paths = [`/company/${config.companyTenant}`, `/company/${config.companyTenant}/`]
  if (jobsAllowed) paths.push(`/company/${config.companyTenant}/jobs`, `/company/${config.companyTenant}/jobs/`)
  return linkedin(u) && paths.includes(u.pathname)
}
const boardIdentity = (value, config) => {
  const u = strictUrl(value)
  if (!linkedin(u) || u.pathname !== config.listingPath || u.searchParams.getAll('f_C').length !== 1 || u.searchParams.get('f_C') !== config.companyId
    || [...u.searchParams.keys()].some(k => !['f_C', 'trk'].includes(k)) || u.searchParams.getAll('trk').length > 1) return error('employer board query identity changed')
  return u
}
const roleIdentity = (value, id) => {
  const u = strictUrl(value)
  if (!linkedin(u) || !/^\/jobs\/view\/[^/]+-\d+$/.test(u.pathname) || !u.pathname.endsWith('-' + id)
    || [...u.searchParams.keys()].some(k => !['position', 'pageNum', 'refId', 'trackingId', 'trk'].includes(k))) return error('role URL identity changed')
  return u
}
const regions = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
const reserved = new Set(['ZZ', 'XA', 'XB', 'UN', 'EU', 'EZ', 'QO'])
const namedCountries = new Map()
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) { const code = String.fromCharCode(a, b), name = regions.of(code); if (name && !reserved.has(code)) namedCountries.set(name.toLowerCase(), code) }
const employmentTypes = { FULL_TIME: 'Full-time', PART_TIME: 'Part-time', CONTRACTOR: 'Contract', TEMPORARY: 'Temporary', INTERN: 'Internship', VOLUNTEER: 'Volunteer', PER_DIEM: 'Per diem', OTHER: 'Other' }
const employmentType = value => value == null ? null : employmentTypes[value] ?? error('unknown employment type')
const countryCode = raw => {
  if (typeof raw !== 'string' || !/^[A-Z]{2}$/.test(raw) || reserved.has(raw) || !regions.of(raw)) return error('unverified structured country geography')
  return raw
}
const accountApplication = (html, canonical) => {
  const doc = document(html), button = one(elements(doc, 'button', t => attr(t, 'id') === 'topbar-apply'), 'missing application button')
  if (visible(button.inner) !== 'Apply') return error('application button changed')
  const modal = attr(button.tag, 'data-modal'); let candidates
  if (modal) {
    const body = one(elements(doc, 'div', t => attr(t, 'id') === modal), 'application modal identity changed')
    candidates = links(body.inner).filter(x => attr(x.tag, 'data-tracking-control-name') === 'public_jobs_apply-link-offsite_contextual-sign-in-modal_join-link')
  } else {
    if (attr(button.tag, 'data-tracking-control-name') !== 'public_jobs_apply-link-onsite') return error('application mode changed')
    candidates = links(doc).filter(x => attr(x.tag, 'data-tracking-control-name') === 'public_jobs_nav-header-signin')
  }
  if (!candidates.length) return error('missing account application handoff')
  for (const link of candidates) {
    let u, target; try { u = strictUrl(link.href); target = strictUrl(u.searchParams.get('session_redirect')) } catch { return error('application URL identity changed') }
    if (!linkedin(u) || !['/signup/cold-join', '/login'].includes(u.pathname) || u.searchParams.getAll('session_redirect').length !== 1
      || !linkedin(target) || target.pathname !== canonical.pathname) return error('application role identity changed')
  }
}

const config={"source":"hubspot","companyName":"HubSpot","companyTenant":"hubspot","companyId":"68529","listingPath":"/jobs/hubspot-jobs-worldwide","domain":"hubspot.com","canonicalPath":"/jobs/hubspot-jobs","locationControl":"India"}
export const COMPANY_PROFILE_URL="https://www.linkedin.com/company/hubspot/"
export const COMPANY_JOBS_URL="https://www.linkedin.com/jobs/hubspot-jobs-worldwide?f_C=68529&location=India"
const indianRegions=new Set(["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"])
const employerUrl = value => {
 try{const u=strictUrl(value);return companyIdentity(value,config)&&[...u.searchParams.keys()].every(k=>k==='trk')}catch{return false}
}
const verifyProfile = html => {
 const doc=document(html)
 const canonical=one([...doc.matchAll(/<link\b[^>]*>/gi)].filter(m=>attr(m[0],'rel')==='canonical'),'missing company canonical')
 const title=visible(one(elements(doc,'h1',t=>hasClass(t,'top-card-layout__title')),'missing native company title').inner)
 if(!employerUrl(attr(canonical[0],'href'))||title!==config.companyName)return error('company profile identity changed')
 const website=one(links(doc).filter(x=>attr(x.tag,'data-tracking-control-name')==='about_website'),'missing native company domain')
 const redirect=strictUrl(website.href)
 let target;try{target=new URL(redirect.searchParams.get('url'))}catch{return error('invalid native company website')}
 if(!linkedin(redirect)||redirect.pathname!=='/redir/redirect'||redirect.searchParams.getAll('url').length!==1||!['http:','https:'].includes(target.protocol)
  ||![config.domain,'www.'+config.domain].includes(target.hostname)||target.username||target.password||target.port||target.search||target.hash||target.pathname!=='/'||website.text.replace(/\/$/,'')!==target.href.replace(/\/$/,''))return error('native employer domain identity changed')
 const published=links(doc).filter(x=>{try{return new URL(x.href).pathname===config.listingPath}catch{return false}})
 if(!published.length||published.some(x=>!boardIdentity(x.href,config)))return error('native employer company ID handoff changed')
}
const parseSearchCards = html => {
 const doc=document(html)
 const canonical=one([...doc.matchAll(/<link\b[^>]*>/gi)].filter(m=>attr(m[0],'rel')==='canonical'),'missing native board canonical')
 const u=strictUrl(attr(canonical[0],'href'))
 if(!linkedin(u)||u.pathname!==config.canonicalPath||u.search)return error('native search board canonical changed')
 const countText=visible(one(elements(doc,'span',t=>hasClass(t,'results-context-header__job-count')),'missing native displayed count').inner)
 if(!/^\d+$/.test(countText)||Number(countText)<1)return error('empty or unknown displayed count cannot establish authoritative zero')
 const count=Number(countText)
 const query=visible(one(elements(doc,'span',t=>hasClass(t,'results-context-header__query-search')),'missing native search heading').inner)
 if(query.toLowerCase()!==(config.companyName+' Jobs in '+config.locationControl).toLowerCase())return error('native employer/location query changed')
 const companyFilters=[...doc.matchAll(/<input\b[^>]*>/gi)].filter(m=>attr(m[0],'name')==='f_C'&&/\schecked(?:\s|>|=)/.test(m[0]))
 if(companyFilters.length!==1||attr(companyFilters[0][0],'value')!==config.companyId)return error('native company filter drift')
 const locationFilters=[...doc.matchAll(/<input\b[^>]*>/gi)].filter(m=>attr(m[0],'name')==='location')
 if(!locationFilters.length||locationFilters.some(m=>attr(m[0],'value')!==config.locationControl))return error('native location control drift')
 const list=one(elements(doc,'ul',t=>hasClass(t,'jobs-search__results-list')),'missing native results inventory')
 const cards=elements(list.inner,'div',t=>hasClass(t,'base-search-card--link'))
 if(!cards.length||cards.length>100||cards.length>count||count<=100&&cards.length!==count)return error('native displayed count/card inventory mismatch')
 const seen=new Set()
 return cards.map(card=>{
  const id=attr(card.tag,'data-entity-urn').match(/^urn:li:jobPosting:(\d+)$/)?.[1]
  if(!id||!Number.isSafeInteger(Number(id))||String(Number(id))!==id||seen.has(id))return error('duplicate or noncanonical native posting ID')
  seen.add(id)
  const anchor=one(links(card.outer).filter(x=>hasClass(x.tag,'base-card__full-link')),'missing native job card link')
  const source=roleIdentity(anchor.href,id);source.search=''
  const title=visible(one(elements(card.inner,'h3',t=>hasClass(t,'base-search-card__title')),'missing native job card title').inner)
  const employer=one(links(card.inner).filter(x=>attr(x.tag,'data-tracking-control-name')==='public_jobs_jserp-result_job-search-card-subtitle'),'missing native card employer')
  const location=visible(one(elements(card.inner,'span',t=>hasClass(t,'job-search-card__location')),'missing native card geography').inner)
  const date=attr(one(elements(card.inner,'time',()=>true),'missing native card posting date').tag,'datetime')
  if(!title||!location||employer.text!==config.companyName||!employerUrl(employer.href)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date)))return error('native job card identity or posting date changed')
  return{id,title,location,url:source.href,postingDate:date}
 })
}
const verifyIndiaGeography = detail => {
 if(!detail.schema||detail.geography.length!==1||detail.geography[0].country!=='IN')return error('native job does not establish exclusive India workplace')
 const geo=detail.geography[0], parts=detail.location.split(',').map(clean)
 if(!geo.city||(geo.state&&!indianRegions.has(geo.state)))return error('unknown or conflicting native India locality/region')
 if(parts.length===1){if(parts[0]!==geo.city)return error('native India city conflicts with visible area')}
 else if(![2,3].includes(parts.length)||parts[0]!==geo.city||parts.at(-1)!=='India'||parts.length===3&&!indianRegions.has(parts[1])||geo.state&&parts[1]!==geo.state)return error('conflicting native India country tail')
 const jd=visible(detail.description)
 const labeled=jd.match(/(?:Job Location|Work Location|Workplace)\s*:\s*([^.;|]+)(?:[.;|]|$)/i)?.[1]?.trim()
 if(labeled&&![detail.location,detail.location.replace(/,\s*India$/,''),geo.city,'India',geo.city==='Bengaluru'?'Bangalore':geo.city].includes(labeled))return error('conflicting explicit job description workplace')
 return geo
}
export async function runPublicLinkedIn({fetchPage,signal,now=()=>new Date().toISOString(),maxJobs}={}){
 signal?.throwIfAborted()
 if(maxJobs!=null&&(!Number.isInteger(maxJobs)||maxJobs<1))return error('maxJobs must be a positive integer')
 const checkedAt=now(),at=Date.parse(checkedAt)
 if(!Number.isFinite(at))return error('invalid verification date')
 const read=async url=>{
  signal?.throwIfAborted();const response=await fetchPage(url,{signal});signal?.throwIfAborted()
  if(response.status!==200)throw new Error('HTTP '+response.status+' for '+url)
  const expected=strictUrl(url),actual=strictUrl(response.url)
  if(!linkedin(actual)||actual.pathname.replace(/\/$/,'')!==expected.pathname.replace(/\/$/,'')||actual.search!==expected.search)return error('public response authority drift')
  return response.html
 }
 verifyProfile(await read(COMPANY_PROFILE_URL))
 const cards=parseSearchCards(await read(COMPANY_JOBS_URL)), jobs=[]
 for(const card of cards){
  if(jobs.length>=(maxJobs??Infinity))break
  const detail=parseDetail(await read(card.url),card,config,at)
  if(!detail.schema||detail.schema.datePosted.slice(0,10)!==card.postingDate)return error('native posting date conflict')
  const geo=verifyIndiaGeography(detail)
  jobs.push({source:config.source,company:config.companyName,jobId:card.id,requisitionId:null,title:card.title,location:card.location,city:normalizeCity(geo.city)||geo.city,state:geo.state,country:'India',
   employmentType:employmentType(detail.schema.employmentType),jobDescription:visible(detail.description),sourceUrl:detail.sourceUrl,applyUrl:detail.sourceUrl,link:detail.sourceUrl,applicationRequiresAccount:true,
   postingDate:new Date(detail.schema.datePosted).toISOString(),closingDate:new Date(detail.schema.validThrough).toISOString(),scrapedAt:checkedAt,sourceListingComplete:false,
   sourceListingIncompleteReason:'Employer LinkedIn guest results are a partial public subset; primary careers inventory remains unavailable or lacks verified role country.'})
 }
 if(!jobs.length)return error('no current verified India jobs; missing public inventory is not authoritative zero')
 const snapshot=rows=>JSON.stringify(rows.map(r=>[r.id,r.title,r.location,r.url,r.postingDate]))
 if(snapshot(cards)!==snapshot(parseSearchCards(await read(COMPANY_JOBS_URL))))return error('actual native job inventory snapshot drift')
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:COMPANY_JOBS_URL,firstParty:true,listingComplete:false,pagesFetched:1,reportedTotal:null,indiaFacetCount:null,verifiedAt:checkedAt,
  reason:'Native employer profile/domain/company ID and active full-description India job details verified. Guest search is a partial public subset; primary inventory is unresolved.'+(jobs.length<cards.length?' Caller cap limits observed roles.':'')})
}

const parseDetail = (html, row, config, at) => {
  const doc = document(html), canonical = one([...doc.matchAll(/<link\b[^>]*>/gi)].filter(m => attr(m[0], 'rel') === 'canonical'), 'missing canonical identity')
  const source = roleIdentity(attr(canonical[0], 'href'), row.id)
  if (source.search || source.pathname !== new URL(row.url).pathname) return error('canonical role identity changed')
  const title = visible(one(elements(doc, 'h1', t => hasClass(t, 'top-card-layout__title')), 'missing detail title identity').inner)
  const employer = one(links(doc).filter(x => hasClass(x.tag, 'topcard__org-name-link')), 'missing detail employer identity')
  const location = visible(one(elements(doc, 'span', t => hasClass(t, 'topcard__flavor') && hasClass(t, 'topcard__flavor--bullet')), 'missing detail geography').inner)
  if (title !== row.title || employer.text !== config.companyName || !companyIdentity(employer.href, config) || location !== row.location) return error('listing/detail identity or geography changed')
  if (visible(doc).includes('No longer accepting applications')) return error('expired role is still listed')
  const description = one(elements(doc, 'div', t => hasClass(t, 'show-more-less-html__markup')), 'missing full description').inner.trim()
  if (visible(description).length < 300) return error('empty description')
  let allSchemas
  try { allSchemas = [...withoutComments(html).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m => attr(m[1], 'type') === 'application/ld+json').map(m => JSON.parse(m[2])) } catch { return error('malformed role schema') }
  const schemas = allSchemas.filter(x => x?.['@type'] === 'JobPosting')
  let geography, schema = null, remoteStatus = null
  if (!schemas.length) {
    const rule = config.nativeRoleEvidence?.[row.id]
    if (allSchemas.some(x => JSON.stringify(x).includes('JobPosting')) || !rule || rule.title !== title || rule.location !== location || location !== 'India'
      || !Array.isArray(rule.descriptionSignals) || !rule.descriptionSignals.length || !rule.descriptionSignals.every(s => clean(s) && visible(description).includes(s))) return error('unverified native role schema/geography evidence')
    geography = [{ country: 'IN', city: null, state: null, location }]; remoteStatus = 'Remote'
  } else {
    schema = one(schemas, 'duplicate role schema identity')
    employmentType(schema.employmentType)
    if (visible(schema.title) !== title || schema.hiringOrganization?.name !== config.companyName || !companyIdentity(schema.hiringOrganization?.sameAs, config)) return error('schema employer/title identity changed')
    if (visible(schema.description) !== visible(description)) return error('schema and full visible description parity changed')
    if (!Number.isFinite(Date.parse(schema.datePosted)) || Date.parse(schema.datePosted) > at || !Number.isFinite(Date.parse(schema.validThrough)) || Date.parse(schema.validThrough) <= at) return error('invalid or expired role dates')
    const namedLocationCountry = namedCountries.get(location.split(',').at(-1).trim().toLowerCase())
    const places = Array.isArray(schema.jobLocation) ? schema.jobLocation : [schema.jobLocation]
    if (!places.length) return error('missing structured geography')
    geography = places.map(p => {
      const a = p?.address
      if (p?.['@type'] !== 'Place' || a?.['@type'] !== 'PostalAddress') return error('invalid role geography')
      const country = countryCode(a.addressCountry), city = a.addressLocality == null ? null : clean(a.addressLocality), state = a.addressRegion == null ? null : clean(a.addressRegion)
      if ((a.addressLocality != null && !city) || (a.addressRegion != null && !state)) return error('invalid structured geography fields')
      if (city ? !location.toLowerCase().includes(city.toLowerCase()) : location !== regions.of(country)) return error('structured/visible geography parity changed')
      if (places.length === 1 && namedLocationCountry && namedLocationCountry !== country) return error('structured/visible country geography parity changed')
      if (state && !location.toLowerCase().includes(state.toLowerCase())) return error('structured/visible state geography parity changed')
      return { country, city, state, location: places.length === 1 ? location : [city, state, regions.of(country)].filter(Boolean).join(', ') }
    })
  }
  accountApplication(doc, source)
  return { ...row, sourceUrl: source.href, description, geography, schema, remoteStatus }
}



export const fetchPublicPage = async(url,{signal}={})=>{
 signal?.throwIfAborted()
 const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',Accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'},redirect:'follow',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)})
 return{status:response.status,url:response.url,html:await response.text()}
}
