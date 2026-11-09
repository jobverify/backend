import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { projectAuthorVisibility, projectedIframeSources, projectedFrameContexts, executableDocument } from './nativeVisibility.js'
import { turboHireRecruitmentRecord } from '../../scraper-support/utils/turboHireNativeFacts.js'

export const CAREER_PAGE_URL = 'https://byteridge.com/careers/'
export const FRAME_URL = 'https://byteridge.com/wp-content/career/index.html'
export const CLIENT_URL = 'https://byteridge.com/wp-content/career/assets/js/career.js'
export const PROXY_URL = 'https://byteridge.com/wp-json/turbohire/v1/careerpagejobs'
export const NATIVE_ORIGIN = 'https://byteridge.turbohire.co'
export const API_ORIGIN = 'https://thapi-stage0.azurewebsites.net'
export const ORG_ID = '1c82f8f3-64fb-4912-9c5a-80143a12084c'
export const LEGAL_EMPLOYER = 'Byteridge Software Private Limited'
export const LIST_URL = API_ORIGIN + '/api/careerpagev2/filteredjobs?orgId=' + ORG_ID + '&pageType=0'
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const sha256 = value => createHash('sha256').update(value).digest('hex')
const reviewedSurfaces = JSON.parse(readFileSync(new URL('./reviewedSurfaces.json',import.meta.url),'utf8'))
export const reviewedNativeClients = reviewedSurfaces.clientSHA256 || {}
export const check = (condition, message) => { if (!condition) throw Object.assign(Error('Byteridge native source: ' + message), { code: 'BYTERIDGE_NATIVE_CONTRACT' }) }
export const norm = value => String(value ?? '').replace(/\s+/g, ' ').trim()
export const canonical = value => JSON.stringify(value, function (_key, item) {
  return item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b))) : item
})
// Role visibility uses parsed attributes, including entity-decoded/unquoted
// styles, plus the conservative source-local author-CSS projection.
export const document = html => projectAuthorVisibility(readNativeDocument(html),html)
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
export const plain = html => { const d = document(html); return d.nodes(n => n.tag === 'root').map(n => d.text(n)).join(' ') }
const compact = html => plain(html).replace(/\s/g, '')
const pathOnly = (value, base) => { const u = new URL(value, base); return u.origin + u.pathname }
const isExecutable = node => node.tag === 'script' && !['application/ld+json','application/json','text/template'].includes((node.attrs.type || '').toLowerCase())
const executable = node => isExecutable(node) && (!node.attrs.type || /^(?:module|(?:text|application)\/(?:x-)?(?:java|ecma)script)$/i.test(node.attrs.type)) && !Object.hasOwn(node.attrs,'nomodule')
const surfaceStyles = (html,_doc,base) => ({
  inlineStyleSHA256:[...String(html).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>sha256(m[1])).sort(),
  stylesheets:executableDocument(html).nodes(n=>n.tag==='link'&&n.attrs.rel==='stylesheet').map(n=>new URL(n.attrs.href,base).href).sort(),
})
const inlineClients = (doc, hash = node => sha256(node.raw||'')) => doc.nodes(n=>isExecutable(n)&&!n.attrs.src).map(hash).sort()
const corporateInlineClient = node => {
  const raw = node.raw || '', reviewed = reviewedSurfaces.corporateInlineConfigurations?.[node.attrs.id]
  if (!reviewed) return sha256(raw)
  // These exact JSON assignments contain rotating public WordPress nonces.
  // Parse without executing them, erase only the reviewed nonce value paths,
  // and keep every configuration key/value and all surrounding code pinned.
  const assignment = new RegExp('^\\s*var '+reviewed.variable+' = (\\{[^\\r\\n]*\\});\\r?\\n//# sourceURL='+node.attrs.id+'\\s*$').exec(raw)
  if (!assignment) return sha256(raw)
  try {
    const value = JSON.parse(assignment[1])
    for (const path of reviewed.noncePaths) {
      const keys = path.split('.'), key = keys.pop(), parent = keys.reduce((value, part) => value?.[part], value)
      if (!parent || typeof parent[key] !== 'string' || !/^[a-f0-9]{10}$/.test(parent[key])) return sha256(raw)
      parent[key] = '<public-nonce>'
    }
    return sha256(canonical(value)) === reviewed.semanticSHA256 ? reviewed.reviewedSHA256 : sha256(raw)
  } catch { return sha256(raw) }
}
const sameStyles = (actual,reviewed) => canonical(actual.inlineStyleSHA256)===canonical(reviewed.inlineStyleSHA256)&&canonical(actual.stylesheets)===canonical(reviewed.stylesheets)
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
  try { const u = new URL(value); return ['http:','https:'].includes(u.protocol) && ['byteridge.com','www.byteridge.com'].includes(u.hostname) && u.pathname === '/' && !u.search && !u.hash && !u.username && !u.password } catch { return false }
}
const CORPORATE_SCRIPTS = new Set([
  '/wp-includes/js/jquery/jquery.min.js','/wp-includes/js/jquery/jquery-migrate.min.js','/wp-content/themes/hello-elementor/assets/js/hello-frontend.js',
  '/wp-content/plugins/elementor/assets/js/webpack.runtime.min.js','/wp-content/plugins/elementor/assets/js/frontend-modules.min.js','/wp-includes/js/jquery/ui/core.min.js',
  '/wp-content/plugins/elementor/assets/js/frontend.min.js','/wp-content/plugins/elementor-pro/assets/lib/sticky/jquery.sticky.min.js','/wp-includes/js/imagesloaded.min.js',
  '/wp-content/plugins/elementor/assets/lib/swiper/v8/swiper.min.js','/wp-includes/js/mediaelement/mediaelement-and-player.min.js','/wp-includes/js/mediaelement/mediaelement-migrate.min.js',
  '/wp-includes/js/mediaelement/wp-mediaelement.min.js','/wp-includes/js/mediaelement/renderers/vimeo.min.js','/wp-includes/js/dist/hooks.min.js','/wp-includes/js/dist/i18n.min.js',
  '/wp-content/plugins/elementor-pro/assets/js/frontend.min.js','/wp-content/plugins/elementor-pro/assets/js/elements-handlers.min.js',
].map(p => 'https://byteridge.com' + p).concat(['https://www.youtube.com/iframe_api','https://www.google.com/recaptcha/api.js']))
const NATIVE_CLIENTS = [
  '/runtime-main.b10416b6ebb29396fa10.js','/18.2f7a4ef555996d432497.chunk.js','/30.812b9abed47cf2099f54.chunk.js','/main.4d05cc901a9accc19b6c.chunk.js',
].map(p => NATIVE_ORIGIN + p)
const NATIVE_EXTERNALS = new Set([
  'https://www.googletagmanager.com/gtag/js','https://maps.googleapis.com/maps/api/js','https://code.jquery.com/jquery-3.7.0.slim.min.js','https://checkout.razorpay.com/v1/checkout.js',
  'https://vjs.zencdn.net/7.3.0/video.min.js','https://www.webrtc-experiment.com/EBML.js','https://apis.google.com/js/platform.js','https://fast.wistia.com/assets/external/E-v1.js',
  'https://fast.wistia.com/embed/medias/iwl55pmvfx.jsonp','https://fast.wistia.com/embed/medias/fc0tvbwr6k.jsonp','https://fast.wistia.com/embed/medias/vtxfkj6k9g.jsonp',
  'https://fast.wistia.com/embed/medias/v1zlv77sxf.jsonp','https://turbohire.statuspage.io/embed/script.js',
])

