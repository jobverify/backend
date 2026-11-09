import { createHash } from 'node:crypto'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { literalFields, nativeHTMLText, nativeLocationMetadata } from '../../scraper-support/native-sources/declaredGreenhouse/nativeData.js'
import { nativeEnvelopeFailed } from '../../scraper-support/native-sources/declaredGreenhouse/nativeCareers.js'
import { decodeLeaf, normalizeText, visibleDocument, visibleText } from './nativeVisibility.js'

export const SOURCE = 'financialtimes'
export const COMPANY = 'Financial Times'
export const HOMEPAGE_URL = 'https://aboutus.ft.com/'
export const CAREERS_URL = 'https://aboutus.ft.com/careers/'
export const JOBS_URL = 'https://boards-api.greenhouse.io/v1/boards/financialtimes33/jobs?content=true'
export const OFFICES_URL = 'https://boards-api.greenhouse.io/v1/boards/financialtimes33/offices'
const regions = new Set(['APAC', 'EMEA', 'North America', 'South America'])
const broad = new Set([...regions, 'Global', 'Remote', 'Worldwide'])
const clean = v => typeof v === 'string' ? normalizeText(v) : ''
const key = v => clean(v).toLowerCase()
const hash = v => createHash('sha256').update(v).digest('hex')
const object = v => v && typeof v === 'object' && !Array.isArray(v)
export class FinancialTimesNativeError extends Error {
  constructor(message) { super('Financial Times native: ' + message); this.name = 'FinancialTimesNativeError'; this.abortRetries = true }
}
const valid = (value, message) => { if (!value) throw new FinancialTimesNativeError(message) }
const countryName = value => ({ 'united states of america': 'United States', 'hong kong': 'Hong Kong', 'russian federation': 'Russia', 'south korea': 'South Korea' })[key(value)] || nativeCountryName(value)
const absolute = (value, base = HOMEPAGE_URL) => { try { return new URL(value, base).href } catch { return null } }
const postingId = value => /^https:\/\/(?:job-boards|boards)\.eu\.greenhouse\.io\/financialtimes33\/jobs\/(\d+)\/?(?:\?[^#]*)?$/.exec(value || '')?.[1] || null
const boardLink = value => /^https:\/\/(?:job-boards|boards)\.eu\.greenhouse\.io\/financialtimes33\/?$/.test(value || '')
const stable = value => Array.isArray(value) ? value.map(stable) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value
const state = value => JSON.stringify(stable(value))

// parent_id is authoritative. Native child_ids may list all descendants.
export function buildOfficeGraph(payload) {
  valid(object(payload) && Array.isArray(payload.offices) && payload.offices.length > 0, 'missing office graph')
  const byId = new Map(), byName = new Map()
  for (const raw of payload.offices) {
    valid(object(raw) && Number.isSafeInteger(raw.id) && raw.id >= 0 && clean(raw.name) && (raw.parent_id == null || Number.isSafeInteger(raw.parent_id)) && Array.isArray(raw.child_ids), 'invalid native office')
    valid(!byId.has(raw.id), 'duplicate office identity')
    const office = { id: raw.id, name: raw.name, parent_id: raw.parent_id ?? null, child_ids: [...raw.child_ids] }
    byId.set(office.id, office)
    byName.set(key(office.name), [...(byName.get(key(office.name)) || []), office])
  }
  const ancestry = new Map()
  for (const office of byId.values()) {
    const chain = [], seen = new Set(); let node = office
    while (node) {
      valid(!seen.has(node.id), 'office hierarchy cycle'); seen.add(node.id); chain.push(node)
      valid(node.parent_id == null || byId.has(node.parent_id), 'missing office parent')
      node = node.parent_id == null ? null : byId.get(node.parent_id)
    }
    ancestry.set(office.id, chain)
  }
  for (const office of byId.values()) {
    valid(new Set(office.child_ids).size === office.child_ids.length, 'duplicate office child reference')
    for (const child of office.child_ids) valid(byId.has(child) && ancestry.get(child).slice(1).some(n => n.id === office.id), 'conflicting office child hierarchy')
  }
  const resolve = office => {
    const chain = ancestry.get(office.id)
    // Country names apply at a region's child level or an explicit root country.
    // A US office called Georgia remains under its US country ancestor.
    const candidate = chain.find(n => (n.parent_id == null || regions.has(byId.get(n.parent_id)?.name)) && countryName(n.name))
    return candidate ? { country: countryName(candidate.name), countryOfficeId: candidate.id, chain } : { country: null, countryOfficeId: null, chain }
  }
  return { byId, byName, ancestry, resolve, projection: [...byId.values()].sort((a,b) => a.id-b.id) }
}

const description = row => {
  valid(typeof row.content === 'string' && row.content.trim(), 'missing full native criteria')
  // Decode Greenhouse transport once, then each original HTML text leaf once.
  const html = /^\s*&lt;[a-z!/]/i.test(row.content) ? decodeLeaf(row.content) : row.content
  const result = visibleText(html)
  let text = result.text || '', complete = !result.unresolved && /[\p{L}\p{N}]/u.test(text)
  if (row.include_ai_disclaimer === true) {
    if (typeof row.ai_disclaimer !== 'string' || !row.ai_disclaimer.trim()) complete = false
    else { const extra = visibleText(row.ai_disclaimer); complete &&= !extra.unresolved && Boolean(extra.text); if (extra.text) text += '\n\n' + extra.text }
  }
  const criteria = []
  for (const field of ['questions', 'location_questions', 'compliance', 'demographic_questions']) if (row[field] != null) {
    const walk = value => {
      if (Array.isArray(value)) { value.forEach(walk); return }
      if (!object(value)) { complete = false; return }
      if (typeof value.label === 'string' || typeof value.description === 'string') {
        for (const name of ['label', 'description']) if (typeof value[name] === 'string') { const part = visibleText(value[name]); if (part.unresolved) complete = false; if (part.text) criteria.push(part.text) }
        if (value.required === true) criteria.push('Required')
      }
      for (const name of ['questions', 'fields', 'values', 'options']) if (value[name] != null) walk(value[name])
      if (typeof value.name === 'string' && typeof value.label !== 'string') criteria.push(value.name)
    }
    walk(row[field])
  }
  if (criteria.length) text += '\n\n' + criteria.join('\n')
  return { html, text: text || null, complete, publicApplicantCriteria: criteria }
}

export function classifyFinancialTimesWorksites(row, graph) {
  const issues = [], evidence = [], typedCountries = new Set(), primaryCountries = new Set()
  const add = (office, kind) => {
    const found = graph.resolve(office)
    evidence.push({ kind, nativeOfficeId: office.id, nativeOfficeName: office.name, country: found.country, countryOfficeId: found.countryOfficeId, ancestry: found.chain.map(n => ({ id:n.id, name:n.name, parent_id:n.parent_id })) })
    if (!found.country) issues.push('unresolved-' + kind + ':' + office.name)
    return found.country
  }
  if (!Array.isArray(row.offices)) issues.push('missing-job-office-array')
  for (const ref of row.offices || []) {
    const office = graph.byId.get(ref.id)
    if (!office || ref.name !== office.name || (ref.parent_id ?? null) !== office.parent_id || !Array.isArray(ref.child_ids) || state([...ref.child_ids].sort()) !== state([...office.child_ids].sort())) { issues.push('conflicting-job-office-identity:' + ref.id); continue }
    const c = add(office, 'native-office-assignment'); if (c) typedCountries.add(c)
  }
  const metadata=nativeLocationMetadata(row),metadataCountries=new Set()
  for(const item of metadata){
    let country=item.country
    if(!country&&item.originalLabel){const matches=graph.byName.get(key(item.originalLabel))||[];if(matches.length===1)country=add(matches[0],'native-location-metadata-office')}
    evidence.push({...item,kind:'role-owned-native-location-metadata',country})
    if(country){metadataCountries.add(country);typedCountries.add(country)}else issues.push('unresolved-native-location-metadata:'+item.originalField)
  }
  const labels = typeof row.location?.name === 'string' ? row.location.name.split(';').map(clean).filter(Boolean) : []
  if (!labels.length) issues.push('missing-primary-location')
  for (const label of labels) {
    if (broad.has(label)) {
      if(metadataCountries.size&&metadata.every(item=>item.country)){for(const country of metadataCountries)primaryCountries.add(country);continue}
      const body = description(row).text || ''
      const selected = (row.offices || []).map(r => graph.byId.get(r.id)).filter(Boolean)
      const supported = selected.length === 1 && typedCountries.size === 1 && !issues.length && selected[0].name === [...typedCountries][0]
        && new RegExp('\\b(?:this role|the role|this position|the position) (?:will be |is )based in ' + selected[0].name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\b','i').test(body)
      if (supported) { primaryCountries.add([...typedCountries][0]); evidence.push({ kind:'role-owned-worksite-refines-region', nativePrimaryLocation:label, worksite:selected[0].name, country:[...typedCountries][0] }) }
      else issues.push('unresolved-broad-primary-location:' + label)
      continue
    }
    const matches = graph.byName.get(key(label)) || []
    if (matches.length !== 1) { issues.push('missing-or-ambiguous-native-primary-office:' + label); continue }
    const c = add(matches[0], 'native-primary-location'); if (c) primaryCountries.add(c)
  }
  const countries = [...new Set([...primaryCountries, ...typedCountries])].sort()
  if (countries.includes('India') && countries.length > 1) issues.push('India-vs-foreign-native-location-conflict')
  return { country:countries.length === 1 ? countries[0] : null, countries, complete:issues.length === 0 && countries.length > 0, indiaEligible:issues.length === 0 && countries.length === 1 && countries[0] === 'India', evidence, issues, availabilityAtEveryOfficeInferred:false }
}

const nativeDate = value => {
  if (value == null || value === '') return { raw:null, iso:null, exact:false }
  valid(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), 'invalid native date')
  const [year,month,day,hour,minute,second]=value.slice(0,19).split(/[-T:]/).map(Number)
  valid(year>=1000&&month>=1&&month<=12&&day>=1&&day<=new Date(Date.UTC(year,month,0)).getUTCDate()&&hour<24&&minute<60&&second<60,'invalid native calendar date')
  return { raw:value, iso:new Date(value).toISOString(), exact:true }
}

export function parseFinancialTimesRole(row, graph, { now = new Date().toISOString() } = {}) {
  valid(object(row) && Number.isSafeInteger(row.id) && row.id > 0 && postingId(row.absolute_url) === String(row.id), 'native board/posting identity mismatch')
  valid(row.company_name === COMPANY, 'native employer identity mismatch')
  valid(clean(row.title) && object(row.location), 'missing native title/location')
  const body = description(row), posted = nativeDate(row.first_published), closing = nativeDate(row.application_deadline)
  valid(!posted.iso || !closing.iso || closing.iso >= posted.iso, 'native closing date precedes publication')
  const nonVacancy = /(?:\bjoin our\b.*\btalent (?:community|pool)\b|^\[expression of interest\].*\btalent pool\b)/i.test(row.title)
  const location = classifyFinancialTimesWorksites(row, graph)
  const expired = Boolean(closing.iso && Date.parse(closing.iso) <= Date.parse(now))
  return { id:String(row.id), jobId:String(row.id), internalJobId:row.internal_job_id ?? null, requisitionId:clean(row.requisition_id) || null,
    source:SOURCE, company:COMPANY, title:clean(row.title), sourceUrl:row.absolute_url, link:row.absolute_url, applyUrl:row.absolute_url, nativeApplicationURL:row.absolute_url,
    applicationLinkSource:'native-public-posting-URL', applicationVisited:false, companyCareerPage:CAREERS_URL, companyDomain:'ft.com', atsPlatform:'greenhouse',
    location:clean(row.location.name), country:location.country, countries:location.countries, sourceCountryEvidence:location,
    sourceIndiaEligible:!nonVacancy && location.indiaEligible, sourceCountryComplete:nonVacancy || location.complete,
    sourceDescription:body.text, description:body.text, sourceDescriptionHtml:body.html, sourceRawDescription:row.content, sourcePublicApplicantCriteria:body.publicApplicantCriteria,
    sourceDetailComplete:body.complete, postingDate:posted.raw, postedAt:posted.raw, sourcePostedAt:posted.raw, sourcePostingDateIsExact:posted.exact,
    closingDate:closing.raw, sourceClosingDate:closing.raw, sourceClosingDateIsExact:closing.exact,
    sourceUpdatedAt:row.updated_at ?? null, sourceOriginalPublication:posted, sourceOriginalClosing:closing,
    nativeNonVacancy:nonVacancy, nativeInactive:expired, nativeVacancy:!nonVacancy && !expired,
    legalEmployer:null, employmentType:null, workType:null, workMode:null, firstEverPublication:null,
    nativeCompanyName:row.company_name, nativeDepartments:row.departments ?? null, nativeMetadata:row.metadata ?? null,
    nativeOffices:row.offices, nativeCompliance:row.data_compliance ?? null, nativeAiDisclosure:row.include_ai_disclaimer ? row.ai_disclaimer ?? null : null,
    sourceScopeComplete:false, lifecycleCleanupAllowed:false }
}

const header = (r, name) => r.headers?.get ? r.headers.get(name) : Object.entries(r.headers || {}).find(([k]) => k.toLowerCase() === name)?.[1]
const defaultPage = async (url, init) => { const r = await fetch(url, { ...init, redirect:'manual' }); return { url:r.url, status:r.status, headers:Object.fromEntries(r.headers), contentType:r.headers.get('content-type'), bodyBase64:Buffer.from(await r.arrayBuffer()).toString('base64') } }
const gate = r => [401,403,429].includes(r?.status) || /<(?:title|h1)\b[^>]*>\s*(?:access denied|just a moment|verify you are human|security verification|bot verification|robot check|checking your browser|request rejected|captcha)/i.test(r?.body || '')
const infoPath = path => /^\/careers\/(?:ft-blog|benefits|values)(?:\/|$)/.test(path)
const safePath = path => /^\/careers(?:\/|$)/.test(path) && !/\/(?:apply|application|register|login|profile|consent)(?:\/|$)/i.test(path)

export const createFinancialTimesScraper = (defaults = {}) => ({ async run(options = {}) {
  const settings = { ...defaults, ...options }, signal = settings.signal, maxJobs = settings.maxJobs ?? 0, maxPages = settings.maxPages ?? 40
  valid(Number.isSafeInteger(maxJobs) && maxJobs >= 0 && Number.isSafeInteger(maxPages) && maxPages > 0, 'invalid source budget')
  valid(settings.onAudit == null || typeof settings.onAudit === 'function', 'invalid audit observer')
  valid(settings.onRecords == null || typeof settings.onRecords === 'function', 'invalid record observer')
  const now = new Date(typeof settings.now === 'function' ? settings.now() : settings.now || new Date()).toISOString()
  const load = settings.fetchPage || defaultPage, reasons = new Set(), receipts = [], rawPages = []; let requests = 0
  const init = json => ({ method:'GET', headers:{ Accept:json?'application/json':'text/html' }, signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000), redirect:'manual' })
  const page = async (url, redirect = false) => {
    signal?.throwIfAborted(); const original = await load(url,init(false)); requests++; signal?.throwIfAborted()
    const bytes=typeof original?.bodyBase64==='string'?Buffer.from(original.bodyBase64,'base64'):typeof original?.body==='string'?Buffer.from(original.body):null
    const r=original&&{...original,body:bytes?.toString('utf8')}
    if(bytes)rawPages.push({...original,requestedURL:url,bodyBase64:bytes.toString('base64'),bodyBytes:bytes.length,bodySHA256:hash(bytes)})
    if (gate(r)) { const e = new FinancialTimesNativeError('public access denied HTTP ' + r?.status); e.status=r?.status; throw e }
    const redirectAllowed=redirect&&[301,302,303,307,308].includes(r?.status)
    if(!bytes&&redirectAllowed) {
      const location=header(r,'location'),destination=typeof location==='string'&&location.trim()?absolute(location,url):null
      valid(r.url===url&&destination&&/^https?:\/\//.test(destination),'invalid or redirected public response')
      // The shortlink's original headers are sufficient; do not invent an entity.
      rawPages.push({...original,requestedURL:url})
      receipts.push({...original,requestedURL:url})
      return r
    }
    valid(r && (r.url == null || r.url === url) && typeof r.body === 'string' && Buffer.byteLength(r.body) <= 8*1024*1024, 'invalid or redirected public response')
    receipts.push({url,status:r.status,bodyBytes:Buffer.byteLength(r.body),bodySHA256:hash(r.body)})
    valid(r.status === 200 || redirectAllowed, 'public HTTP ' + r.status)
    return r
  }
  const json = async url => {
    signal?.throwIfAborted(); let payload
    if (settings.fetchJson) { payload = await settings.fetchJson(url,init(true)); requests++; signal?.throwIfAborted(); if (object(payload) && Number.isInteger(payload.status) && ('body' in payload)) { if(gate(payload))throw new FinancialTimesNativeError('public API denied HTTP '+payload.status); valid(payload.status===200,'public API HTTP '+payload.status); payload=JSON.parse(payload.body) } }
    else { const r=await page(url); valid(/^application\/json\b/i.test(r.contentType || header(r,'content-type') || ''),'native JSON content type changed'); payload=JSON.parse(r.body) }
    valid(object(payload)&&!nativeEnvelopeFailed(payload),'invalid or failed native JSON'); return payload
  }
  const surfaces = async () => {
    const queue=[HOMEPAGE_URL,CAREERS_URL], visited=new Set(), discovered=[], shortLinks=new Set(), advertisedIds=new Set(), external=[]
    while(queue.length) {
      const url=queue.shift(); if(visited.has(url))continue; valid(visited.size<maxPages,'official scope page budget exhausted');visited.add(url)
      const r=await page(url), d=visibleDocument(r.body,n=>n.tag==='a'||n.tag==='title'||n.tag==='iframe')
      valid(!d.unresolved,'official handoff visibility unresolved')
      const titles=d.nodes(n=>n.tag==='title').map(n=>decodeLeaf(n.raw)); valid(titles.length===1 && /Financial Times|\bFT\b/.test(titles[0]),'current employer binding changed')
      const programContexts=new WeakMap()
      for(const node of d.nodes(n=>['p','li'].includes(n.tag))) {
        const text=d.text(node)
        if(text.length>2400||!/\b(?:fellowships?|internships?|apprenticeships?|graduate trainee)\b/i.test(text)||!/\b(?:applications?|apply|next opening|available|offered|offering)\b|for aspiring/i.test(text))continue
        const mark=n=>{if(typeof n==='string'||n.inert)return;if(n.tag==='a')programContexts.set(n,text);n.children.forEach(mark)}
        mark(node)
      }
      const links=d.nodes(n=>n.tag==='a'&&n.attrs.href).map(n=>({url:absolute(n.attrs.href,url),label:d.text(n),...(programContexts.has(n)?{nativeHiringContext:programContexts.get(n)}:{})})).filter(l=>l.url)
      valid(links.some(l=>boardLink(l.url)),'current native board handoff missing or changed')
      const scoped=[]
      for(const l of links) {
        const u=new URL(l.url);u.hash=''
        if(boardLink(l.url)){scoped.push(l.url.replace(/\/$/,''));continue}
        const id=postingId(l.url); if(id){advertisedIds.add(id);scoped.push(l.url);continue}
        if(u.hostname==='grnh.se'){shortLinks.add(u.href);scoped.push(u.href);continue}
        if(u.hostname==='aboutus.ft.com'&&safePath(u.pathname)&&!infoPath(u.pathname)){u.protocol='https:';u.pathname=u.pathname.replace(/\/$/,'')||'/';const next=u.pathname==='/careers'?CAREERS_URL:u.href;queue.push(next);scoped.push(next);continue}
        // Fellowships and named partner programs are advertised recruitment
        // scope even when their public information URL contains no /jobs path.
        if(u.hostname!=='aboutus.ft.com' && (l.nativeHiringContext || /\b(?:apply|vacancies|careers?|jobs?)\b/i.test(l.label) || /greenhouse|workday|lever\.co|ashbyhq|taleo|\/careers?\b|\/jobs?\b|vacan|recruit|fellowship|marjoriedeane|azizfoundation/i.test(u.href+' '+l.label))) { external.push(l);reasons.add('additional-recruitment-channel:'+l.url);scoped.push(l.url) }
      }
      for(const f of d.nodes(n=>n.tag==='iframe'&&n.attrs.src)) {external.push({url:absolute(f.attrs.src,url),label:'advertised iframe'});reasons.add('unreviewed-recruitment-frame')}
      discovered.push({url,links:[...new Set(scoped)].sort()})
    }
    for(const url of [...shortLinks].sort()) {
      const r=await page(url,true), destination=absolute(header(r,'location'),url),id=postingId(destination)
      if(r.status!==200&&id){advertisedIds.add(id);discovered.push({url,destination,id})}
      else {reasons.add('unresolved-advertised-shortlink:'+url);external.push({url,label:'unresolved public role handoff'})}
    }
    return {pages:discovered.sort((a,b)=>a.url.localeCompare(b.url)),advertisedIds:[...advertisedIds].sort(),external}
  }
  const inventory = async () => {
    const payload=await json(JOBS_URL)
    valid(Array.isArray(payload.jobs)&&Number.isSafeInteger(payload.meta?.total)&&payload.meta.total>=0&&payload.jobs.length===payload.meta.total,'native total mismatch/truncated single-response inventory')
    valid(!payload.next&&!payload.next_page&&!payload.meta.next&&!payload.meta.next_page,'unreviewed native API pagination')
    const rows=new Map();for(const r of payload.jobs){valid(Number.isSafeInteger(r.id)&&r.id>0&&!rows.has(String(r.id))&&postingId(r.absolute_url)===String(r.id)&&r.company_name===COMPANY,'duplicate or mismatching native board/employer identity');rows.set(String(r.id),r)}
    return {payload,rows}
  }
  const openingSurfaces=await surfaces(),opening=await inventory(),officePayload=await json(OFFICES_URL),graph=buildOfficeGraph(officePayload)
  const prepare=(row,currentGraph)=>{
    // Retain the original before projection; one malformed date/field must not
    // discard earlier healthy observations or the original closing snapshot.
    const original=structuredClone(row),fields=literalFields(row)
    let job
    try{job={...parseFinancialTimesRole(row,currentGraph,{now}),sourceNativeProjectionQualified:true,sourceNativeIssues:[]}}
    catch(error){
      signal?.throwIfAborted();let body
      try{body=description(row)}catch{body={text:nativeHTMLText(row.content)||null,complete:false}}
      job={source:SOURCE,company:COMPANY,id:String(row.id),jobId:String(row.id),internalJobId:row.internal_job_id??null,requisitionId:row.requisition_id??null,
        title:clean(row.title)||null,country:null,city:null,state:null,location:null,locations:[],sourceIndiaEligible:false,sourceCountryComplete:false,
        sourceDescription:body.text,description:body.text,sourceDetailComplete:body.complete,sourceNativeProjectionQualified:false,sourceNativeIssues:[error.message],
        nativeVacancy:false,nativeNonVacancy:false,nativeInactive:false,postingDate:fields.postingDate,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
      reasons.add('native-record-projection-held:'+row.id+':'+error.message)
    }
    Object.assign(job,fields,{postingDate:job.postingDate,sourceNativeRecord:original,sourceNativeListingRecord:structuredClone(original),
      sourceNativeContentText:nativeHTMLText(row.content),jobDescription:job.sourceDescription,
      sourceNativePostKind:row.internal_job_id===null?'prospect':Number.isSafeInteger(row.internal_job_id)&&row.internal_job_id>0?'job':'unresolved',
      sourceNativeOwnHostedPageReadThisRun:false,sourceNativePrimaryLocation:structuredClone(row.location),
      sourceCountryScopeUnresolved:!job.sourceCountryComplete,sourceCurrentNativeRoleQualified:false})
    if(job.sourceNativePostKind!=='job')Object.assign(job,{nativeVacancy:false,sourceIndiaEligible:false})
    if(!job.country)Object.assign(job,{location:null,city:null,state:null,locations:[]})
    return job
  }
  const all=[],observationHistory=[]
  for(const row of opening.rows.values()) { signal?.throwIfAborted(); const job=prepare(row,graph);all.push(job); if(!job.sourceDetailComplete)reasons.add('full-native-criteria-unresolved:'+job.jobId);if(!job.sourceCountryComplete)reasons.add('native-country-scope-unresolved:'+job.jobId) }
  let closing=null,closingGraph=null,closingSurfaces=null,closingOfficePayload=null
  try{closing=await inventory();closingOfficePayload=await json(OFFICES_URL);closingGraph=buildOfficeGraph(closingOfficePayload);closingSurfaces=await surfaces()}
  catch(error){signal?.throwIfAborted();reasons.add('closing-reconciliation-unavailable:'+error.message)}
  const nativeSame=Boolean(closing&&state(opening.payload)===state(closing.payload)),officeSame=Boolean(closingGraph&&state(graph.projection)===state(closingGraph.projection)),surfaceSame=Boolean(closingSurfaces&&state(openingSurfaces)===state(closingSurfaces))
  if(closing&&closingGraph)for(const row of closing.rows.values()){
    const current=prepare(row,closingGraph),earlier=all.find(job=>job.jobId===current.jobId)
    if(earlier)observationHistory.push({postId:row.id,earlier:structuredClone(earlier),current})
    else all.push(current)
  }
  for(const job of all)job.sourceCurrentNativeRoleQualified=Boolean(job.sourceNativeProjectionQualified&&officeSame&&surfaceSame&&opening.rows.has(job.jobId)&&closing?.rows.has(job.jobId)&&state(opening.rows.get(job.jobId))===state(closing.rows.get(job.jobId)))
  if(!nativeSame)reasons.add('closing-native-inventory-changed')
  if(!officeSame)reasons.add('closing-native-office-graph-changed')
  if(!surfaceSame)reasons.add('closing-official-handoffs-changed')
  for(const id of [...openingSurfaces.advertisedIds,...(closingSurfaces?.advertisedIds||[])])if(!opening.rows.has(id)||!closing?.rows.has(id))reasons.add('advertised-role-unreconciled:'+id)
  const additionalRecruitmentScopes=[];let deniedAdditionalScope=false
  for(const entry of new Map([...openingSurfaces.external,...(closingSurfaces?.external||[])].map(e=>[e.url,e])).values()) {
    const supported=/^https:\/\/www\.ft\.com\/(?:maisiefellowship|brittanfellowship)$/.test(entry.url)||entry.url==='https://marjoriedeane.com/'||entry.url==='https://www.azizfoundation.org.uk/'
    if(deniedAdditionalScope||!supported){additionalRecruitmentScopes.push({...entry,status:null,inspected:false,reason:deniedAdditionalScope?'stopped-after-access-denial':'unreviewed-public-information-channel'});continue}
    try {
      const response=await page(entry.url)
      additionalRecruitmentScopes.push({...entry,status:response.status,inspected:true,bodySHA256:hash(response.body),scopeEnumerated:false})
    } catch(error) {
      if(signal?.aborted)throw error
      const accessDenied=[401,403,429].includes(error.status)||/denied|gate/i.test(error.message)
      additionalRecruitmentScopes.push({...entry,status:error.status??null,inspected:false,accessDenied,error:error.message})
      reasons.add(accessDenied?'additional-recruitment-channel-access-denied:'+entry.url:'additional-recruitment-channel-unavailable:'+entry.url)
      // A denied public channel ends all requests for this source attempt.
      if(accessDenied)deniedAdditionalScope=true
    }
  }
  const vacancies=all.filter(j=>j.nativeVacancy),india=vacancies.filter(j=>j.sourceIndiaEligible),healthy=india.filter(j=>j.sourceDetailComplete&&j.sourceCurrentNativeRoleQualified)
  const selected=maxJobs?healthy.slice(0,maxJobs):healthy
  if(selected.length<healthy.length)reasons.add('source-job-limit')
  const complete=false,eligibility=analyzePublishableJobs(healthy,{now:new Date(now)})
  const audit={source:SOURCE,observedAt:now,nativePostings:all.length,activeVacancies:vacancies.length,nonVacancyPostings:all.filter(j=>j.nativeNonVacancy).length,expiredVacancies:all.filter(j=>j.nativeInactive&&!j.nativeNonVacancy).length,
    fullNativeDetails:all.filter(j=>j.sourceDetailComplete).length,unknownVacancyCountry:vacancies.filter(j=>!j.sourceCountryComplete).length,indiaVacancies:india.length,fullIndia:healthy.length,eligibleIndia:eligibility.eligibleJobs.length,eligibilityFilterCounts:eligibility.filterCounts,returnedIndia:selected.length,
    countryResolution:'exact-native-office-ID-and-primary-native-office-name-to-country-ancestor;all-plausible-scopes-retained',allOfficeAssignmentsAreAvailableWorksites:false,
    nativeInventoryComplete:nativeSame&&officeSame,corporateScopeComplete:surfaceSame&&openingSurfaces.external.length===0&&closingSurfaces.external.length===0,complete,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
    wholeCompanyGlobal:null,wholeCompanyIndia:null,openingTotal:opening.payload.meta.total,closingTotal:closing?.payload.meta.total??null,officeNodes:graph.byId.size,openingSurfaces,closingSurfaces,additionalRecruitmentScopes,deniedAdditionalScope,requests,receipts,reasons:[...reasons],applicationsVisited:false,
    observations:all,observationHistory,rawPages,opening:{originalNativeFeed:opening.payload,originalNativeOffices:officePayload},closing:{originalNativeFeed:closing?.payload??null,originalNativeOffices:closingOfficePayload}}
  const inventorySummary={source:SOURCE,nativePostings:all.length,nativeInventoryComplete:audit.nativeInventoryComplete,sourceScopeComplete:false,lifecycleCleanupAllowed:false,wholeCompanyGlobal:null,wholeCompanyIndia:null}
  for(const job of selected)Object.assign(job,{scrapedAt:now,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,sourceNativeInventoryEvidence:{...inventorySummary}})
  Object.defineProperty(selected,'sourceAudit',{value:audit});await settings.onAudit?.(structuredClone(audit));signal?.throwIfAborted();await settings.onRecords?.(structuredClone(all));signal?.throwIfAborted()
  attachSourceObservationEvidence(selected,{source:SOURCE,recordKind:all.some(job=>job.sourceNativePostKind!=='job')?'mixed':'vacancy-rows',observedRecordCount:all.length,observedVacancyCount:all.filter(job=>job.sourceNativePostKind==='job').length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  return attachInventoryEvidence(selected,{status:complete?all.length?'complete-inventory':'verified-empty':'discovery-only',surface:CAREERS_URL,firstParty:true,listingComplete:complete,pagesFetched:requests,reportedTotal:complete?all.length:null,indiaFacetCount:complete?india.length:null,verifiedAt:now,reason:complete?'financialtimes-native-inventory-reconciled':'financialtimes-native-partial:'+ [...reasons].join(';')})
} })
export const run = options => createFinancialTimesScraper().run(options)
