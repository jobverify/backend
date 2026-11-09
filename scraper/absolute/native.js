import entities from './htmlNamedEntities.json' with { type: 'json' }
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const CAREERS_URL = 'https://www.absolute.com/company/careers/'
export const JOB_BOARD_URL = 'https://jobs.jobvite.com/absolute/'
export const decodeHtml = value => String(value ?? '').replace(/&(#x[\da-f]+|#\d+|[A-Za-z][A-Za-z\d]+);/gi, (all,key) => {
  if (key[0] !== '#') return entities[`${key};`] ?? all
  const point = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2),16) : Number(key.slice(1))
  return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '\ufffd'
})
const withoutHidden = value => {
  let html=String(value??'')
  const hidden=/<([a-z][\w-]*)\b[^>]*(?:\bstyle=["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)[^"']*["']|\bhidden(?:\s|=|>))[^>]*>/gi
  for(const m of [...html.matchAll(hidden)].reverse()){
    let depth=1,end=m.index+m[0].length
    const tail=html.slice(end)
    for(const tag of tail.matchAll(new RegExp(`<\\/?${m[1]}\\b[^>]*>`,'gi'))){depth+=/^<\//.test(tag[0])?-1:1;if(!depth){end+=tag.index+tag[0].length;break}}
    if(!depth)html=html.slice(0,m.index)+html.slice(end)
  }
  return html
}
export const htmlText = value => decodeHtml(withoutHidden(value).replace(/<!--[^]*?-->/g,' ').replace(/<(script|style)\b[^>]*>[^]*?<\/\1>/gi,' ').replace(/<\/?(?:p|div|li|ul|ol|h[1-6]|br|tr|td|section)\b[^>]*>/gi,' ').replace(/<[^>]+>/g,'')).replace(/\s+/g,' ').trim()
const attr = (tag,key) => decodeHtml(tag.match(new RegExp(`\\b${key}\\s*=\\s*["']([^"']*)["']`,'i'))?.[1] ?? '')
const absoluteUrl = (href,base=JOB_BOARD_URL) => { try { return new URL(decodeHtml(href),base).href } catch { return null } }
const canonical = url => { try { const u=new URL(url);return u.origin+u.pathname.replace(/\/$/,'')+u.search } catch { return null } }
const links = html => [...String(html).matchAll(/<a\b([^>]*)>([^]*?)<\/a>/gi)].map(m=>({href:attr(m[1],'href'),text:htmlText(m[2]),rel:attr(m[1],'rel')}))
const roleId = url => String(url).match(/^https:\/\/jobs\.jobvite\.com\/absolute\/job\/([A-Za-z0-9_-]+)$/)?.[1] ?? null
const list = v => v == null ? [] : Array.isArray(v) ? v : [v]
const countryNames = new Map()
const regionCodes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')
const display = new Intl.DisplayNames(['en'],{type:'region'})
for(const code of regionCodes){const name=display.of(code);countryNames.set(code.toLowerCase(),name);countryNames.set(name.toLowerCase(),name)}
for(const [alias,name] of Object.entries({IND:'India',USA:'United States',CAN:'Canada',GBR:'United Kingdom',UK:'United Kingdom',DEU:'Germany',JPN:'Japan',BRA:'Brazil',MEX:'Mexico','United States of America':'United States','Republic of India':'India'}))countryNames.set(alias.toLowerCase(),name)
const country = value => {
  if(value && typeof value === 'object') {
    if (typeof value.name !== 'string') return null
    value=value.name
  }
  return typeof value === 'string' ? countryNames.get(value.trim().toLowerCase()) ?? null : null
}
export const extractJobBoardUrl = html => links(html).map(a=>absoluteUrl(a.href,CAREERS_URL)).find(u=>canonical(u)===canonical(JOB_BOARD_URL)) ? JOB_BOARD_URL : null
export const hasOfficialCareersSignal = html => /<title>\s*Careers\s*\|\s*Absolute Security\s*<\/title>/i.test(html) && extractJobBoardUrl(html)===JOB_BOARD_URL
export const hasOfficialHomepageSignal = html => /Absolute Security/i.test(htmlText(html)) && links(html).some(a=>canonical(absoluteUrl(a.href,'https://www.absolute.com/'))===canonical(CAREERS_URL))
const careersChannels = html => {
  const channels = new Set()
  for(const a of links(html)){
    const url=absoluteUrl(a.href,CAREERS_URL)
    if(!url || !/^https?:/.test(url))continue
    if(/jobvite|greenhouse|workday|ashbyhq|lever\.co|icims|smartrecruiters|recruit|\/careers?(?:\/|$)|\/jobs?(?:\/|$)|hiring\./i.test(url) || /^(?:view\s+)?(?:current\s+|open\s+)?(?:openings|positions|job opportunities|careers)$/i.test(a.text))channels.add(canonical(url))
  }
  for(const m of String(html).matchAll(/<link\b[^>]*>/gi))if(attr(m[0],'hreflang')){const url=absoluteUrl(attr(m[0],'href'),CAREERS_URL);if(url)channels.add(canonical(url))}
  return [...channels].sort()
}
const trustedChannels = new Set([canonical(CAREERS_URL),canonical(JOB_BOARD_URL)])
export const hasOfficialJobBoardSignal = html => /Open Positions|No (?:open |current )?(?:positions|openings|jobs)/i.test(htmlText(html)) && /Powered by Jobvite/i.test(htmlText(html)) && /Absolute (?:Security|Software|provides persistent endpoint security)/i.test(html)
export const extractJobBoardListings = html => {
  const rows=[]
  for(const m of String(html).matchAll(/<h3\b[^>]*>([^]*?)<\/h3>\s*<table\b[^>]*class=["'][^"']*\bjv-job-list\b[^"']*["'][^>]*>([^]*?)<\/table>/gi)){
    const department=htmlText(m[1])
    for(const tr of m[2].matchAll(/<tr\b[^>]*>([^]*?)<\/tr>/gi)){
      const nameCell=tr[1].match(/<td\b[^>]*class=["'][^"']*\bjv-job-list-name\b[^"']*["'][^>]*>([^]*?)<\/td>/i)?.[1]
      const locationCell=tr[1].match(/<td\b[^>]*class=["'][^"']*\bjv-job-list-location\b[^"']*["'][^>]*>([^]*?)<\/td>/i)?.[1]
      const a=links(nameCell)[0];const url=absoluteUrl(a?.href);const id=roleId(url)
      if(!id || !a.text || !locationCell)continue
      const location=htmlText(locationCell).replace(/\s*,\s*/g,', ')
      rows.push({title:a.text,department,location,city:location.split(',')[0],country:country(location.split(',').at(-1)),detailUrl:url,jobId:id,requisitionId:null})
    }
  }
  return rows
}
const boardState = (html,url) => {
  if(!hasOfficialJobBoardSignal(html))throw new Error('Absolute Jobvite board identity changed')
  const rows=extractJobBoardListings(html)
  const advertised=[...new Set(links(html).map(a=>absoluteUrl(a.href,url)).filter(u=>roleId(u)))].sort()
  const reasons=[]
  if(JSON.stringify(advertised)!==JSON.stringify([...new Set(rows.map(r=>r.detailUrl))].sort()))reasons.push('unparsed-role-links')
  if(new Set(rows.map(r=>r.jobId)).size!==rows.length)reasons.push('duplicate-posting-identity')
  if(!rows.length&&!/no (?:open |current )?(?:positions|openings|jobs)/i.test(htmlText(html)))reasons.push('unproven-empty-board')
  const next=[]
  for(const a of links(html))if(/\bnext\b/i.test(a.rel)||/^next(?:\s|$|[›»])/i.test(a.text)){
    const u=absoluteUrl(a.href,url)
    if(u && /^https:\/\/jobs\.jobvite\.com\/absolute\/(?:search)?(?:\?|$)/.test(u))next.push(u)
    else reasons.push('unsupported-next-page')
  }
  if(/load\s+more/i.test(htmlText(html))||(/class=["'][^"']*pagination/i.test(html)&&!next.length))reasons.push('unresolved-pagination')
  const totals=[...String(html).matchAll(/\bdata-(?:total|total-count)=["'](\d+)["']/gi)].map(m=>Number(m[1]))
  const textTotal=htmlText(html).match(/\b(\d+)\s+(?:open positions|open jobs|current openings)\b/i)
  if(textTotal)totals.push(Number(textTotal[1]))
  return {rows,next:[...new Set(next)].sort(),reportedTotals:[...new Set(totals)],reasons}
}
const schemaPosting = html => {
  const found=[]
  const walk = value => {for(const node of list(value)){if(!node||typeof node!=='object')continue;if(list(node['@type']).includes('JobPosting'))found.push(node);if(node['@graph'])walk(node['@graph'])}}
  for(const m of String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([^]*?)<\/script>/gi)){try{walk(JSON.parse(m[1]))}catch{throw new Error('Invalid native JobPosting JSON')}}
  if(found.length!==1)throw new Error('Expected exactly one native JobPosting')
  return found[0]
}
const descriptionFragment = html => {
  const start=/<div\b[^>]*class=["'][^"']*\bjv-job-detail-description\b[^"']*["'][^>]*>/i.exec(html)
  if(!start)return null
  const offset=start.index+start[0].length
  const tail=html.slice(offset);let depth=1
  for(const m of tail.matchAll(/<\/?div\b[^>]*>/gi)){depth+=/^<\//.test(m[0])?-1:1;if(!depth)return tail.slice(0,m.index).replace(/^\s*<h3\b[^>]*>\s*Description\s*<\/h3>/i,'')}
  return null
}
const dateValue = value => {
  if(value==null||value==='')return {raw:null,precision:null,valid:true}
  if(typeof value!=='string')return {raw:value,precision:null,valid:false}
  if(/^\d{4}-\d{2}-\d{2}$/.test(value))return {raw:value,precision:'day',valid:!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value}
  if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(value)&&!Number.isNaN(Date.parse(value)))return {raw:value,precision:'instant',valid:true}
  return {raw:value,precision:null,valid:false}
}
export const extractJobDetail = (html,listing={}) => {
  const s=schemaPosting(html)
  const reasons=[]
  const identifier=typeof s.identifier==='string'?s.identifier:s.identifier?.value
  if(identifier!==listing.jobId)reasons.push('posting-id-mismatch')
  if(htmlText(s.title)!==listing.title)reasons.push('title-mismatch')
  if(s.url&&canonical(absoluteUrl(s.url))!==canonical(listing.detailUrl))reasons.push('schema-url-mismatch')
  const employer=s.hiringOrganization?.name
  if(!['Absolute Software','Absolute Security'].includes(employer))reasons.push('employer-unverified')
  const description=typeof s.description==='string'?s.description:''
  const fragment=descriptionFragment(html)
  // Jobvite adds its published EEO/accommodation text after the schema body.
  // Preserve the entire visible body, while requiring the complete schema content.
  if(!description||!fragment||!htmlText(fragment).startsWith(htmlText(description)))reasons.push('native-visible-description-mismatch')
  const heading=String(html).match(/<h2\b[^>]*>([^]*?)<\/h2>/i)?.[1]
  if(htmlText(heading)!==listing.title)reasons.push('visible-title-mismatch')
  const applyLinks=[...new Set(links(html).map(a=>absoluteUrl(a.href,listing.detailUrl)).filter(u=>u===`${listing.detailUrl}/apply`))]
  if(applyLinks.length!==1)reasons.push('application-identity-missing')
  const locations=list(s.jobLocation)
  const countries=[]
  if(!locations.length)reasons.push('work-country-unknown')
  for(const place of locations){
    if(place?.['@type']!=='Place'||!place.address||Array.isArray(place.address)) {reasons.push('unsupported-work-address');continue}
    const c=country(place.address.addressCountry)
    if(!c)reasons.push('work-country-unknown');else if(!countries.includes(c))countries.push(c)
    for(const k of Object.keys(place))if(/countr|address|geograph|location|office|region|remote/i.test(k)&&k!=='address'&&place[k]!=null)reasons.push(`unsupported-place-${k}`)
    for(const k of Object.keys(place.address))if(/countr|geograph|location|office/i.test(k)&&k!=='addressCountry'&&place.address[k]!=null)reasons.push(`unsupported-address-${k}`)
  }
  for(const k of Object.keys(s))if(/countr|address|geograph|location|office|region|remote/i.test(k)&&!['jobLocation','jobLocationType'].includes(k)&&s[k]!=null)reasons.push(`unsupported-geography-${k}`)
  if(s.jobLocationType!=null&&!['TELECOMMUTE','ON_SITE','HYBRID'].includes(s.jobLocationType))reasons.push('unsupported-work-location-type')
  const listingCountry=country(listing.location?.split(',').at(-1))
  if(listingCountry&&countries[0]&&listingCountry!==countries[0])reasons.push('board-primary-country-mismatch')
  const posted=dateValue(s.datePosted),modified=dateValue(s.dateModified),expires=dateValue(s.validThrough)
  if(!posted.valid||!modified.valid||!expires.valid)reasons.push('invalid-native-date')
  const jobDescription=htmlText(fragment??description)
  return {
    title:s.title,company:employer??null,officialBrandName:'Absolute Security',legalEmployer:s.hiringOrganization?.legalName??null,
    department:s.industry??listing.department??null,location:listing.location??null,city:locations[0]?.address?.addressLocality??listing.city??null,
    country:countries.includes('India')?'India':countries[0]??null,primaryWorkCountry:countries[0]??null,workCountries:countries,nativeJobLocations:s.jobLocation??null,
    jobId:listing.jobId??null,postingId:identifier??null,requisitionId:s.requisitionIdentifier??null,sourceUrl:listing.detailUrl,applyUrl:applyLinks[0]??null,
    employmentType:s.employmentType??null,experienceRequired:jobDescription.match(/\b\d+\s*(?:[-–]\s*\d+|\+)?\s*years\b/i)?.[0]??null,
    minimumQualification:s.qualifications??null,preferredQualification:s.preferredQualifications??null,requiredSkills:s.skills??null,
    postingDate:posted.raw,postingDatePrecision:posted.precision,updatedAt:modified.raw,updatedAtPrecision:modified.precision,
    closingDate:expires.raw,closingDatePrecision:expires.precision,jobDescription,jobDescriptionHtml:fragment,nativeDescriptionHtml:description,nativePosting:s,
    detailComplete:reasons.length===0,detailIssues:[...new Set(reasons)],
  }
}
const denied = html => /<title>\s*(?:Access Denied|Just a moment|Attention Required)|verify you are human|cf-chl-platform/i.test(html)
const defaultFetchPage = async (url,{signal}={}) => fetch(url,{method:'GET',redirect:'follow',signal:signal??AbortSignal.timeout(20000),headers:{Accept:'text/html,application/xhtml+xml'}})
const failure = (message,fatal=false) => Object.assign(new Error(message),{absoluteAccessDenied:fatal})
// Jobvite rotates this non-role attribute on otherwise identical public pages.
// Raw HTML remains exact on the returned role and in capture artifacts.
const stableRole = job => JSON.stringify({...job,jobDescriptionHtml:job.jobDescriptionHtml?.replace(/\bdata-cfemail=(["'])[^"']*\1/gi,'data-cfemail="[dynamic-contact-encoding]"')})
export const createNativeAbsoluteScraper = ({now=()=>new Date().toISOString()}={}) => ({
  async run({fetchPage,fetchText,signal,maxJobs}={}){
    const transport=fetchPage??fetchText??defaultFetchPage
    let pagesFetched=0
    const read=async url=>{
      const response=await transport(url,{method:'GET',signal})
      if(response&&typeof response==='object'&&'status' in response){
        if([401,403,429].includes(response.status))throw failure(`Absolute HTTP ${response.status}`,true)
        if(response.status<200||response.status>=300)throw failure(`Absolute HTTP ${response.status}`)
        if(response.url&&canonical(response.url)!==canonical(url))throw failure('Absolute unexpected redirect')
      }
      const html=typeof response==='string'?response:await response.text()
      pagesFetched++
      if(denied(html))throw failure('Absolute explicit bot gate',true)
      return html
    }
    const reasons=[]
    const firstCareers=await read(CAREERS_URL)
    if(!hasOfficialCareersSignal(firstCareers))throw failure('Absolute official careers handoff changed')
    const openingChannels=careersChannels(firstCareers)
    if(openingChannels.some(u=>!trustedChannels.has(u)))reasons.push('unenumerated-corporate-hiring-channel')
    const collect=async()=>{
      const queue=[JOB_BOARD_URL],states=new Map(),all=[]
      while(queue.length){
        const url=queue.shift()
        if(states.has(url))continue
        if(states.size>=100){reasons.push('pagination-safety-limit');break}
        const html=await read(url);const state=boardState(html,url);states.set(url,state);all.push(...state.rows);reasons.push(...state.reasons)
        for(const u of state.next){if(states.has(u))reasons.push('cyclic-next-page');else queue.push(u)}
      }
      const ids=new Set()
      for(const row of all){if(ids.has(row.jobId))reasons.push('cross-page-duplicate-posting');ids.add(row.jobId)}
      for(const state of states.values())if(state.reportedTotals.some(total=>total!==ids.size))reasons.push('published-total-mismatch')
      return {states,rows:all.filter((r,i)=>all.findIndex(x=>x.jobId===r.jobId)===i)}
    }
    const opening=await collect()
    const roles=new Map()
    for(const listing of opening.rows){
      try{const job=extractJobDetail(await read(listing.detailUrl),listing);roles.set(listing.jobId,job);if(!job.detailComplete)reasons.push(`detail-incomplete:${listing.jobId}`)}
      catch(error){if(error.absoluteAccessDenied)throw error;reasons.push(`detail-unavailable:${listing.jobId}`)}
    }
    const closingCareers=await read(CAREERS_URL)
    const closingChannels=careersChannels(closingCareers)
    if(!hasOfficialCareersSignal(closingCareers)||JSON.stringify(openingChannels)!==JSON.stringify(closingChannels)||closingChannels.some(u=>!trustedChannels.has(u)))reasons.push('closing-corporate-hiring-channel-drift')
    const closing=await collect()
    const closingIds=new Set(closing.rows.map(row=>row.jobId))
    for(const id of roles.keys())if(!closingIds.has(id))roles.delete(id)
    const projection=inventory=>JSON.stringify([...inventory.states].map(([url,state])=>({url,rows:state.rows,next:state.next,reportedTotals:state.reportedTotals})))
    if(projection(opening)!==projection(closing))reasons.push('closing-inventory-drift')
    for(const listing of closing.rows){
      const original=roles.get(listing.jobId)
      if(!original){reasons.push('closing-new-or-unread-role');continue}
      try{const checked=extractJobDetail(await read(listing.detailUrl),listing);if(!checked.detailComplete||stableRole(original)!==stableRole(checked))reasons.push(`closing-role-drift:${listing.jobId}`);if(checked.detailComplete)roles.set(listing.jobId,checked);else roles.delete(listing.jobId)}
      catch(error){if(error.absoluteAccessDenied)throw error;reasons.push(`closing-detail-unavailable:${listing.jobId}`);roles.delete(listing.jobId)}
    }
    const at=now()
    const eligible=[...roles.values()].filter(j=>j.detailComplete&&j.workCountries.includes('India')&&(!j.closingDate||(j.closingDatePrecision==='day'?j.closingDate>=String(at).slice(0,10):Date.parse(j.closingDate)>Date.parse(at))))
    const cap=Number.isInteger(maxJobs)&&maxJobs>=0?maxJobs:Infinity
    if(eligible.length>cap)reasons.push('output-cap')
    const complete=reasons.length===0
    const jobs=eligible.slice(0,cap).map(job=>({...job,source:'absolute',link:job.applyUrl,scrapedAt:at,sourceListingComplete:complete}))
    return attachInventoryEvidence(jobs,{status:complete?'complete-inventory':'discovery-only',surface:JOB_BOARD_URL,firstParty:true,listingComplete:complete,pagesFetched,reportedTotal:complete?opening.rows.length:null,indiaFacetCount:complete?eligible.length:null,verifiedAt:at,reason:complete?'runtime-corporate-binding-all-board-pages-all-native-details-and-closing-recheck': [...new Set(reasons)].join(';')})
  },
})