export function corporateContract(html) {
  const doc = document(html), execution=executableDocument(html), reasons = []
  const styles = surfaceStyles(html,doc,CAREER_PAGE_URL)
  const reviewed = [reviewedSurfaces.corporate,...(reviewedSurfaces.corporateStyleVersions||[])].find(version=>sameStyles(styles,version))
  check(reviewed,'unreviewed corporate stylesheet visibility')
  const clients = inlineClients(execution,corporateInlineClient)
  if(canonical(clients)!==canonical(reviewed.inlineExecutableSHA256)) reasons.push('unreviewed-corporate-inline-client')
  check(doc.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical').length === 1 && doc.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical')[0].attrs.href === CAREER_PAGE_URL, 'official canonical changed')
  check(schema(doc,'Organization').some(o => o.name === 'Byteridge' && companyURL(o.url)), 'official employer identity changed')
  const activeFrames=projectedFrameContexts(doc)
  const frames = projectedIframeSources(doc).map(u => new URL(u, CAREER_PAGE_URL).href)
  const frameContexts=activeFrames.map(frame=>({hasSrc:frame.hasSrc,src:frame.src?pathOnly(frame.src,CAREER_PAGE_URL):null,hasSrcdoc:frame.hasSrcdoc,srcdocSHA256:frame.hasSrcdoc?sha256(frame.srcdoc):null,srcdocBytes:frame.hasSrcdoc?Buffer.byteLength(frame.srcdoc):0}))
  check(frames.filter(u => u === FRAME_URL).length === 1, 'missing visible official careers iframe')
  if (activeFrames.length !== 1) reasons.push('additional-unreviewed-frame')
  const visible = doc.nodes(n => n.tag === 'body').map(n => doc.text(n)).join(' ')
  check(/OPEN POSITIONS/i.test(visible), 'missing visible open positions context')
  const extraLinks = doc.nodes(n => n.tag === 'a' && n.attrs.href).filter(n => {
    const href = n.attrs.href
    if (/^(?:mailto:|tel:|#)/i.test(href)) return false
    const u = new URL(href, CAREER_PAGE_URL)
    return /(?:career|job|hiring|vacanc|open.position|work.with|join.our.team|ats)/i.test(u.href + ' ' + doc.text(n)) && u.href !== CAREER_PAGE_URL
  }).map(n => pathOnly(n.attrs.href, CAREER_PAGE_URL))
  if (extraLinks.length) reasons.push('additional-unreviewed-hiring-path')
  const scripts = execution.nodes(n => isExecutable(n) && n.attrs.src).map(n => pathOnly(n.attrs.src, CAREER_PAGE_URL))
  if (scripts.some(u => !CORPORATE_SCRIPTS.has(u))) reasons.push('additional-unreviewed-corporate-client')
  return { reasons, frames, frameContexts, extraLinks, scripts: [...new Set(scripts)].sort(),inlineClients:clients,styles }
}
export function frameContract(html, client) {
  // Both bytes and active execution are checked before either public read-only
  // POST. This is the reviewed all-teams Angular client, not a guessed API.
  check(sha256(html) === '3650f4f2200ddd181f05b00d63ef53c951a83fc115c1de634b3e36ce439dd98e', 'unreviewed official frame contract')
  check(sha256(client) === 'f7701a128edc5c8c13d6b17ece52407acea4236c4a4ff5667c69abb65565d315', 'unreviewed official executable client')
  // ng-cloak initially hides the Angular body until the reviewed controller
  // starts. CSS visibility does not prevent script execution in this shell.
  const doc = executableDocument(html), nodes = doc.nodes(n => n.tag === 'script' && n.attrs.src && new URL(n.attrs.src, FRAME_URL).href === CLIENT_URL)
  check(nodes.length === 1 && executable(nodes[0]), 'careers client is not executable')
  return { frameSHA256: sha256(html), clientSHA256: sha256(client) }
}
export function nativePageContract(html, expected) {
  const doc = document(html),execution=executableDocument(html)
  const elements = documentElements(doc)
  check(sameStyles(surfaceStyles(html,doc,NATIVE_ORIGIN),reviewedSurfaces.native),'unreviewed native stylesheet visibility')
  check(canonical(inlineClients(execution))===canonical(reviewedSurfaces.native.inlineExecutableSHA256),'unreviewed native executable inline client')
  check(!elements.some(n => n.tag === 'base'), 'unreviewed native base')
  const scripts = execution.nodes(n => n.tag === 'script' && n.attrs.src)
  const native = scripts.filter(n => new URL(n.attrs.src, NATIVE_ORIGIN).origin === NATIVE_ORIGIN)
  const clientURLs = [NATIVE_CLIENTS,...(reviewedSurfaces.nativeClientVersions||[]).map(version=>version.scriptURLs)].find(urls => native.length === urls.length && native.every(n => executable(n) && !Object.hasOwn(n.attrs,'integrity') && urls.includes(new URL(n.attrs.src, NATIVE_ORIGIN).href)) && new Set(native.map(n => new URL(n.attrs.src, NATIVE_ORIGIN).href)).size === urls.length)
  check(clientURLs, 'native public client version/execution drift')
  check(scripts.filter(n => new URL(n.attrs.src, NATIVE_ORIGIN).origin !== NATIVE_ORIGIN).every(n => executable(n) && NATIVE_EXTERNALS.has(pathOnly(n.attrs.src, NATIVE_ORIGIN))), 'unreviewed external native client')
  check(projectedFrameContexts(doc).length === 0, 'unreviewed native frame')
  const roots = doc.nodes(n => n.tag === 'div' && n.attrs.id === 'root')
  check(roots.length === 1 && elements.find(n => n.attrs.id === 'root') === roots[0], 'missing or shadowed active public application root')
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
  const roleLinks=doc.nodes(n=>n.tag==='a'&&n.attrs.href).map(n=>new URL(n.attrs.href,NATIVE_ORIGIN)).filter(u=>/\/job\/publicjobs\/|career|dashboard|jobs|vacanc|hiring/i.test(u.pathname)).map(u=>u.href)
  const visibleText=doc.nodes(n=>n.tag==='body').map(n=>doc.text(n)).join(' ')
  const version = reviewedSurfaces.nativeClientVersions?.find(value => canonical(value.scriptURLs) === canonical(clientURLs))
  return { posting, countries: [...new Set(countries)], clientURLs,
    publicClientURLs: version?.clientURLs || [], companyScopeUnqualified: version?.companyScopeUnqualified === true,
    roleLinks,visibleClosure:explicitClosure(visibleText) }
}
export function organizationContract(value) {
  check(value && typeof value === 'object' && !Array.isArray(value) && value.OrgID === ORG_ID, 'public organization identity changed')
  check(value.CareerPageSubdomain === 'byteridge' && companyURL(value.OrgURL) && value.IsCareerPagePublished === true, 'public organization reciprocal website/publication changed')
  if (value.OrgName) check(['Byteridge',LEGAL_EMPLOYER].includes(value.OrgName), 'public employer label changed')
  return { OrgID:value.OrgID, CareerPageSubdomain:value.CareerPageSubdomain, OrgURL:value.OrgURL, OrgName:value.OrgName, IsCareerPagePublished:value.IsCareerPagePublished }
}
const publicOrgReference = (value, { requirePublished = true } = {}) => {
  // FilteredJobs carries a sparse OrgDetails projection whose boolean defaults
  // include false. Publication is proved by full organization + public job DTO.
  check(value && typeof value === 'object' && value.OrgID === ORG_ID && (!requirePublished || value.IsCareerPagePublished === true), 'role organization mismatch')
  if (value.OrgURL != null) check(companyURL(value.OrgURL), 'role organization website mismatch')
  if (value.CareerPageSubdomain != null) check(value.CareerPageSubdomain === 'byteridge', 'role tenant mismatch')
  if (value.OrgName) check(['Byteridge',LEGAL_EMPLOYER].includes(value.OrgName), 'role employer label conflict')
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
export const publicJobURL = id => API_ORIGIN + '/api/publicjobs/' + id
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
const assertPublicHTML = (raw,label) => {
  check(typeof raw==='string','invalid '+label+' content')
  check(!/<(?:style|link|script|iframe|object|embed)\b/i.test(raw), 'unreviewed '+label+' executable/style content')
  check(![...raw.matchAll(/<!--([\s\S]*?)-->/g)].some(match=>/\S/.test(match[1])),'unreviewed '+label+' comment content')
  const doc=document(raw),root=doc.nodes(n=>n.tag==='root')[0]
  const containsText=node=>typeof node==='string'?/\S/.test(node):Boolean(node.raw&&/\S/.test(node.raw))||(node.children||[]).some(containsText)
  const visit=node=>{
    // A description is a body fragment. Raw document-title text is metadata,
    // not rendered criteria; document HEAD identity readers remain unchanged.
    check(!(node.inert||node.tag==='title')||!containsText(node), 'hidden/inert/non-rendering '+label+' content cannot be published')
    for(const child of node.children||[])if(typeof child!=='string')visit(child)
  }
  visit(root)
  return raw
}
const section = (dto, name) => {
  const v2 = dto[name+'V2'], legacy = dto[name]
  check(v2 == null || typeof v2 === 'string', 'invalid full description section')
  check(legacy == null || typeof legacy === 'string', 'invalid legacy description section')
  const selected = v2 || legacy || ''
  if (v2 && legacy) check(compact(v2) === compact(legacy), 'description versions disagree')
  if (selected) {
    assertPublicHTML(selected,'description')
    check(plain(selected).length > 0, 'inert full description section')
  }
  return selected
}
const typedCountryContract = dto => check(!Object.keys(dto).some(k => k !== 'Location' && /country|joblocation|address|locations/i.test(k)), 'unreviewed typed role country field')
const roleCountry = (dto, html, native) => {
  const schemaCountries=native.countries
  check(!Object.keys(dto).some(k => k !== 'Location' && /country|joblocation|address|locations/i.test(k)), 'unreviewed typed role country field')
  check(typeof dto.Location === 'string', 'missing native locations')
  const locations = JSON.parse(dto.Location)
  check(Array.isArray(locations) && locations.length > 0 && locations.length <= 64, 'invalid native locations')
  // The current Remote (India) role projects Location as [{}]. Its complete
  // public role body and singleton typed JobPosting independently name India;
  // neither an employer address nor an inferred city supplies the country.
  // The caller already reconciled role ID/title, full body and lifecycle.
  if(locations.length===1&&locations[0]&&typeof locations[0]==='object'&&!Array.isArray(locations[0])&&Object.keys(locations[0]).length===0){
    const labels=[...plain(html).matchAll(/\bLocation\s*:\s*([\s\S]*?)(?=\bLocation\s*:|\b(?:Department|Role Overview|Role|Experience|Employment Type)\s*:|$)/gi)].map(match=>norm(match[1]))
    check(labels.length===1&&labels[0]==='Remote (India)','empty native location lacks explicit same-role Remote (India)')
    const places=[native.posting.jobLocation].flat(),place=places[0],address=place?.address
    check(places.length===1&&place?.['@type']==='Place'&&Object.keys(place).every(key=>['@type','address'].includes(key))
      &&address?.['@type']==='PostalAddress'&&Object.keys(address).every(key=>['@type','addressCountry'].includes(key))
      &&address.addressCountry==='India'&&canonical(native.countries)===canonical(['India']),'empty native location has conflicting or ambiguous typed schema country/address')
    return{addresses:[],indiaAddresses:[],countries:['India'],remote:true,location:'Remote, India',method:'same-role-visible-remote-india-and-typed-schema',roleLocationLabel:labels[0]}
  }
  const addresses = locations.map(value => {
    check(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(k => ['Address','PlaceId'].includes(k)) && typeof value.Address === 'string' && value.Address.trim() && (value.PlaceId == null || typeof value.PlaceId === 'string'), 'unreviewed typed native location')
    return value.Address.trim()
  })
  const countries = [], remote = addresses.some(a => /^remote(?: job)?$/i.test(a))
  for (const address of addresses) {
    if (/^remote(?: job)?$/i.test(address)) continue
    const country = nativeLocationCountryName(address)
    check(country, 'unknown explicit native address country')
    countries.push(country)
  }
  const text = plain(html)
  const labels = [...text.matchAll(/\bLocation\s*:\s*([\s\S]*?)(?=\bLocation\s*:|\b(?:Department|Role Overview|Role|Experience|Employment Type)\s*:|$)/gi)].map(m => norm(m[1]))
  const indiaRemote = labels.some(label => /^(?:India\s*\(Remote\)|Remote\s*[,(-]?\s*India\s*\)?)$/i.test(label))
  for(const label of labels) {
    const explicitCountry=/^(?:India\s*\(Remote\)|Remote\s*[,(-]?\s*India\s*\)?)$/i.test(label)?'India':nativeLocationCountryName(label)
    check(explicitCountry,'unknown explicit role Location country')
    countries.push(explicitCountry)
  }
  if (remote) check(indiaRemote, 'remote role lacks explicit role-owned work country')
  if (indiaRemote) countries.push('India')
  const unique = [...new Set(countries)]
  check(unique.length > 0 && canonical([...unique].sort()) === canonical([...schemaCountries].sort()), 'native role/schema country conflict')
  const schemaAddresses=[native.posting.jobLocation].flat().map(l=>l.address.addressLocality)
  check(schemaAddresses.every(a=>typeof a==='string'&&addresses.some(b=>norm(a)===norm(b))),'native schema/detail locality conflict')
  const indiaAddresses=addresses.filter(address=>nativeLocationCountryName(address)==='India')
  return {addresses,indiaAddresses,countries:unique,remote,location:remote ? 'Remote, India' : (unique.includes('India')?indiaAddresses:addresses).join(' / ')}
}
const CRITERIA_LABELS={qualifications:'Qualifications',educationRequirements:'Education requirements',experienceRequirements:'Experience requirements',responsibilities:'Responsibilities',eligibilityToWorkRequirement:'Eligibility to work',physicalRequirement:'Physical requirements',sensoryRequirement:'Sensory requirements',securityClearanceRequirement:'Security clearance requirements',competencyRequired:'Required competencies',jobBenefits:'Job benefits'}
const escapeHTML=value=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
const structuredCriteria = posting => {
  const raw={},published=[]
  for(const [field,label]of Object.entries(CRITERIA_LABELS)) {
    const value=posting[field]
    if(value==null)continue
    check(typeof value==='string'||Array.isArray(value)&&value.every(item=>typeof item==='string'),'unsupported native structured criteria shape: '+field)
    raw[field]=value
    const values=[value].flat().filter(item=>item.trim())
    if(!values.length)continue
    const fragments=values.map(item=>{
      if(!/<\/?[a-z][a-z0-9:_-]*\b[^>]*>/i.test(item))return escapeHTML(item)
      assertPublicHTML(item,'structured criteria')
      check(plain(item).length>0,'missing visible native structured criteria')
      return item
    })
    published.push('<section data-native-criteria="'+field+'"><h3>'+label+'</h3>'+fragments.map(fragment=>'<div>'+fragment+'</div>').join('\n')+'</section>')
  }
  return {raw,publishedHTML:published.join('\n')}
}
const employmentKey=value=>typeof value==='string'?({fulltime:'full-time',parttime:'part-time',contract:'contractor',contractor:'contractor',contractual:'contractor',intern:'intern',internship:'intern',temporary:'temporary',volunteer:'volunteer',perdiem:'per-diem',other:'other'})[norm(value).toLowerCase().replace(/[\s_-]/g,'')]||null:null
const employmentContract=(dto,posting)=>{
  const primary=typeof dto.JobTypeV2==='string'&&dto.JobTypeV2.trim()?dto.JobTypeV2:typeof dto.Type==='string'&&dto.Type!=='UNSPECIFIED'?dto.Type:null
  if(posting.employmentType!=null) {
    const values=[posting.employmentType].flat(),expected=employmentKey(primary)
    check(values.length>0&&expected&&values.every(value=>employmentKey(value)===expected),'native schema/primary employment type conflict or unsupported shape')
  }
  return primary
}
const boardExpiry=container=>{
  check(container==null||typeof container==='object'&&!Array.isArray(container),'invalid native expiry container')
  const raw=container?.CAREERPAGE
  return raw==null?null:dateValue(raw,{expiry:true})
}
const customFields = fields => {
  check(Array.isArray(fields), 'invalid native custom fields')
  return fields.map(value => {
    check(value && typeof value === 'object' && typeof value.JobCustomField?.FieldName === 'string', 'invalid native custom field shape')
    const name = value.JobCustomField.FieldName
    check(!/country|location|address/i.test(name), 'unreviewed custom role country field')
    return {name,value:value.Value}
  })
}
export function roleContract(row, dto, native, proxy, now) {
  typedCountryContract(row);typedCountryContract(dto);if(proxy)typedCountryContract(proxy)
  check(dto && typeof dto === 'object' && dto.JobId === row.JobId && norm(dto.JobTitle) === norm(row.JobTitle) && dto.JobCode === row.JobCode, 'native listing/detail identity mismatch')
  check(dto.JobStatus === 'Active' && dto.IsPublic === true && dto.IsDraft === false, 'role is not active, public and published')
  check(!native.visibleClosure,'public native page visibly closed')
  const employer = publicOrgReference(dto.OrgDetails)
  publicOrgReference(row.OrgDetails,{requirePublished:false})
  check(Array.isArray(dto.PublishedJobBoards) && dto.PublishedJobBoards.includes('CAREERPAGE'), 'role not published to careers')
  check(dto.PublishedDates && typeof dto.PublishedDates === 'object' && !Array.isArray(dto.PublishedDates), 'missing role board publication')
  const posted = dateValue(dto.PublishedDates.CAREERPAGE), general = dateValue(dto.PublishedDate), expiry = boardExpiry(dto.ExpiryDates), listingExpiry=boardExpiry(row.ExpiryDates)
  check(posted.raw === row.PublishedDate && (expiry?.raw??null)===(listingExpiry?.raw??null), 'listing/detail lifecycle conflict')
  check(posted.day === native.posting.datePosted && posted.instant <= +new Date(now), 'native schema/publication conflict or future publication')
  if(expiry)check(expiry.instant > posted.instant, 'expiry precedes publication')
  if(native.posting.validThrough!=null) {
    const schemaExpiry=dateValue(native.posting.validThrough,{expiry:true})
    check(expiry&&(schemaExpiry.exact&&expiry.exact ? schemaExpiry.instant===expiry.instant : schemaExpiry.day===expiry.day),'native schema/board expiry disagreement')
  }
  // A source midnight without a timezone remains a day. Only dates certainly
  // in the future under every civil timezone can establish availability.
  if(expiry)check(expiry.exact ? expiry.instant > +new Date(now) : expiry.instant - 14*3600000 > +new Date(now), 'role expired or expiry-day boundary is ambiguous')
  check(row.Location === dto.Location, 'listing/detail location conflict')
  const description = section(dto,'JobDescription'), responsibilities = section(dto,'RolesAndResponsibilities'), eligibility = section(dto,'Eligibility')
  check(plain(description).length >= 200, 'full native description missing')
  const sections = [description,responsibilities,eligibility].filter(Boolean), html = sections.join('\n')
  assertPublicHTML(native.posting.description,'schema description')
  check(!explicitClosure(plain(html)),'explicit role closure conflicts with active DTO')
  check(compact(html) === compact(native.posting.description), 'public schema/full role body mismatch')
  const country = roleCountry(dto, html, native)
  const criteria=structuredCriteria(native.posting),fullHTML=[html,criteria.publishedHTML].filter(Boolean).join('\n')
  const employmentType=employmentContract(dto,native.posting)
  // Listing previews are deliberately clipped to 500 characters. They cannot
  // replace the complete public DTO or establish criteria completeness.
  check(Array.isArray(dto.Skills) && dto.Skills.every(s => typeof s === 'string' && s.trim()), 'invalid native skills')
  check(dto.RequisitionId == null || typeof dto.RequisitionId === 'string' && UUID.test(dto.RequisitionId), 'invalid native requisition identity')
  const custom = customFields(dto.AdditionalFields)
  const experience=dto.Experience
  check(experience && typeof experience==='object' && !Array.isArray(experience),'invalid native experience shape')
  const hasBounds=experience.MinExp!=null&&experience.MaxExp!=null
  const boundedExperience=hasBounds && typeof experience.MinExp==='number'&&typeof experience.MaxExp==='number'&&Number.isFinite(experience.MinExp)&&Number.isFinite(experience.MaxExp)&&experience.MinExp>=0&&experience.MaxExp>=experience.MinExp
  check(!hasBounds||boundedExperience,'invalid native experience bounds')
  const experienceRequired=boundedExperience ? experience.MinExp===experience.MaxExp ? experience.MinExp+' years' : experience.MinExp+'–'+experience.MaxExp+' years' : null
  const proxyState = proxy ? {jobId:proxy.JobId,title:proxy.JobTitle,jobCode:proxy.JobCode,department:proxy.Department,jobType:proxy.JobType,numberOfVacancy:proxy.NumberOfVacancy,location:proxy.Location,published:proxy.PublishedDate,expiry:proxy.PromotionExpiryDate,description:proxy.JobDescriptionV2,legacy:proxy.JobDescription,responsibilities:proxy.RolesAndResponsibilitiesV2,legacyResponsibilities:proxy.RolesAndResponsibilities,eligibility:proxy.EligibilityV2,legacyEligibility:proxy.Eligibility,skills:proxy.Skills,experience:proxy.Experience,additionalFields:customFields(proxy.AdditionalFields),applyUrl:proxy.ApplyUrl} : null
  const proxyCoherent = !proxy || proxy.JobId === dto.JobId && norm(proxy.JobTitle) === norm(dto.JobTitle) && proxy.JobCode === dto.JobCode && proxy.Location === dto.Location && proxy.PublishedDate === posted.raw && (proxy.PromotionExpiryDate??null) === (expiry?.raw??null) && compact([proxy.JobDescriptionV2 || proxy.JobDescription,proxy.RolesAndResponsibilitiesV2 || proxy.RolesAndResponsibilities,proxy.EligibilityV2 || proxy.Eligibility].filter(Boolean).join('\n')) === compact(html) && proxy.ApplyUrl === jobURL(dto.JobId)
  const requisitionId = dto.RequisitionId && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(dto.RequisitionId) ? dto.RequisitionId : null
  const nativeListingState=Object.fromEntries(['JobId','JobCode','JobTitle','Department','PublishedDate','ExpiryDates','Location','Type','CTCInfo','ShowClientName','ClientName','Experience','Skills','JobDescV2'].map(k=>[k,row[k]]))
  const semantic = {jobId:dto.JobId,title:dto.JobTitle,jobCode:dto.JobCode,requisitionId,department:dto.Department,location:dto.Location,type:dto.Type,jobType:dto.JobTypeV2,experience:dto.Experience,skills:dto.Skills,numberOfVacancy:dto.NumberOfVacancy,custom,description,responsibilities,eligibility,publishedDates:dto.PublishedDates,general:general.raw,expiryDates:dto.ExpiryDates,boards:dto.PublishedJobBoards,jobStatus:dto.JobStatus,isPublic:dto.IsPublic,isDraft:dto.IsDraft,applicationEnquiryTemplateId:dto.ApplicationEnquiryTemplateId,applicationRoleId:dto.JobIdObfuscated,employer,posting:native.posting,proxyState,nativeListingState,nativeRoleLinks:native.roleLinks}
  return {semantic, proxyCoherent, country:country.countries.includes('India') ? 'India' : country.countries.join(' / '),
    roleLinks:native.roleLinks,job:{id:dto.JobId,jobId:dto.JobId,sourceJobId:dto.JobId,requisitionId,jobCode:dto.JobCode,source:'byteridge',company:'Byteridge',legalEmployer:LEGAL_EMPLOYER,nativeApplicationTemplateId:dto.ApplicationEnquiryTemplateId || null,
      nativeHiringOrganization:structuredClone(native.posting.hiringOrganization),
      nativeSourceRecord:{nativeListing:turboHireRecruitmentRecord(row),nativeDetail:{...turboHireRecruitmentRecord(dto),RequisitionId:dto.RequisitionId??null},nativeJobPosting:structuredClone(native.posting)},
      firstEverPostedAt:null,sourcePostedDateRaw:posted.raw,sourceDateProvenance:'native-TurboHire-PublishedDates.CAREERPAGE',
      title:dto.JobTitle,sourceUrl:jobURL(dto.JobId),applyUrl:jobURL(dto.JobId),link:jobURL(dto.JobId),applicationLinkSource:'official-current-careers-proxy+native-public-client',publicRolePageFetched:true,applicationPublicContextValidated:true,applicationSubmitted:false,candidateActionsTaken:false,
      country:country.countries.includes('India') ? 'India' : country.countries.join(' / '),location:country.location,city:country.remote ? null : country.indiaAddresses.length === 1 && country.indiaAddresses[0].includes(',') ? country.indiaAddresses[0].split(',')[0] : null,remoteStatus:country.remote ? 'Remote' : null,
      department:dto.Department || null,employmentType,nativeJobType:dto.Type,nativeExperience:experience,experienceRequired,sourceExperienceRequired:experienceRequired,experienceRequiredProvenance:experienceRequired?'source':null,requiredSkills:dto.Skills,
      jobDescription:fullHTML,sourceDescription:fullHTML,nativeDescriptionSections:{JobDescriptionV2:description,RolesAndResponsibilitiesV2:responsibilities,EligibilityV2:eligibility},nativeStructuredCriteria:criteria.raw,nativeSchemaDescription:native.posting.description,
      postingDate:posted.raw,postedAt:posted.raw,nativePublicationDate:posted.raw,nativePublicationPrecision:posted.precision,nativePublicationSource:'publicjobs.PublishedDates.CAREERPAGE',nativePublicationGeneral:general.raw,nativePublishedDates:dto.PublishedDates,
      closingDate:expiry?.value??null,nativeExpiryRaw:expiry?.raw??null,nativeExpiryPrecision:expiry?.precision??null,sourceClosingDateIsExact:expiry?.exact??false,nativeExpirySource:expiry?'publicjobs.ExpiryDates.CAREERPAGE':null,nativeExpiryDates:dto.ExpiryDates??null,firstEverPublication:null,
      nativeLocationAddresses:country.addresses,nativeCountryEvidence:{addresses:country.addresses,schemaCountries:native.countries,explicitRoleLocationForRemote:country.remote,...(country.method?{method:country.method,roleLocationLabel:country.roleLocationLabel}:{})},nativeCustomFields:custom,
      sourceDetailComplete:true,sourceDetailStatus:'complete',sourceAvailabilityVerified:true,sourceActive:true,scrapedAt:now}}
}
