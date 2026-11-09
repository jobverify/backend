import { readFileSync } from 'node:fs'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { extractAshbyExperienceRequired } from '../../scraper-support/utils/ashbyExperience.js'

const entities = JSON.parse(readFileSync(new URL('./htmlNamedEntities.json', import.meta.url)))
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const sorted = values => [...new Set(values)].sort()
const text = value => typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : ''
const fail = reason => { throw new Error(reason) }
const botGate = /verify you are human|checking your browser|just a moment\.\.\.|cf-chl-|captcha challenge|access denied/i
const denied = error => [401, 403, 429].includes(error?.status) || /HTTP (?:401|403|429)|access denied|captcha|bot challenge/i.test(error?.message || '')
const domain = value => new URL(value).hostname.replace(/^www\./, '').toLowerCase()
const decode = value => String(value ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (raw, key) => {
  if (key[0] !== '#') return entities[`${key};`] ?? raw
  const cp = Number.parseInt(key.slice(key[1].toLowerCase() === 'x' ? 2 : 1), key[1].toLowerCase() === 'x' ? 16 : 10)
  return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : '\ufffd'
})

// Parse markup before decoding leaves; inline punctuation and encoded text
// must survive, while hidden criteria must not enter the visible description.
export const visibleText = html => {
  const out = [], stack = []
  for (const token of String(html ?? '').match(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][^>]*>|[^<]+|</gi) || []) {
    if (token.startsWith('<!--') || token.startsWith('<!')) continue
    const close = token.match(/^<\/([a-z][\w:-]*)/i)
    if (close) { const tag = close[1].toLowerCase(), i = stack.findLastIndex(x => x.tag === tag); if (i >= 0) stack.splice(i); if (/^(p|div|li|ul|ol|h[1-6]|section|table|tr|td|th)$/.test(tag)) out.push(' '); continue }
    const open = token.match(/^<([a-z][\w:-]*)/i)
    if (open) {
      const tag = open[1].toLowerCase()
      const hidden = /^(script|style|template|noscript)$/.test(tag) || /\s(?:hidden|inert)(?:\s|=|>|\/)|aria-hidden\s*=\s*["']?true|display\s*:\s*none|visibility\s*:\s*hidden/i.test(token)
      if (!/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag) && !/\/\s*>$/.test(token)) stack.push({ tag, hidden })
      if (/^(p|div|br|li|ul|ol|h[1-6]|section|table|tr|td|th)$/.test(tag)) out.push(' ')
      continue
    }
    if (!stack.some(x => x.hidden)) out.push(decode(token))
  }
  return text(out.join(''))
}
export function readAppData(html) {
  const raw = String(html), marker = /window\.__appData\s*=\s*/g.exec(raw)
  if (!marker) fail('missing-native-app-data')
  const offset = marker.index + marker[0].length
  let depth = 0, quote = false, escape = false
  for (let i = offset; i < raw.length; i++) {
    const ch = raw[i]
    if (quote) { if (escape) escape = false; else if (ch === '\\') escape = true; else if (ch === '"') quote = false; continue }
    if (ch === '"') quote = true
    else if (ch === '{' || ch === '[') depth++
    else if ((ch === '}' || ch === ']') && --depth === 0) return JSON.parse(raw.slice(offset, i + 1))
  }
  fail('truncated-native-app-data')
}
const schemas = html => [...String(html).matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([^]*?)<\/script>/gi)]
  .flatMap(m => { const p = JSON.parse(m[1]); return Array.isArray(p) ? p : p['@graph'] || [p] }).filter(s => s?.['@type'] === 'JobPosting')
