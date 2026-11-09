import { document, norm } from './html.js'
import { runApiPortalScraper } from '../../scraper-support/apiPortal/engine.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const HOME = 'https://www.halliburton.com/'
export const CAREERS = 'https://careers.halliburton.com/'
export const SEARCH = CAREERS + 'search-jobs'
export const INDIA = CAREERS + 'location/india-jobs/543/1269750/2/'
const requireNative = (ok, message) => { if (!ok) { const e = new Error('Halliburton native contract: ' + message); e.incompleteScope = true; throw e } }
const one = (a, label) => { requireNative(a.length === 1, 'Expected one ' + label); return a[0] }
const integer = value => { requireNative(typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value), 'Missing/invalid count'); const n = Number(value); requireNative(Number.isSafeInteger(n) && n <= 10000, 'Count out of bounds'); return n }
const links = (d, base) => d.nodes(n => n.tag === 'a' && n.attrs.href).flatMap(n => { try { return [new URL(n.attrs.href,base).href] } catch { return [] } })
const rowURL = value => { const u = new URL(value, CAREERS); requireNative(u.origin === new URL(CAREERS).origin && !u.search && !u.hash && /^\/job\/[^/]+\/[^/]+\/543\/[1-9]\d*$/.test(u.pathname), 'Role URL identity changed'); return u.href }
const date = (value, now) => { if (value == null || value === '') return null; requireNative(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'Public date precision changed'); const d = new Date(value + 'T00:00:00.000Z'); requireNative(Number.isFinite(+d) && d.toISOString().slice(0,10) === value, 'Invalid public date'); return value }

