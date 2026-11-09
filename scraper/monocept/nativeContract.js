import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { projectAuthorVisibility, projectedIframeContexts, executableDocument } from './nativeVisibility.js'
import { turboHireRecruitmentRecord } from '../../scraper-support/utils/turboHireNativeFacts.js'

export const CAREER_PAGE_URL = 'https://www.monocept.com/careers'
export const BOARD_URL = 'https://monocept.turbohire.co/careerpage/0e8227c1-c352-4202-8e40-c0aa16b6ca69'
export const DASHBOARD_URL = 'https://monocept.turbohire.co/dashboardv2'
export const NATIVE_ORIGIN = 'https://monocept.turbohire.co'
export const API_ORIGIN = 'https://thapi-stage0.azurewebsites.net'
export const ORG_ID = '0e8227c1-c352-4202-8e40-c0aa16b6ca69'
export const LEGAL_EMPLOYER = 'Monocept Consulting Pvt. Ltd.'
export const LIST_URL = API_ORIGIN + '/api/careerpagev2/filteredjobs?orgId=' + ORG_ID + '&pageType=0'
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const sha256 = value => createHash('sha256').update(value).digest('hex')
const reviewedSurfaces = JSON.parse(readFileSync(new URL('./reviewedSurfaces.json',import.meta.url),'utf8'))
export const check = (condition, message) => { if (!condition) throw Object.assign(Error('Monocept native source: ' + message), { code: 'MONOCEPT_NATIVE_CONTRACT' }) }
export const norm = value => String(value ?? '').replace(/\s+/g, ' ').trim()
export const canonical = value => JSON.stringify(value, function (_key, item) {
  return item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b))) : item
})
// The shared reader excludes templates, hidden/inert ancestors and raw fallback
// bodies. Opacity zero is also not evidence of a visible role or delegation.
const visibleHTML = html => String(html).replace(/<[a-z][a-z0-9:_-]*\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi, tag => {
  const style = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag)
  return style && /(?:^|;)\s*opacity\s*:\s*(?:0(?:\.0*)?|\.0+)\s*(?:!important\s*)?(?:;|$)/i.test(style[1] ?? style[2]) ? tag.replace(/>$/, ' hidden>') : tag
})
export const document = (html,css='') => projectAuthorVisibility(readNativeDocument(visibleHTML(html)),html+'<style>'+css+'</style>')
// The client uses document.getElementById, which retains hidden/inert IDs.
// Template elements belong to the document; their HTML fragment children do
// not. Foreign template elements retain ordinary document children; HTML
// integration points return their template children to fragment semantics.
const documentElements = doc => {
  const elements = []
  const visit = (node, inherited = 'html') => {
    const namespace = inherited === 'html' ? node.tag === 'svg' ? 'svg' : node.tag === 'math' ? 'mathml' : 'html' : inherited
    elements.push(node)
    if (namespace === 'html' && node.tag === 'template') return
    const integration = namespace === 'svg' && ['foreignobject','desc','title'].includes(node.tag)
      || namespace === 'mathml' && node.tag === 'annotation-xml' && ['text/html','application/xhtml+xml'].includes((node.attrs.encoding || '').toLowerCase())
    for (const child of node.children || []) if (typeof child !== 'string') {
      const textIntegration = namespace === 'mathml' && ['mi','mo','mn','ms','mtext'].includes(node.tag) && !['mglyph','malignmark'].includes(child.tag)
      const svgAnnotation = namespace === 'mathml' && node.tag === 'annotation-xml' && child.tag === 'svg'
      visit(child,integration || textIntegration || svgAnnotation ? 'html' : namespace)
    }
  }
  visit(doc.nodes(node => node.tag === 'root')[0])
  return elements
}
const descriptionDocument = html => {
  const doc=document(html),root=doc.nodes(n=>n.tag==='root')[0]
  const hide=node=>{node.inert=true;for(const child of node.children||[])if(typeof child!=='string')hide(child)}
  const visit=node=>{
    // Parsed attributes already decode quoted/unquoted HTML entities. CSS
    // comments are removed before recognizing a numeric zero opacity value.
    const style=(node.attrs.style||'').replace(/\/\*[\s\S]*?\*\//g,'')
    const zeroOpacity=/(?:^|;)\s*opacity\s*:\s*[+-]?(?:0+(?:\.0*)?|\.0+)(?:e[+-]?\d+)?%?\s*(?:!important\s*)?(?:;|$)/i.test(style)
    // A title raw body supplies document metadata, never rendered criteria.
    // This projection is only for descriptions; document HEAD identity stays
    // on the unmodified document() reader above.
    if(node.tag==='title'||zeroOpacity){hide(node);return}
    for(const child of node.children||[])if(typeof child!=='string')visit(child)
  }
  visit(root)
  return doc
}
export const plain = html => { const d = descriptionDocument(html); return d.nodes(n => n.tag === 'root').map(n => d.text(n)).join(' ') }
const compact = html => plain(html).replace(/\s/g, '')
const pathOnly = (value, base) => { const u = new URL(value, base); return u.origin + u.pathname }
const isExecutable = node => node.tag === 'script' && !['application/ld+json','application/json','text/template'].includes((node.attrs.type || '').toLowerCase())
const executable = node => isExecutable(node) && (!node.attrs.type || /^(?:module|(?:text|application)\/(?:x-)?(?:java|ecma)script)$/i.test(node.attrs.type)) && !Object.hasOwn(node.attrs,'nomodule')
const surfaceStyles = (html,_doc,base) => ({
  inlineStyleSHA256:[...String(html).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>sha256(m[1])).sort(),
  stylesheets:executableDocument(html).nodes(n=>n.tag==='link'&&n.attrs.rel==='stylesheet').map(n=>new URL(n.attrs.href,base).href).sort(),
})
const inlineClients = doc => doc.nodes(n=>isExecutable(n)&&!n.attrs.src).map(n=>sha256(n.raw||'')).sort()
const sameStyles = (actual,reviewed) => canonical(actual.inlineStyleSHA256)===canonical(reviewed.inlineStyleSHA256)&&canonical(actual.stylesheets)===canonical(reviewed.stylesheets)
const hiringLinks = (doc,base) => doc.nodes(n=>n.tag==='a'&&n.attrs.href).map(n=>({url:new URL(n.attrs.href,base),text:doc.text(n)})).filter(({url,text})=>['http:','https:'].includes(url.protocol)&&/career|dashboard|jobs?|vacanc|hiring|open\s*positions?|\bapply\b|join.our.team|work.with.us/i.test(url.href+' '+text)).map(({url})=>url.href)
const frameContexts = (doc,base) => projectedIframeContexts(doc).map(frame=>frame.kind==='url' ? new URL(frame.src,base).href : {kind:frame.kind,src:frame.src,...(frame.kind==='srcdoc'?{bodySHA256:sha256(frame.srcdoc??'')}:{})}).sort((a,b)=>canonical(a).localeCompare(canonical(b)))
const explicitClosure = text => /\b(?:this|the)\s+(?:job|role|position|vacancy)\s+(?:(?:is|has been|has)\s+)?(?:closed|filled|expired|removed|no longer (?:available|open|active|accepting applications)|not available)\b|\b(?:applications (?:are |have been )?closed|no longer accepting applications)\b/i.test(text)
const schema = (doc, type) => {
  const values = []
  const visit = value => {
    check(value && typeof value === 'object', 'invalid structured data')
    if (Array.isArray(value)) return value.forEach(visit)
    if ([value['@type']].flat().includes(type)) values.push(value)
    if (value['@graph']) visit(value['@graph'])
  }
  for (const node of doc.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json')) visit(JSON.parse(node.raw))
  return values
}
const companyURL = value => {
  try { const u = new URL(value); return ['http:','https:'].includes(u.protocol) && ['monocept.com','www.monocept.com'].includes(u.hostname) && u.pathname === '/' && !u.search && !u.hash && !u.username && !u.password } catch { return false }
}
const NATIVE_CLIENTS = [
  '/runtime-main.b10416b6ebb29396fa10.js','/18.2f7a4ef555996d432497.chunk.js','/30.812b9abed47cf2099f54.chunk.js','/main.4d05cc901a9accc19b6c.chunk.js',
].map(p => NATIVE_ORIGIN + p)
const NATIVE_EXTERNALS = new Set([
  'https://www.googletagmanager.com/gtag/js','https://maps.googleapis.com/maps/api/js','https://code.jquery.com/jquery-3.7.0.slim.min.js','https://checkout.razorpay.com/v1/checkout.js',
  'https://vjs.zencdn.net/7.3.0/video.min.js','https://www.webrtc-experiment.com/EBML.js','https://apis.google.com/js/platform.js','https://fast.wistia.com/assets/external/E-v1.js',
  'https://fast.wistia.com/embed/medias/iwl55pmvfx.jsonp','https://fast.wistia.com/embed/medias/fc0tvbwr6k.jsonp','https://fast.wistia.com/embed/medias/vtxfkj6k9g.jsonp',
  'https://fast.wistia.com/embed/medias/v1zlv77sxf.jsonp','https://turbohire.statuspage.io/embed/script.js',
])

export function corporateContract(html,css='') {
 const doc=document(html,css),execution=executableDocument(html),reasons=[]
 check([reviewedSurfaces.corporate,...(reviewedSurfaces.corporateStyleVersions||[])].some(reviewed=>sameStyles(surfaceStyles(html,doc,CAREER_PAGE_URL),reviewed)),'unreviewed corporate stylesheet visibility')
 const title=/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]||''
 check(/Careers/i.test(title)&&/Monocept/i.test(title),'official careers identity changed')
 const canonicalLinks=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical')
 check(canonicalLinks.length===1&&canonicalLinks[0].attrs.href===CAREER_PAGE_URL,'official canonical changed')
 check(schema(doc,'WebPage').some(p=>p.about?.name==='Monocept'&&new URL(p.about.url,CAREER_PAGE_URL).origin==='https://www.monocept.com'),'official employer identity changed')
 const links=doc.nodes(n=>n.tag==='a'&&n.attrs.href).map(n=>({url:new URL(n.attrs.href,CAREER_PAGE_URL).href,text:doc.text(n)}))
 check(links.some(n=>n.url===BOARD_URL&&/Explore Opportunities/i.test(n.text)),'missing visible official careers delegation')
 const extraLinks=links.filter(n=>/career|job|hiring|vacanc|open.position|work.with|join.our.team|\bats\b/i.test(n.url+' '+n.text)&&![CAREER_PAGE_URL,CAREER_PAGE_URL+'#',BOARD_URL].includes(n.url))
 if(extraLinks.length)reasons.push('additional-unreviewed-hiring-path')
 const frames=frameContexts(doc,CAREER_PAGE_URL)
 if(canonical(frames)!==canonical(reviewedSurfaces.corporate.frames))reasons.push('additional-unreviewed-frame')
 const scripts=execution.nodes(n=>isExecutable(n)&&n.attrs.src).map(n=>pathOnly(n.attrs.src,CAREER_PAGE_URL)).sort()
 if(canonical(scripts)!==canonical(reviewedSurfaces.corporate.scripts))reasons.push('additional-unreviewed-corporate-client')
 if(canonical(inlineClients(execution))!==canonical(reviewedSurfaces.corporate.inlineExecutableSHA256))reasons.push('unreviewed-corporate-inline-client')
 return {reasons,frames,extraLinks,hiringLinks:hiringLinks(doc,CAREER_PAGE_URL),scripts,inlineClients:inlineClients(execution),styles:surfaceStyles(html,doc,CAREER_PAGE_URL)}
}
export function clientContract(url,body){check(reviewedSurfaces.clientSHA256[url]===sha256(body),'unreviewed current native client bytes');return sha256(body)}
export function nativeShellContract(html) {
  const doc = document(html),execution=executableDocument(html)
  const elements = documentElements(doc)
  check(sameStyles(surfaceStyles(html,doc,NATIVE_ORIGIN),reviewedSurfaces.native),'unreviewed native stylesheet visibility')
  check(canonical(inlineClients(execution))===canonical(reviewedSurfaces.native.inlineExecutableSHA256),'unreviewed native executable inline client')
  check(!elements.some(n => n.tag === 'base'), 'unreviewed native base')
  const scripts = execution.nodes(n => n.tag === 'script' && n.attrs.src)
  const native = scripts.filter(n => new URL(n.attrs.src, NATIVE_ORIGIN).origin === NATIVE_ORIGIN)
  const versions = reviewedSurfaces.nativeClientVersions || [{scriptURLs:NATIVE_CLIENTS,clientURLs:Object.keys(reviewedSurfaces.clientSHA256)}]
  const version = versions.find(version => native.length === version.scriptURLs.length && native.every(n => executable(n) && !Object.hasOwn(n.attrs,'integrity') && version.scriptURLs.includes(new URL(n.attrs.src, NATIVE_ORIGIN).href)) && new Set(native.map(n => new URL(n.attrs.src, NATIVE_ORIGIN).href)).size === version.scriptURLs.length)
  check(version, 'native public client version/execution drift')
  check(scripts.filter(n => new URL(n.attrs.src, NATIVE_ORIGIN).origin !== NATIVE_ORIGIN).every(n => executable(n) && NATIVE_EXTERNALS.has(pathOnly(n.attrs.src, NATIVE_ORIGIN))), 'unreviewed external native client')
  const roots = doc.nodes(n => n.tag === 'div' && n.attrs.id === 'root')
  check(roots.length === 1 && elements.find(n => n.attrs.id === 'root') === roots[0], 'missing or shadowed active public application root')
  return {doc,execution,clientURLs:version.scriptURLs,publicClientURLs:version.clientURLs,
    companyScopeUnqualified:version.companyScopeUnqualified===true,
    hiringLinks:hiringLinks(doc,NATIVE_ORIGIN),frames:frameContexts(doc,NATIVE_ORIGIN)}
}
export function nativePageContract(html, expected) {
  const {doc,hiringLinks:roleLinks,frames,clientURLs}=nativeShellContract(html)
  const postings = schema(doc, 'JobPosting')
  check(postings.length === 1, 'missing/ambiguous public JobPosting')
  const posting = postings[0]
  check(norm(posting.title) === norm(expected.JobTitle), 'native page title mismatch')
  check(posting.hiringOrganization?.name === LEGAL_EMPLOYER && companyURL(posting.hiringOrganization.sameAs), 'native legal employer binding changed')
  check(typeof posting.description === 'string' && plain(posting.description).length >= 200, 'missing full public schema description')
  const locations = [posting.jobLocation].flat()
  check(locations.length > 0 && locations.length <= 64, 'missing native schema countries')
  const countries = locations.map(location => {
    const a = location?.address
    check(a && typeof a === 'object' && !Array.isArray(a) && Object.keys(a).every(k => ['@type','addressCountry','addressLocality','addressRegion','postalCode','streetAddress'].includes(k)), 'unreviewed native schema address')
    check(typeof a.addressCountry === 'string' && nativeCountryName(a.addressCountry), 'unknown explicit native schema country')
    return nativeCountryName(a.addressCountry)
  })
  const visibleText=doc.nodes(n=>n.tag==='body').map(n=>doc.text(n)).join(' ')
  return { posting, countries: [...new Set(countries)], clientURLs,roleLinks,frames,visibleClosure:explicitClosure(visibleText) }
}
export function organizationContract(value) {
  check(value && typeof value === 'object' && !Array.isArray(value) && value.OrgID === ORG_ID, 'public organization identity changed')
  check(value.CareerPageSubdomain === 'monocept' && companyURL(value.OrgURL) && value.IsCareerPagePublished === true, 'public organization reciprocal website/publication changed')
  if (value.OrgName) check(['Monocept',LEGAL_EMPLOYER].includes(value.OrgName), 'public employer label changed')
  return { OrgID:value.OrgID, CareerPageSubdomain:value.CareerPageSubdomain, OrgURL:value.OrgURL, OrgName:value.OrgName, IsCareerPagePublished:value.IsCareerPagePublished }
}
const publicOrgReference = (value, { requirePublished = true } = {}) => {
  // FilteredJobs carries a sparse OrgDetails projection whose boolean defaults
  // include false. Publication is proved by full organization + public job DTO.
  check(value && typeof value === 'object' && value.OrgID === ORG_ID && (!requirePublished || value.IsCareerPagePublished === true), 'role organization mismatch')
  if (value.OrgURL != null) check(companyURL(value.OrgURL), 'role organization website mismatch')
  if (value.CareerPageSubdomain != null) check(value.CareerPageSubdomain === 'monocept', 'role tenant mismatch')
  if (value.OrgName) check(['Monocept',LEGAL_EMPLOYER].includes(value.OrgName), 'role employer label conflict')
  return { OrgID:value.OrgID, ...(value.OrgURL ? {OrgURL:value.OrgURL} : {}), IsCareerPagePublished:value.IsCareerPagePublished }
}
export function listingContract(value, label) {
  check(value && typeof value === 'object' && Number.isSafeInteger(value.Total) && value.Total >= 0 && Array.isArray(value.Result) && value.Result.length <= 10000, label + ' listing shape changed')
  const reasons = [], seen = new Set(), records = []
  if (Object.keys(value).some(k => !['Total','Result'].includes(k))) reasons.push(label + '-unknown-continuation-or-metadata')
  for (const row of value.Result) {
    check(row && typeof row === 'object' && UUID.test(row.JobId) && typeof row.JobTitle === 'string' && row.JobTitle.trim(), label + ' missing source identity')
    if (seen.has(row.JobId)) { reasons.push(label + '-duplicate-native-identity'); continue }
    seen.add(row.JobId); records.push(row)
  }
  if (value.Total !== records.length) reasons.push(label + '-total-not-exhausted')
  return { total:value.Total, records, reasons }
}
export const jobURL = id => NATIVE_ORIGIN + '/job/publicjobs/' + id + '?utm_source=CareerPage'
export const publicJobURL = id => API_ORIGIN + '/api/publicjobs/' + id + '?fieldVisibility=CareerPage'
export const filteredBody = () => ({
  SortByV2:{Key:'PostedDate',Order:2}, ...Object.fromEntries(['BunitIds','Experience','JobTypes','JobTypeV2','Locations','CreatedDate','Compensation','Skills','ClientIds'].map(key => [key,{Value:null,FilterType:0}])),
  Keyword:'', Department:'', CustomFields:{},
})
export function dateValue(raw, { expiry = false } = {}) {
  check(typeof raw === 'string', 'missing native date')
  const exact = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.(\d{1,7}))?Z$/.exec(raw)
  const day = expiry && /^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.0{1,7})?)?$/.exec(raw)
  check(exact || day, 'unsupported/ambiguous native date')
  const value = exact ? exact[1]+'T'+exact[2]+'.'+(exact[3] || '').padEnd(3,'0').slice(0,3)+'Z' : day[1]+'T00:00:00.000Z'
  const instant = new Date(value)
  check(Number.isFinite(+instant) && instant.toISOString() === value, 'impossible native date')
  return {raw, value:exact ? raw : day[1], day:raw.slice(0,10), exact:Boolean(exact), instant:+instant, precision:exact ? (exact[3] ? 'fractional-second' : 'second') : 'day'}
}
const section = (dto, name) => {
  const v2 = dto[name+'V2'], legacy = dto[name]
  check(v2 == null || typeof v2 === 'string', 'invalid full description section')
  check(legacy == null || typeof legacy === 'string', 'invalid legacy description section')
  const selected = v2 || legacy || ''
  if (v2 && legacy) check(compact(v2) === compact(legacy), 'description versions disagree')
  if (selected) {
    const doc = document(selected)
    check(!/<(?:style|link|script|iframe|object|embed)\b/i.test(selected), 'unreviewed description executable/style content')
    check(plain(selected).length > 0, 'inert full description section')
  }
  return selected
}
const escapedText = value => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
const visibleDescription = html => {
  if(!html)return ''
  const doc=descriptionDocument(html),root=doc.nodes(n=>n.tag==='root')[0]
  const hasInert=node=>node.inert||(node.children||[]).some(child=>typeof child!=='string'&&hasInert(child))
  // Preserve unchanged native formatting when all content is active. A mixed
  // visible/inert section publishes only the reader-visible text; the original
  // bytes remain explicitly separate as nativeRawDescriptionSections.
  return hasInert(root)?'<p>'+escapedText(doc.text(root))+'</p>':html
}
const STRUCTURED_CRITERIA={qualifications:'Qualifications',educationRequirements:'Education Requirements',experienceRequirements:'Experience Requirements',responsibilities:'Responsibilities',eligibilityToWorkIn:'Eligibility to Work In',physicalRequirement:'Physical Requirements',sensoryRequirement:'Sensory Requirements',securityClearanceRequirement:'Security Clearance Requirements'}
const structuredCriteria = posting => {
  check(!Object.keys(posting).some(key=>/qualific|requirements?|responsib|eligib/i.test(key)&&!Object.hasOwn(STRUCTURED_CRITERIA,key)),'unreviewed structured criteria field')
  const raw={},sections=[]
  for(const[field,label]of Object.entries(STRUCTURED_CRITERIA))if(posting[field]!=null){
    const value=posting[field],values=Array.isArray(value)?value:[value]
    check(values.length>0&&values.length<=64&&values.every(v=>typeof v==='string'&&v.length<=200000&&plain(v).length>0),'unsupported structured criteria shape')
    check(values.every(v=>!/<(?:style|link|script|iframe|object|embed)\b/i.test(v)),'unreviewed structured criteria content')
    raw[field]=value
    sections.push('<section><h3>'+label+'</h3>'+values.map(v=>visibleDescription(v)).join('\n')+'</section>')
  }
  return {raw,html:sections.join('\n')}
}
const schemaEmployment = (posting,dto) => {
  if(posting.employmentType==null)return
  const normalize=value=>typeof value==='string'?value.trim().toUpperCase().replace(/[\s_-]+/g,''):null
  const known=new Set(['FULLTIME','PARTTIME','CONTRACT','CONTRACTOR','TEMPORARY','INTERN','INTERNSHIP','VOLUNTEER','PERDIEM','OTHER']),values=[posting.employmentType].flat()
  const expected=normalize(dto.JobTypeV2)
  check(values.length>0&&values.every(value=>known.has(normalize(value)))&&known.has(expected)&&values.every(value=>normalize(value)===expected),'native schema/employment disagreement or unsupported shape')
}
const typedCountryContract = dto => check(!Object.keys(dto).some(k => k !== 'Location' && /country|joblocation|address|locations/i.test(k)), 'unreviewed typed role country field')
const roleCountry = (dto, html, native) => {
  const schemaCountries=native.countries
  check(!Object.keys(dto).some(k => k !== 'Location' && /country|joblocation|address|locations/i.test(k)), 'unreviewed typed role country field')
  check(typeof dto.Location === 'string', 'missing native locations')
  const locations = JSON.parse(dto.Location)
  check(Array.isArray(locations) && locations.length > 0 && locations.length <= 64, 'invalid native locations')
  const addresses = locations.map(value => {
    check(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(k => ['Address','PlaceId'].includes(k)) && typeof value.Address === 'string' && value.Address.trim() && (value.PlaceId == null || typeof value.PlaceId === 'string'), 'unreviewed typed native location')
    return value.Address.trim()
  })
  const countries = [], addressCountries=[], remote = addresses.some(a => /^remote(?: job)?$/i.test(a))
  for (const address of addresses) {
    if (/^remote(?: job)?$/i.test(address)) {addressCountries.push(null);continue}
    const country = nativeLocationCountryName(address)
    check(country, 'unknown explicit native address country')
    countries.push(country)
    addressCountries.push(country)
  }
  const text = plain(html)
  const labels = [...text.matchAll(/\bLocation\s*:\s*([\s\S]*?)(?=\bLocation\s*:|\b(?:Department|Role Overview|Role|Experience|Employment Type|Reports to)\s*:|\||$)/gi)].map(m => norm(m[1]).replace(/[\p{Extended_Pictographic}\s]+$/gu,''))
  const indiaRemote = labels.some(label => /^(?:India\s*\(Remote\)|Remote\s*[,(-]?\s*India\s*\)?)$/i.test(label))
  for(const label of labels) {
    const explicitCountry=/^(?:India\s*\(Remote\)|Remote\s*[,(-]?\s*India\s*\)?)$/i.test(label)?'India':nativeLocationCountryName(label)
    // A city label validates locality only. Work country still comes from the
    // explicit complete native address and independent public role schema.
    const locality = value => norm(value).toLowerCase().replace(/\bgurgaon\b/g,'gurugram')
    check(explicitCountry || addresses.some(a=>locality(a).split(',').map(s=>s.trim()).includes(locality(label))), 'unknown or conflicting role Location')
    if(explicitCountry) countries.push(explicitCountry)
  }
  if (remote) check(indiaRemote, 'remote role lacks explicit role-owned work country')
  if (indiaRemote) countries.push('India')
  const unique = [...new Set(countries)]
  check(unique.length > 0 && canonical([...unique].sort()) === canonical([...schemaCountries].sort()), 'native role/schema country conflict')
  const schemaAddresses=[native.posting.jobLocation].flat().map(l=>l.address)
  const aligned=(a,index)=>typeof a.addressLocality==='string'&&norm(a.addressLocality)===norm(addresses[index])&&nativeCountryName(a.addressCountry)===(addressCountries[index]||indiaRemote&&'India')
  check(schemaAddresses.every(a=>addresses.some((_b,index)=>aligned(a,index)))&&addresses.every((_b,index)=>schemaAddresses.some(a=>aligned(a,index))),'native schema/detail locality or country hierarchy conflict')
  const selectedIndiaAddresses=addresses.filter((_a,index)=>addressCountries[index]==='India'||addressCountries[index]===null&&indiaRemote)
  const indiaRemoteSelected=selectedIndiaAddresses.some(a=>/^remote(?: job)?$/i.test(a))
  const selected=selectedIndiaAddresses.length?selectedIndiaAddresses:addresses
  return {addresses,addressCountries:addressCountries.map(c=>c||indiaRemote&&'India'),countries:unique,selectedIndiaAddresses,remote:selectedIndiaAddresses.length?indiaRemoteSelected:remote,location:selected.map(a=>/^remote(?: job)?$/i.test(a)&&indiaRemote?'Remote, India':a).join(' / ')}
}
const customFields = fields => {
  check(Array.isArray(fields) && fields.length===0, 'unreviewed public custom fields')
  return fields.map(value => {
    check(value && typeof value === 'object' && typeof value.JobCustomField?.FieldName === 'string', 'invalid native custom field shape')
    const name = value.JobCustomField.FieldName
    check(!/country|location|address/i.test(name), 'unreviewed custom role country field')
    return {name,value:value.Value}
  })
}
export function roleContract(row, dto, native, now) {
  typedCountryContract(row);typedCountryContract(dto)
  check(dto && typeof dto === 'object' && dto.JobId === row.JobId && norm(dto.JobTitle) === norm(row.JobTitle) && dto.JobCode === row.JobCode, 'native listing/detail identity mismatch')
  check(dto.JobStatus === 'Active' && dto.IsPublic === true && dto.IsDraft === false, 'role is not active, public and published')
  check(!native.visibleClosure,'public native page visibly closed')
  check(native.frames.length===0,'unreviewed native role frame')
  const employer = publicOrgReference(dto.OrgDetails)
  publicOrgReference(row.OrgDetails,{requirePublished:false})
  for(const value of [row,dto]) {
    check(!Object.keys(value).some(k=>/employer|hiringorganization/i.test(k)),'unreviewed typed employer field')
    if(value.ShowClientName&&value.ClientName)check(value.ClientName===LEGAL_EMPLOYER,'conflicting public client employer')
    if(value.CompanyUrl)check(companyURL(value.CompanyUrl),'conflicting public employer website')
    if(value.ClientCompany){
      check(typeof value.ClientCompany==='object'&&!Array.isArray(value.ClientCompany),'invalid client employer shape')
      if(value.ClientCompany.ClientName)check(value.ClientCompany.ClientName===LEGAL_EMPLOYER,'conflicting client company employer')
      if(value.ClientCompany.ClientUrl)check(companyURL(value.ClientCompany.ClientUrl),'conflicting client employer website')
    }
  }
  check(typeof dto.ApplicationEnquiryTemplateId==='string'&&UUID.test(dto.ApplicationEnquiryTemplateId)&&!/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(dto.ApplicationEnquiryTemplateId),'missing/invalid native application template identity')
  check(typeof dto.JobIdObfuscated==='string'&&dto.JobIdObfuscated.length>0,'missing public application role identity')
  check(Array.isArray(dto.PublishedJobBoards) && dto.PublishedJobBoards.includes('CAREERPAGE'), 'role not published to careers')
  check(dto.PublishedDates && typeof dto.PublishedDates === 'object' && (dto.ExpiryDates == null || typeof dto.ExpiryDates === 'object'&&!Array.isArray(dto.ExpiryDates)), 'missing role board lifecycle')
  const posted = dateValue(dto.PublishedDates.CAREERPAGE), general = dateValue(dto.PublishedDate), expiry = dto.ExpiryDates?.CAREERPAGE == null ? null : dateValue(dto.ExpiryDates.CAREERPAGE,{expiry:true})
  check(posted.raw === row.PublishedDate && canonical(dto.ExpiryDates||{}) === canonical(row.ExpiryDates||{}), 'listing/detail lifecycle conflict')
  check(posted.day === native.posting.datePosted && posted.instant <= +new Date(now), 'native schema/publication conflict or future publication')
  if(expiry) check(expiry.instant > posted.instant, 'expiry precedes publication')
  if(native.posting.validThrough!=null) {
    const schemaExpiry=dateValue(native.posting.validThrough,{expiry:true})
    check(expiry && (schemaExpiry.exact&&expiry.exact ? schemaExpiry.instant===expiry.instant : schemaExpiry.day===expiry.day),'native schema/board expiry disagreement')
  }
  // A source midnight without a timezone remains a day. Only dates certainly
  // in the future under every civil timezone can establish availability.
  if(expiry) check(expiry.exact ? expiry.instant > +new Date(now) : expiry.instant - 14*3600000 > +new Date(now), 'role expired or expiry-day boundary is ambiguous')
  check(row.Location === dto.Location, 'listing/detail location conflict')
  schemaEmployment(native.posting,dto)
  const rawDescriptionSections={JobDescriptionV2:section(dto,'JobDescription'),RolesAndResponsibilitiesV2:section(dto,'RolesAndResponsibilities'),EligibilityV2:section(dto,'Eligibility')}
  const description = visibleDescription(rawDescriptionSections.JobDescriptionV2), responsibilities = visibleDescription(rawDescriptionSections.RolesAndResponsibilitiesV2), eligibility = visibleDescription(rawDescriptionSections.EligibilityV2)
  check(plain(description).length >= 200, 'full native description missing')
  const sections = [description,responsibilities,eligibility].filter(Boolean), body = sections.join('\n'), criteria=structuredCriteria(native.posting),html=[body,criteria.html].filter(Boolean).join('\n')
  check(!explicitClosure(plain(html)),'explicit role closure conflicts with active DTO')
  check(compact(body) === compact(native.posting.description), 'public schema/full role body mismatch')
  const country = roleCountry(dto, html, native)
  // Listing previews are deliberately clipped to 500 characters. They cannot
  // replace the complete public DTO or establish criteria completeness.
  check(Array.isArray(dto.Skills) && dto.Skills.every(s => typeof s === 'string' && s.trim()), 'invalid native skills')
  check(canonical(dto.Skills)===canonical(row.Skills)&&canonical(dto.Skills)===canonical(native.posting.skills),'native listing/detail/schema skills conflict')
  check(dto.RequisitionId == null || typeof dto.RequisitionId === 'string' && UUID.test(dto.RequisitionId), 'invalid native requisition identity')
  const custom = customFields(dto.AdditionalFields)
  const experience=dto.Experience
  check(experience && typeof experience==='object' && !Array.isArray(experience)&&Object.keys(experience).every(k=>['MinExp','MaxExp'].includes(k)),'invalid native experience shape')
  const hasBounds=experience.MinExp!=null&&experience.MaxExp!=null
  const boundedExperience=hasBounds && typeof experience.MinExp==='number'&&typeof experience.MaxExp==='number'&&Number.isFinite(experience.MinExp)&&Number.isFinite(experience.MaxExp)&&experience.MinExp>=0&&experience.MaxExp>=experience.MinExp
  check(boundedExperience&&canonical(experience)===canonical(row.Experience),'invalid/conflicting native experience bounds')
  const experienceRequired=boundedExperience ? experience.MinExp===experience.MaxExp ? experience.MinExp+' years' : experience.MinExp+'–'+experience.MaxExp+' years' : null
  const requisitionId = dto.RequisitionId && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(dto.RequisitionId) ? dto.RequisitionId : null
  const nativeListingState=Object.fromEntries(['JobId','JobCode','JobTitle','Department','PublishedDate','ExpiryDates','Location','Type','CTCInfo','ShowClientName','ClientName','Experience','Skills','JobDescV2'].map(k=>[k,row[k]]))
  const semantic = {jobId:dto.JobId,title:dto.JobTitle,jobCode:dto.JobCode,requisitionId,department:dto.Department,location:dto.Location,type:dto.Type,jobType:dto.JobTypeV2,experience:dto.Experience,skills:dto.Skills,numberOfVacancy:dto.NumberOfVacancy,custom,description,responsibilities,eligibility,rawDescriptionSections,publishedDates:dto.PublishedDates,general:general.raw,expiryDates:dto.ExpiryDates,boards:dto.PublishedJobBoards,jobStatus:dto.JobStatus,isPublic:dto.IsPublic,isDraft:dto.IsDraft,applicationEnquiryTemplateId:dto.ApplicationEnquiryTemplateId,applicationRoleId:dto.JobIdObfuscated,employer,posting:native.posting,nativeListingState,nativeRoleLinks:native.roleLinks}
  return {semantic, country:country.countries.includes('India') ? 'India' : country.countries.join(' / '),
    roleLinks:native.roleLinks,job:{id:dto.JobId,jobId:dto.JobId,sourceJobId:dto.JobId,requisitionId,jobCode:dto.JobCode,source:'monocept',company:'Monocept',legalEmployer:LEGAL_EMPLOYER,nativeApplicationTemplateId:dto.ApplicationEnquiryTemplateId || null,
      nativeHiringOrganization:structuredClone(native.posting.hiringOrganization),
      nativeSourceRecord:{nativeListing:turboHireRecruitmentRecord(row),nativeDetail:{...turboHireRecruitmentRecord(dto),RequisitionId:dto.RequisitionId??null},nativeJobPosting:structuredClone(native.posting)},
      firstEverPostedAt:null,sourcePostedDateRaw:posted.raw,sourceDateProvenance:'native-TurboHire-PublishedDates.CAREERPAGE',
      title:dto.JobTitle,sourceUrl:jobURL(dto.JobId),applyUrl:jobURL(dto.JobId),link:jobURL(dto.JobId),applicationLinkSource:'official-current-first-party-handoff+native-public-client',publicRolePageFetched:true,applicationPublicContextValidated:true,applicationSubmitted:false,candidateActionsTaken:false,
      country:country.countries.includes('India') ? 'India' : country.countries.join(' / '),location:country.location,city:null,remoteStatus:country.remote ? 'Remote' : null,
      department:dto.Department || null,employmentType:dto.JobTypeV2 || null,nativeJobType:dto.Type,nativeExperience:experience,experienceRequired,sourceExperienceRequired:experienceRequired,experienceRequiredProvenance:experienceRequired?'source':null,requiredSkills:dto.Skills,
      jobDescription:html,sourceDescription:html,nativeDescriptionSections:{JobDescriptionV2:description,RolesAndResponsibilitiesV2:responsibilities,EligibilityV2:eligibility},nativeRawDescriptionSections:rawDescriptionSections,nativeStructuredCriteria:criteria.raw,nativeSchemaEmploymentType:native.posting.employmentType??null,nativeSchemaDescription:native.posting.description,
      postingDate:posted.raw,postedAt:posted.raw,nativePublicationDate:posted.raw,nativePublicationPrecision:posted.precision,nativePublicationSource:'publicjobs.PublishedDates.CAREERPAGE',nativePublicationGeneral:general.raw,nativePublishedDates:dto.PublishedDates,
      closingDate:expiry?.value??null,nativeExpiryRaw:expiry?.raw??null,nativeExpiryPrecision:expiry?.precision??null,sourceClosingDateIsExact:expiry?.exact??false,nativeExpirySource:expiry?'publicjobs.ExpiryDates.CAREERPAGE':null,firstEverPublication:null,
      nativeLocationAddresses:country.addresses,nativeLocationSchema:native.posting.jobLocation,nativeCountryEvidence:{addresses:country.addresses,addressCountries:country.addressCountries,countries:country.countries,schemaCountries:native.countries,selectedIndiaAddresses:country.selectedIndiaAddresses,explicitRoleLocationForRemote:country.remote},nativeCustomFields:custom,
      sourceDetailComplete:true,sourceDetailStatus:'complete',sourceAvailabilityVerified:true,sourceActive:true,scrapedAt:now}}
}