const countries = new Map()
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = regionNames.of(code)
  if (name && name !== code && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code)) { countries.set(code.toLowerCase(), name); countries.set(name.toLowerCase(), name) }
}
for (const [alias, name] of Object.entries({ ind:'India',usa:'United States',us:'United States',uk:'United Kingdom',gbr:'United Kingdom',uae:'United Arab Emirates',are:'United Arab Emirates','south korea':'South Korea','czech republic':'Czechia','hong kong':'Hong Kong','united states of america':'United States' })) countries.set(alias, name)
export const normalizeCountry = value => typeof value === 'string' ? countries.get(text(value).toLowerCase()) || null : null
const postal = value => {
  if (value == null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) fail('unsupported-native-address-shape')
  if (value.postalAddress != null && (typeof value.postalAddress !== 'object' || Array.isArray(value.postalAddress))) fail('unsupported-native-postal-address-shape')
  return value.postalAddress || value
}
const roleLocations = row => {
  if (!Array.isArray(row.secondaryLocations)) fail('missing-native-secondary-locations')
  return [{ location: row.location, address: postal(row.address), raw: row }, ...row.secondaryLocations.map(l => {
    if (!l || typeof l !== 'object' || !text(l.location)) fail('unsupported-native-secondary-location')
    return { location:l.location,address:postal(l.address),raw:l }
  })]
}
const locationNames = row => roleLocations(row).map(x => text(x.location)).sort()
const qualifications = html => {
  const result = {minimumQualification:null,preferredQualification:null,requiredSkills:[]}
  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>([^]*?)<\/h\1>/gi)]
  for (let i = 0; i < headings.length; i++) {
    const heading = visibleText(headings[i][2]), body = visibleText(html.slice(headings[i].index + headings[i][0].length, headings[i + 1]?.index))
    if (/^(?:requirements|required qualifications|minimum qualifications|qualifications)\s*:?$/i.test(heading)) result.minimumQualification = body || null
    if (/^(?:preferred qualifications|preferred requirements|nice to have)\s*:?$/i.test(heading)) result.preferredQualification = body || null
    if (/^(?:required skills|technical skills)\s*:?$/i.test(heading) && body) result.requiredSkills.push(body)
  }
  return result
}
const isoDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
const agreesDate = (schema, native) => typeof schema === 'string' && (schema === native.slice(0,10) || (isoDate(schema) && Date.parse(schema) === Date.parse(native)))
const stable = value => {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k,stable(value[k])]))
  return value
}
const stableRows = rows => rows.map(stable).sort((a,b) => a.id.localeCompare(b.id))
export const advertisedChannels = (html, surface, spec) => {
  const internal=[],external=[],talent=[],apis=[]
  for (const m of String(html).matchAll(/<(a|iframe|link)\b([^>]*)>([^]*?)(?:<\/a>|(?=<)|$)/gi)) {
    const href=m[2].match(/\b(?:href|src)\s*=\s*["']([^"']+)["']/i)
    if (!href) continue
    let u; try {u=new URL(decode(href[1]),surface)} catch {continue}
    if (!['https:','http:'].includes(u.protocol)||u.username||u.password) continue
    u.hash=''
    const label=visibleText(m[3]),local=domain(u.href)===spec.domain,isCareerRoute=/\/(?:careers|jobs|early-careers)\/?$/i.test(u.pathname)
    const hiringAction=/\b(?:careers?|open (?:roles|positions)|(?:explore|view|search|browse) (?:jobs|roles|positions)|apply(?: now)?)\b/i.test(label)
    const isAts=/(?:^|\.)(?:ashbyhq\.com|greenhouse\.io|lever\.co|myworkdayjobs\.com|workable\.com|jobvite\.com|recruitee\.com)$/i.test(u.hostname)
    if(local&&isCareerRoute)internal.push(u.href)
    else if(!local&&/\/form\/|\/application(?:\/|$)/.test(u.pathname)&&/talent|community|network/i.test(label+' '+u.pathname))talent.push(u.href)
    else if(!local&&(isAts||hiringAction||isCareerRoute))external.push(u.href)
  }
  for(const m of String(html).matchAll(/https:\/\/(?:api\.ashbyhq\.com\/posting-api\/job-board\/[A-Za-z0-9._-]+|ashby-careers-checkout-production\.up\.railway\.app\/api\/jobs)/g))apis.push(m[0])
  const languageClient={routes:[],issues:[]}
  return {internal:sorted(internal),external:sorted(external),talent:sorted(talent),apis:sorted(apis),clientDerivedInternal:languageClient.routes,clientIssues:languageClient.issues}
}
function validOrganization(org,spec){try{return org?.name===spec.company&&org.hostedJobsPageSlug===spec.token&&domain(org.publicWebsite)===spec.domain&&text(org.organizationId)&&org.isDemoOrg!==true}catch{return false}}
function boardSnapshot(body,spec){
  const data=readAppData(body)
  if(!validOrganization(data.organization,spec)||!Array.isArray(data.jobBoard?.jobPostings)||data.posting!=null)fail(`${spec.source}:native-board-employer-mismatch`)
  const rows=data.jobBoard.jobPostings
  if(rows.some(r=>!text(r.id)||!text(r.title)||!text(r.locationName)||!Array.isArray(r.secondaryLocations))||new Set(rows.map(r=>r.id)).size!==rows.length)fail('malformed-or-duplicate-native-board-role')
  if(['hasMore','next','nextPage','nextCursor','truncated'].some(k=>data.jobBoard[k])||(data.jobBoard.total!=null&&data.jobBoard.total!==rows.length))fail('incomplete-native-board-pagination')
  return {organization:{id:data.organization.organizationId,name:data.organization.name,slug:data.organization.hostedJobsPageSlug,website:data.organization.publicWebsite,publishedLegalIdentity:Object.fromEntries(Object.entries(data.organization).filter(([key])=>/legal/i.test(key)))},rows}
}
function feedSnapshot(payload){
  if(payload?.apiVersion!=='1'||!Array.isArray(payload.jobs)||payload.error||payload.errors||payload.hasMore||payload.next||payload.nextPage||payload.nextCursor||payload.truncated)fail('invalid-or-truncated-native-feed')
  if(payload.total!=null&&payload.total!==payload.jobs.length)fail('native-feed-total-mismatch')
  if(new Set(payload.jobs.map(r=>r.id)).size!==payload.jobs.length)fail('duplicate-native-feed-role')
  for(const r of payload.jobs)if(!text(r.id)||!text(r.title)||!text(r.location)||typeof r.isListed!=='boolean'||!Array.isArray(r.secondaryLocations))fail('malformed-native-feed-role')
  return payload.jobs.filter(r=>r.isListed)
}
const validUrls=(row,spec)=>{
  try{const role=new URL(row.jobUrl),apply=new URL(row.applyUrl)
    return role.origin==='https://jobs.ashbyhq.com'&&role.pathname===`/${spec.token}/${row.id}`&&!role.username&&!role.password&&!role.search&&!role.hash&&apply.origin===role.origin&&apply.pathname===`${role.pathname}/application`&&!apply.username&&!apply.password&&!apply.search&&!apply.hash
  }catch{return false}
}
function reconcileProxy(payload,feed,spec){
  const issues=[]
  if(!Array.isArray(payload?.jobs)||!Number.isInteger(payload.meta?.totalJobs)||payload.meta.totalJobs!==payload.jobs.length||payload.meta.filteredJobs!==payload.jobs.length||payload.hasMore||payload.next||payload.nextPage||payload.nextCursor||payload.truncated)return ['corporate-proxy-inventory-incomplete']
  if(new Set(payload.jobs.map(r=>r.id)).size!==payload.jobs.length||!same(sorted(payload.jobs.map(r=>r.id)),sorted(feed.map(r=>r.id))))issues.push('corporate-proxy-native-inventory-mismatch')
  for(const r of payload.jobs){const native=feed.find(j=>j.id===r.id)
    if(!native){issues.push('corporate-proxy-role-missing-from-native-feed');continue}
    if(!validUrls(r,spec)||!same([r.title,r.location,r.employmentType,r.workplaceType,r.publishedAt,r.jobUrl,r.applyUrl],[native.title,native.location,native.employmentType,native.workplaceType,native.publishedAt,native.jobUrl,native.applyUrl])||!same(sorted(r.secondaryLocations||[]),sorted(native.secondaryLocations.map(l=>l.location)))||!normalizeCountry(r.addressCountry)||normalizeCountry(r.addressCountry)!==normalizeCountry(postal(native.address).addressCountry))issues.push('corporate-proxy-native-role-state-mismatch')
  }
  return sorted(issues)
}
function detail(row,brief,opening,body,spec){
  const data=readAppData(body),posting=data.posting,ss=schemas(body)
  if(!validOrganization(data.organization,spec)||data.organization.organizationId!==opening.organization.id||!posting||ss.length!==1)fail('detail-employer-or-schema-missing')
  const schema=ss[0]
  if(posting.id!==row.id||schema.identifier?.value!==row.id||schema.identifier?.name!==spec.company||schema.hiringOrganization?.name!==spec.company||domain(schema.hiringOrganization?.sameAs)!==spec.domain)fail('detail-employer-or-posting-identity-mismatch')
  if(row.requisitionId!=null&&posting.requisitionId!=null&&row.requisitionId!==posting.requisitionId)fail('native-requisition-identity-mismatch')
  if(!validUrls(row,spec)||posting.isListed!==true||posting.isConfidential!==false||posting.title!==row.title||schema.title!==row.title||(brief&&brief.title!==row.title))fail('detail-publication-or-title-mismatch')
  if(!same(locationNames(row),[posting.locationName,...(posting.secondaryLocationNames||[])].map(text).sort())||(brief&&!same(locationNames(row),[brief.locationName,...brief.secondaryLocations.map(l=>l.locationName)].map(text).sort())))fail('detail-native-worksites-mismatch')
  if(posting.employmentType!==row.employmentType||posting.workplaceType!==row.workplaceType||(brief&&(brief.employmentType!==row.employmentType||brief.workplaceType!==row.workplaceType)))fail('detail-native-employment-mismatch')
  if(!text(row.descriptionHtml)||!visibleText(row.descriptionHtml)||row.descriptionHtml!==posting.descriptionHtml||(schema.description!=null&&visibleText(schema.description)!==visibleText(row.descriptionHtml)))fail('detail-full-native-criteria-mismatch')
  if(!isoDate(row.publishedAt)||!agreesDate(schema.datePosted,row.publishedAt))fail('detail-original-publication-mismatch')
  if(!Object.hasOwn(posting,'applicationDeadline')||(posting.applicationDeadline!=null&&!isoDate(posting.applicationDeadline)))fail('detail-native-deadline-unavailable')
  if(schema.validThrough!=null&&(posting.applicationDeadline==null||!agreesDate(schema.validThrough,posting.applicationDeadline)))fail('detail-native-expiry-mismatch')
  const geographyIssues=[],locs=roleLocations(row),publishedLocations=Array.isArray(schema.jobLocation)?schema.jobLocation:[schema.jobLocation]
  if(!publishedLocations.length||publishedLocations.some(l=>!l?.address))geographyIssues.push('missing-schema-worksite-address')
  for(const loc of locs){
    loc.country=normalizeCountry(loc.address.addressCountry)
    loc.countryProvenance=loc.country?'native-structured-country':null
    if(!loc.country)geographyIssues.push('unresolved-native-worksite-country')
    if(/\bindia\b/i.test(loc.location)&&loc.country&&loc.country!=='India')fail('contradictory-native-india-country')
    for(const [key,value]of Object.entries(loc.raw))if(value!=null&&/country|office|geograph|address/i.test(key)&&key!=='address')geographyIssues.push(`unsupported-native-geography-field:${key}`)
    for(const [key,value]of Object.entries(loc.address))if(value!=null&&!['@type','addressCountry','addressLocality','addressRegion','postalCode','streetAddress'].includes(key))geographyIssues.push(`unsupported-native-address-field:${key}`)
  }
  const matches=(candidate,native)=>Object.entries(candidate).filter(([k,v])=>k!=='@type'&&v!=null&&v!=='').every(([key,value])=>key==='addressCountry'
    ? normalizeCountry(value) ? normalizeCountry(value)===native.country : !native.country&&same(stable(value),stable(native.address.addressCountry))
    : typeof value==='string'&&text(value)===text(native.address[key]))
  for(const l of publishedLocations)if(l?.address){const a=postal(l.address)
    if(a.addressCountry!=null&&!normalizeCountry(a.addressCountry))geographyIssues.push('unsupported-schema-country')
    const meaningful=Object.entries(a).filter(([k,v])=>k!=='@type'&&v!=null&&v!=='')
    if(meaningful.length&&!locs.some(loc=>matches(a,loc)))fail('published-schema-address-does-not-match-native-worksite')
    if(!normalizeCountry(a.addressCountry))geographyIssues.push('unresolved-schema-country')
  }
  if(posting.locationAddress!=null){const a=postal(posting.locationAddress);if(!matches(a,locs[0]))fail('posting-address-does-not-match-native-worksite');if(!normalizeCountry(a.addressCountry))geographyIssues.push('unresolved-posting-address-country')}
  if(schema.applicantLocationRequirements!=null){const reqs=Array.isArray(schema.applicantLocationRequirements)?schema.applicantLocationRequirements:[schema.applicantLocationRequirements]
    for(const req of reqs){const c=req?.['@type']==='Country'?normalizeCountry(req.name):null;if(!c)geographyIssues.push('unresolved-applicant-location-requirements');else if(!locs.some(l=>l.country===c))fail('applicant-country-does-not-match-native-worksite')}
  }
  const selected=locs.find(l=>l.country==='India'),extraHtml=[posting.compensationPhilosophyHtml,posting.applicationLimitCalloutHtml].filter(x=>typeof x==='string'&&visibleText(x))
  const jobDescription=[visibleText(posting.descriptionHtml),...extraHtml.map(visibleText)].join(' ')
  const nativeFields=stable(posting)
  return {title:row.title,company:spec.company,department:row.department||null,team:row.team||null,jobId:row.id,requisitionId:row.requisitionId??posting.requisitionId??null,sourceUrl:row.jobUrl,applyUrl:row.applyUrl,postingDate:row.publishedAt,closingDate:posting.applicationDeadline,sourceClosingDateIsExact:posting.applicationDeadline!=null,
    location:selected?.location||row.location,city:text(selected?.address.addressLocality)||null,state:text(selected?.address.addressRegion)||null,country:selected?'India':null,employmentType:text(row.employmentType).replace(/([a-z])([A-Z])/g,'$1 $2')||null,remoteStatus:row.workplaceType||(row.isRemote?'Remote':null),
    descriptionHtml:row.descriptionHtml,jobDescription,...qualifications(row.descriptionHtml),experienceRequired:extractAshbyExperienceRequired({title:row.title,jobDescription}),nativeFields,nativeSchema:stable(schema),nativeEmployer:opening.organization,nativeApplicationId:posting.applicationId??null,applicationIdentity:{postingId:row.id,url:row.applyUrl},nativeLocations:locs.map(l=>({location:l.location,...l.address,country:l.country,countryProvenance:l.countryProvenance})),nativeSchemaDatePosted:schema.datePosted,isIndia:Boolean(selected),geographyComplete:geographyIssues.length===0,geographyIssues:sorted(geographyIssues)}
}
const defaultGet=async(url,{signal,json=false}={})=>{
  const response=await fetch(url,{method:'GET',signal:signal||AbortSignal.timeout(30000),headers:{Accept:json?'application/json':'text/html'}})
  if(!response.ok)throw Object.assign(new Error(`HTTP ${response.status} for ${url}`),{status:response.status,abortRetries:true})
  const body=await response.text();if(botGate.test(body))throw Object.assign(new Error(`Public careers access denied for ${url}`),{abortRetries:true});return json?JSON.parse(body):body
}
// The current first-party page lazy-loads the careers component. Resolve that
// route's module, then its actual embed assignment; catalog tokens cannot bind it.
async function corporateClient(body,surface,spec,getText){
  if(!/<div\b[^>]*id=["']ashby_embed["']/i.test(body))fail('current-corporate-native-client-binding-missing')
  const entries=[...body.matchAll(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/gi)].map(m=>new URL(m[1],surface).href)
  const bindings=[]
  for(const url of entries){
    if(domain(url)!==spec.domain||!new URL(url).pathname.startsWith('/assets/'))fail('unverified-careers-client-entry')
    const entry=await getText(url),route=/[\w$]+\((["'`])\/company\/careers\1\)\(\{/.exec(entry)
    if(!route)continue
    const routeCode=entry.slice(route.index,route.index+2200),imports=[...routeCode.matchAll(/import\((["'`])(\.\/app~careers-[\w-]+\.js)\1\)/g)]
    if(imports.length!==1)fail('unresolved-current-careers-client-route')
    const moduleUrl=new URL(imports[0][2],url).href,module=await getText(moduleUrl)
    const base=module.match(/window\.__ashbyBaseJobBoardUrl\s*=\s*(["'`])(https:\/\/jobs\.ashbyhq\.com\/[\w.-]+)\1/)
    const embedAssignment=module.match(/([\w$]+)\s*=\s*(["'`])(https:\/\/jobs\.ashbyhq\.com\/[\w.-]+\/embed\?version=2)\2/)
    if(!base||!embedAssignment||!module.includes('document.createElement(`script`)')||!new RegExp('\\.src\\s*=\\s*'+embedAssignment[1]+'(?:[;,])').test(module))fail('current-native-embed-binding-unresolved')
    const expected=`https://jobs.ashbyhq.com/${spec.token}`
    if(base[2]!==expected||embedAssignment[3]!==expected+'/embed?version=2')fail('current-corporate-native-employer-binding-mismatch')
    const loader=await getText(embedAssignment[3])
    if(!loader.includes(`window.__ashbyBaseJobBoardUrl = "${expected}"`)||!loader.includes('iframe'))fail('current-native-embed-handoff-mismatch')
    const extra=[...module.matchAll(/https:\/\/(?:[^\s"'`<>]*\.)?(?:ashbyhq\.com|greenhouse\.io|lever\.co)\/[^\s"'`<>]+/g)].map(m=>m[0])
    if(extra.some(u=>![expected,embedAssignment[3]].includes(u)))fail('additional-current-client-hiring-channel-unresolved')
    bindings.push({entryUrl:url,moduleUrl,boardUrl:expected,embedUrl:embedAssignment[3]})
  }
  if(bindings.length!==1)fail('current-corporate-native-client-binding-missing')
  return bindings[0]
}
export function createAirbyteNativeScraper(spec,defaults={}){
  const boardUrl=`https://jobs.ashbyhq.com/${spec.token}`,apiUrl=`https://api.ashbyhq.com/posting-api/job-board/${spec.token}`
  return {async run({fetchText,fetchJson,signal,onNativeAudit,now=defaults.now||(()=>new Date().toISOString()),maxJobs=defaults.maxJobs}={}){
    let pagesFetched=0
    const getText=async url=>{pagesFetched++;const body=await(fetchText?fetchText(url,{signal}):defaultGet(url,{signal}));if(botGate.test(body))throw Object.assign(new Error('Public careers access denied'),{abortRetries:true});return body}
    const getJson=async url=>{pagesFetched++;return fetchJson?fetchJson(url,{signal}):defaultGet(url,{signal,json:true})}
    const issues=[],rows=[],channelChecks=[],unresolvedCorporateRoutes=[]
    const inspectCorporate=async(phase,known=null)=>{
      const queue=[spec.careersUrl],seen=new Set(),surfaces={}
      while(queue.length){const url=queue.shift();if(seen.has(url))continue;seen.add(url);let body
        try{body=await getText(url)}catch(e){
          if(denied(e)||signal?.aborted||url===spec.careersUrl)throw e
          issues.push(`unresolved-corporate-hiring-route:${url}`);unresolvedCorporateRoutes.push(url);channelChecks.push({phase,url,outcome:'unresolved-corporate-route',reason:e.message});surfaces[url]={unresolved:true};continue
        }
        if(!/<html\b|<a\b/i.test(body)||!new RegExp(spec.company.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test(visibleText(body))){
          if(url===spec.careersUrl)fail('current-corporate-employer-signal-missing')
          issues.push(`unverified-corporate-hiring-route:${url}`);unresolvedCorporateRoutes.push(url);surfaces[url]={unresolved:true};continue
        }
        const channels=advertisedChannels(body,url,spec)
        if(url===spec.careersUrl)channels.nativeClient=await corporateClient(body,url,spec,getText)
        surfaces[url]=channels
        for(const internal of channels.internal)if(!seen.has(internal))queue.push(internal)
        for(const internal of channels.clientDerivedInternal)if(!seen.has(internal))queue.push(internal)
        for(const reason of channels.clientIssues)issues.push(`${reason}:${url}`)
        for(const endpoint of channels.apis)if(![apiUrl,spec.proxyUrl].includes(endpoint))issues.push('additional-advertised-native-api')
        for(const external of channels.external)if(external!==boardUrl&&!new RegExp(`^https://jobs\\.ashbyhq\\.com/${spec.token.replaceAll('.','\\.')}/[a-f0-9-]+$`).test(external)){
          issues.push('additional-advertised-hiring-channel-unresolved')
          try{const response=await getText(external);channelChecks.push({phase,url:external,outcome:'public-channel-unparsed',bytes:Buffer.byteLength(response)})}catch(e){if(denied(e)||signal?.aborted)throw e;channelChecks.push({phase,url:external,outcome:'failed',reason:e.message})}
        }
      }
      if(!surfaces[spec.careersUrl]?.nativeClient)fail('current-corporate-native-client-binding-missing')
      if(known&&!same(stable(known),stable(surfaces)))issues.push('closing-corporate-hiring-channels-changed')
      return surfaces
    }
    const openingChannels=await inspectCorporate('opening'),proxyOpening=spec.proxyUrl?await getJson(spec.proxyUrl):null
    const opening=boardSnapshot(await getText(boardUrl),spec),feed=feedSnapshot(await getJson(apiUrl))
    if(!same(sorted(opening.rows.map(r=>r.id)),sorted(feed.map(r=>r.id))))issues.push('opening-native-board-feed-inventory-mismatch')
    if(proxyOpening)issues.push(...reconcileProxy(proxyOpening,feed,spec))
    for(const row of feed){const brief=opening.rows.find(r=>r.id===row.id)
      if(!brief)issues.push(`missing-native-board-brief:${row.id}`)
      if(!validUrls(row,spec)){issues.push(`unsafe-native-role-url:${row.id}`);continue}
      try{const result=detail(row,brief,opening,await getText(row.jobUrl),spec);rows.push(result);if(!result.geographyComplete)issues.push(`unresolved-native-geography:${row.id}`)}catch(e){if(denied(e)||signal?.aborted)throw e;issues.push(`native-detail:${row.id}:${e.message}`)}
    }
    let closing=null,closingFeed=null,closingChannels=null,proxyClosing=null
    const closingDetails=new Map()
    for(const row of feed){
      if(!validUrls(row,spec))continue
      try{closingDetails.set(row.id,detail(row,opening.rows.find(r=>r.id===row.id),opening,await getText(row.jobUrl),spec))}
      catch(e){if(denied(e)||signal?.aborted)throw e;issues.push(`closing-native-detail:${row.id}:${e.message}`)}
    }
    try{closing=boardSnapshot(await getText(boardUrl),spec);closingFeed=feedSnapshot(await getJson(apiUrl))
      if(!same(opening.organization,closing.organization)||!same(stableRows(opening.rows),stableRows(closing.rows))||!same(stableRows(feed),stableRows(closingFeed)))issues.push('closing-native-inventory-or-criteria-changed')
      if(spec.proxyUrl){proxyClosing=await getJson(spec.proxyUrl);issues.push(...reconcileProxy(proxyClosing,closingFeed,spec));if(!same(stableRows(proxyOpening.jobs||[]),stableRows(proxyClosing.jobs||[])))issues.push('closing-corporate-proxy-role-state-changed')}
      closingChannels=await inspectCorporate('closing',openingChannels)
    }catch(e){if(denied(e)||signal?.aborted)throw e;issues.push(`closing-inventory-failed:${e.message}`)}
    const closingVerified=row=>closing&&closingFeed&&closingChannels&&same(opening.organization,closing.organization)
      &&same(stable(feed.find(r=>r.id===row.jobId)),stable(closingFeed.find(r=>r.id===row.jobId)))
      &&same(stable(opening.rows.find(r=>r.id===row.jobId)),stable(closing.rows.find(r=>r.id===row.jobId)))
      &&same(stable(row),stable(closingDetails.get(row.jobId)))
    for(const row of rows)if(!closingVerified(row))issues.push(`closing-role-state-unverified:${row.jobId}`)
    const scrapedAt=now(),india=rows.filter(r=>r.isIndia),eligible=india.filter(r=>r.geographyComplete&&closingVerified(r)&&(r.closingDate==null||Date.parse(r.closingDate)>Date.parse(scrapedAt))),capped=Number.isInteger(maxJobs)&&maxJobs>=0&&eligible.length>maxJobs
    if(capped)issues.push('output-cap')
    const complete=issues.length===0&&rows.length===feed.length&&rows.every(r=>r.geographyComplete)
    const jobs=(capped?eligible.slice(0,maxJobs):eligible).map(({isIndia,geographyComplete,geographyIssues,...row})=>({...row,source:spec.source,link:row.applyUrl,scrapedAt,sourceListingComplete:complete,lifecycleCleanupAllowed:complete}))
    onNativeAudit?.({source:spec.source,verifiedAt:scrapedAt,complete,issues:sorted(issues),openingChannels,closingChannels,channelChecks,unresolvedCorporateRoutes:sorted(unresolvedCorporateRoutes),proxyOpening:proxyOpening&&{count:proxyOpening.jobs?.length,meta:proxyOpening.meta},proxyClosing:proxyClosing&&{count:proxyClosing.jobs?.length,meta:proxyClosing.meta},opening:{organization:opening.organization,ids:sorted(opening.rows.map(r=>r.id))},closing:closing&&{organization:closing.organization,ids:sorted(closing.rows.map(r=>r.id))},nativeCount:feed.length,fullDetailCount:rows.length,closingFullDetailCount:closingDetails.size,fullyHealthyCount:rows.filter(r=>r.geographyComplete&&closingVerified(r)).length,indiaCount:india.length,eligibleCount:jobs.length,pagesFetched,rows})
    return attachInventoryEvidence(jobs,{status:complete?'complete-inventory':'coverage-gap',surface:boardUrl,firstParty:true,listingComplete:complete,pagesFetched,reportedTotal:complete?feed.length:null,indiaFacetCount:complete?india.length:null,verifiedAt:scrapedAt,reason:complete?'native-corporate-channels-board-feed-all-details-and-closing-state-reconciled':sorted(issues).join(';')||'incomplete-native-details'})
  }}
}