export function parsePage(html, page) {
  const d = document(html), section = one(d.nodes(n => n.attrs.id === 'search-results'), 'native results section'), a = section.attrs
  const total = integer(a['data-total-results']), pages = integer(a['data-total-pages'])
  requireNative(integer(a['data-total-job-results']) === total && integer(a['data-current-page']) === page
    && a['data-records-per-page'] === '15' && pages === Math.max(1,Math.ceil(total / 15)) && page <= pages
    && a['data-facet-term'] === '1269750' && a['data-facet-type'] === '2', 'Pagination or India facet drift')
  const rows = documentTextRows(d, section)
  requireNative(rows.length === Math.min(15,Math.max(0,total - (page - 1) * 15)) && new Set(rows.map(r => r.publicId)).size === rows.length, 'Page row count/identity mismatch')
  const next = d.nodes(n => n.tag === 'a' && d.hasClass(n,'next') && !d.hasClass(n,'disabled'))
  requireNative(page < pages ? next.length === 1 && new URL(next[0].attrs.href,CAREERS).href === INDIA + (page + 1) : next.length === 0, 'Pagination continuation mismatch')
  return {total,pages,page,rows}
}
function documentTextRows(d, section) {
  const visit = n => n.inactive ? [] : [...(n.tag === 'a' && n.attrs['data-job-id'] ? [n] : []), ...n.children.filter(c => typeof c !== 'string').flatMap(visit)]
  return visit(section).map(n => {
    const sourceUrl = rowURL(n.attrs.href), publicId = n.attrs['data-job-id']
    requireNative(sourceUrl.endsWith('/' + publicId), 'Public listing ID mismatch')
    const title = d.text(one(n.children.filter(c => typeof c !== 'string' && c.tag === 'h2' && !c.inactive),'listing title'))
    const location = d.text(one(n.children.filter(c => typeof c !== 'string' && d.hasClass(c,'job-location') && !c.inactive),'listing country'))
    requireNative(title && /,\s*India$/.test(location), 'India listing country unavailable')
    return {publicId,title,sourceUrl,nativeListingLocation:location}
  })
}
function mainDescription(html) {
  requireNative(typeof html === 'string' && html.length > 0, 'Full native description missing')
  const d = document(html); let text = d.text(d.root)
  const start = text.search(/\bJob Duties\b/i), end = text.search(/Halliburton is an Equal Op+ortunity Employer/i)
  requireNative(start >= 0 && end > start, 'Native main JD boundaries unavailable')
  const roleText = text.slice(start,end).trim()
  requireNative(roleText.length >= 180 && /(?:under (?:broad|direct|strict|general) (?:direction|supervision)|responsibilit|qualifications|what you will do|about the role)/i.test(roleText), 'Full native duties unavailable')
  return text
}
export function parseRole(html, row, now = new Date().toISOString()) {
  const d = document(html), models = d.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json').map(n => JSON.parse(n.raw))
  const j = one(models.filter(m => m?.['@type'] === 'JobPosting'),'native JobPosting')
  requireNative(norm(j.title) === row.title && j.url === row.sourceUrl && j.hiringOrganization?.name === 'HALLIBURTON'
    && j.identifier?.name === 'Job ID' && typeof j.identifier?.value === 'string' && /^[1-9]\d*$/.test(j.identifier.value), 'Native employer/title/requisition identity mismatch')
  requireNative(d.nodes(n => n.tag === 'h2').some(n => d.text(n) === row.title), 'Visible native title unavailable')
  const descriptions = d.nodes(n => d.hasClass(n,'ats-description')).map(n => d.text(n)).filter(Boolean), raw = document(j.description || ''), fullText = raw.text(raw.root)
  requireNative(fullText && descriptions.includes(fullText), 'Native visible full JD and structured content disagree')
  requireNative(Array.isArray(j.jobLocation) && j.jobLocation.length > 0, 'Native geography missing')
  const addresses = j.jobLocation.map(l => l?.address)
  const visible = d.nodes(n => d.hasClass(n,'job-location')).map(n => d.text(n)).filter(Boolean)
  if (addresses.some(a => !a || a.addressCountry !== 'IN' || !norm(a.addressLocality)) || !visible.length || visible.some(v => !/,\s*India$/.test(v))) return null
  const apply = [...new Set(links(d,row.sourceUrl).filter(link => link.startsWith('https://career4.successfactors.com/sfcareer/jobreqcareer?')))]
  requireNative(apply.length === 1, 'Application identity missing or ambiguous')
  const u = new URL(apply[0]); requireNative(!u.hash && u.searchParams.get('company') === 'HALprod' && u.searchParams.get('jobId') === j.identifier.value && [...u.searchParams].length === 2, 'Native application company/requisition mismatch')
  const nativeDatePosted = date(j.datePosted,now), jobDescription = mainDescription(j.description)
  // Native role placement prose can contradict its structured office. Keep the
  // ambiguity excluded; a country facet alone cannot overrule the actual JD.
  const placement = fullText.match(/engineering capability in ([A-Z][a-z]+), and these roles are part of building a permanent, locally-owned engineering organization/)
  if (placement && !addresses.some(a => norm(a.addressLocality).toLowerCase() === placement[1].toLowerCase())) return null
  requireNative(j.validThrough == null || j.validThrough === '', 'Unreviewed native closing-date precision')
  return {...row,jobId:j.identifier.value,requisitionId:j.identifier.value,company:'Halliburton',nativeEmployer:j.hiringOrganization.name,
    nativeEmployerLabel:j.hiringOrganization.name,legalEmployer:null,originalPublicationDate:null,nativeDatePosted,
    nativeDatePostedPrecision:nativeDatePosted?'day':null,nativeDatePostedMeaning:'native-public-post-date-original-requisition-publication-unknown',
    postingDate:nativeDatePosted,postedAt:nativeDatePosted?nativeDatePosted+'T00:00:00.000Z':null,closingDate:null,sourceClosingDateIsExact:false,
    sourceUrl:row.sourceUrl,applyUrl:apply[0],nativeLocations:addresses,location:addresses.map(a=>[a.addressLocality,a.addressRegion,'India'].filter(Boolean).join(', ')).join(' / '),
    country:'India',city:addresses.length===1?addresses[0].addressLocality:null,jobDescription,sourceDescription:jobDescription,nativeDescriptionHTML:j.description,nativeJobPosting:j,
    sourceDetailComplete:true,sourceDetailStatus:'complete',sourceListingComplete:false,sourceScopeComplete:false,sourceLocationCorroborationComplete:true,scrapedAt:now}
}
const defaultFetchText = async url => { const r = await fetch(url,{method:'GET',signal:AbortSignal.timeout(30000)}); if(!r.ok)throw new Error('Halliburton HTTP ' + r.status); return r.text() }
export async function runNative({fetchText = defaultFetchText, now = new Date().toISOString()} = {}) {
  requireNative(Number.isFinite(Date.parse(now)), 'Invalid observation clock')
  const home = document(await fetchText(HOME)), careers = document(await fetchText(CAREERS))
  requireNative(links(home,HOME).includes(CAREERS) && links(careers,CAREERS).includes(SEARCH), 'Current official recruitment handoff unavailable')
  const global = document(await fetchText(SEARCH)), facet = one(global.nodes(n => n.tag === 'input' && n.attrs['data-facet-type'] === '2' && n.attrs['data-id'] === '1269750' && n.attrs['data-display'] === 'India'),'India country facet')
  const total = integer(facet.attrs['data-count']); requireNative(total <= 300, 'India inventory exceeds reviewed bound')
  const rows = [], pageIds = new Set(); let pages = null
  for (let page = 1; page <= (pages ?? 1); page++) {
    const parsed = parsePage(await fetchText(INDIA + page),page)
    requireNative(parsed.total === total && (pages == null || parsed.pages === pages), 'Native India totals changed'); pages = parsed.pages
    for (const row of parsed.rows) { requireNative(!pageIds.has(row.publicId),'Repeated native vacancy identity'); pageIds.add(row.publicId); rows.push(row) }
  }
  requireNative(rows.length === total, 'Native inventory incomplete')
  const records = [], excluded = []
  const requisitions = new Set()
  for (const row of rows) {
    const job = parseRole(await fetchText(row.sourceUrl),row,now)
    if (job) { requireNative(!requisitions.has(job.jobId),'Duplicate native requisition identity'); requisitions.add(job.jobId); records.push(job) }
    else excluded.push(row.publicId)
  }
  const closure = parsePage(await fetchText(INDIA + '1'),1)
  requireNative(closure.total === total && closure.rows.map(r=>r.publicId).join() === rows.slice(0,15).map(r=>r.publicId).join(),'Native inventory changed during capture')
  // Reuse the shared API portal mapper with validated in-memory records. This
  // callback performs no network request and advertises no synthetic native API.
  const fields = ['title','location','jobId','requisitionId','sourceUrl','applyUrl','jobDescription','postingDate']
  const mapped = await runApiPortalScraper({provider:{source:'halliburton',companyName:'Halliburton',countryFilter:'India',companyCareerPage:SEARCH,
    config:{discovery:{listingApiUrl:SEARCH},pagination:{strategy:'single-page',resultsPath:'records',totalCountPath:'total'},mapping:Object.fromEntries(fields.map(f=>[f,f]))}},fetchJson:async()=>({records,total:records.length})})
  const byId = new Map(records.map(r=>[r.jobId,r]))
  const jobs = mapped.map(job=>({...job,...byId.get(job.jobId),sourceListingComplete:false,sourceScopeComplete:false}))
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:INDIA+'1',firstParty:true,listingComplete:false,pagesFetched:pages,reportedTotal:total,indiaFacetCount:total,verifiedAt:now,
    reason:'bounded-native-India-facet-original-publication-and-whole-employer-scope-unknown;cleanup-forbidden' + (excluded.length?';country-conflicts-excluded:'+excluded.join(','):'')})
}
