import {readNativeDocument,decodeNativeEntities,readNativeAttributeTokens} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {eightfoldDocument} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {nativeDate} from '../../scraper-support/native-sources/declaredAshby/nativeData.js'
import {NATIVE_INDIA_LOCATION} from '../../scraper-support/utils/greenhouseLocations.js'
import {VERSION,sha,need,originalJSON} from './currentProgrammeRenderer.js'

export const HOME='https://www.datafold.com/careers/'
export const BOARD='https://jobs.ashbyhq.com/datafold'
export const API='https://api.ashbyhq.com/posting-api/job-board/datafold'
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const has=(value,key)=>Object.hasOwn(value,key)
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
export const keys=(value,names)=>value&&typeof value==='object'&&!Array.isArray(value)
 &&same(Object.keys(value).sort(),[...names].sort())
const shape=(value,names,message)=>need(keys(value,names.split(' ')),message)
export const header=(packet,name)=>packet.headers?.get?.(name)??Object.entries(packet.headers||{}).find(([key])=>key.toLowerCase()===name)?.[1]??null
const active=({node,ancestors})=>!node.inert&&!node.nativeTagUnqualified
 &&!ancestors.some(parent=>parent.inert||parent.nativeTagUnqualified||['svg','math','template','object','noscript'].includes(parent.tag))

const securityNames=['content-security-policy','content-security-policy-report-only','x-content-type-options','cross-origin-embedder-policy',
 'cross-origin-opener-policy','cross-origin-resource-policy','permissions-policy','document-policy','x-frame-options']
export const securitySnapshot=packet=>Object.fromEntries(securityNames.map(name=>[name,header(packet,name)]))
const unsupportedControlHeaders=['refresh','location','content-location','content-disposition','www-authenticate','proxy-authenticate',
 'authentication-info','proxy-authentication-info','cf-mitigated','cf-chl-out','cf-chl-bypass','x-captcha','x-captcha-required','x-challenge']
export function qualifySecurityProfile(packet,kind,nonce){
 need(unsupportedControlHeaders.every(name=>header(packet,name)===null),'Unreviewed response navigation/authentication/challenge authority header')
 const original=securitySnapshot(packet),profile={...original}
 if(['board','role'].includes(kind)){
  need(typeof nonce==='string'&&typeof profile['content-security-policy']==='string','Enforced original CSP profile unavailable')
  // Only an already validated exact script/meta/header nonce token is used to
  // classify this policy. No original bytes or closing comparisons are changed.
  profile['content-security-policy']=profile['content-security-policy'].replace("'nonce-"+nonce+"'","'nonce-[BOUND_NATIVE_NONCE]'")
 }
 const expected=['board','role'].includes(kind)?'86b662a993d53ad147f8931cd6861b8938a3353141e8f351c22e188d35e75866':
  kind==='feed'?'3e0f54da8f3b1357e0ea055b959391c0a533b0a66fff5c5758d04bb66b4d2973':'2c4ee17d6b48386d483ebefb2deefc9d6895ddb0296008f6c4d7d50ae6418640'
 need(sha(JSON.stringify(profile))===expected,'Unreviewed enforced security/CSP profile')
 return original
}

function uniqueIdentityAttributes(html){
 for(const match of html.matchAll(/<([a-z][^\s/>]*)\s+([^>]*)>/gi)){
  const tag=match[1].toLowerCase(),tokens=readNativeAttributeTokens(match[2])
  if(!['script','meta','link'].includes(tag)&&!tokens.some(([name,value])=>name==='id'&&['root','csp-nonce'].includes(decodeNativeEntities(value))))continue
  const seen=new Set()
  for(const[name]of tokens){need(!seen.has(name),'Duplicate native carrier/mount identity attribute');seen.add(name)}
 }
}

// The current complete corporate body is deliberately narrow. It binds the
// reviewed all-jobs+tiers executable programme, visible mount and every other
// current recruitment declaration. Any body drift requires a new review; the
// marketing empty/error message is never used as inventory evidence.
export function readHome(packet){
 need(packet.hash==='894a61681b6b6ee55c4ffb6fcde89a0ff23bbfb2846fbb9b28be488016bfbb39','Unreviewed whole corporate programme/authority body')
 const parsed=eightfoldDocument(packet.text),visible=readVisibleNativeDocument(packet.text,{strict:true})
 const mounts=parsed.entries.filter(({node})=>node.attrs.id==='careers-jobs-root')
 need(mounts.length===1&&active(mounts[0])&&visible.nodes(n=>n.attrs.id==='careers-jobs-root').length===1,'Unique active corporate programme mount unavailable')
 const carriers=parsed.entries.filter(({node})=>node.tag==='script'&&node.raw?.includes('const ASHBY_ORG'))
 need(carriers.length===1&&active(carriers[0])&&!has(carriers[0].node.attrs,'src')&&!has(carriers[0].node.attrs,'nomodule')
  &&!carriers[0].node.attrs.type&&sha(carriers[0].node.raw)==='f1da389f5a20d560fc6835bcba51c569cd67f338685d08165af20645d386684a','Current active corporate all-jobs programme changed')
 return {url:HOME,htmlSHA256:packet.hash,programmeScriptSHA256:sha(carriers[0].node.raw),account:'datafold',
  programmeMapsEveryNativeJobAndCompensationTier:true,marketingEmptyMessageUsedAsEvidence:false,wholeCorporateBodyPinned:true}
}

function literal(raw){
 const match=/^\s*window\.__appData\s*=\s*/.exec(raw)
 need(match&&raw[match[0].length]==='{','Boot is not an unconditional original JSON initializer')
 const start=match[0].length;let depth=0,quoted=false,escaped=false
 for(let index=start;index<raw.length;index++){
  const char=raw[index]
  if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue}
  if(char==='"')quoted=true
  else if(char==='{'||char==='[')depth++
  else if((char==='}'||char===']')&&!--depth)return{start,end:index+1}
 }
 need(false,'Unterminated original boot JSON')
}

const bootstrapPrefix='https://cdn.ashbyprd.com/frontend_non_user/'
const bootstrapOffsets=[236,2798,3157,4035]
// Only four already reviewed literal deployment ranges are comparison slots.
// The original boot/model/HTML are retained, and a declaration is not a source
// certificate. Every other bootstrap byte remains pinned, including comments.
function bootstrapDeclaration(outside){
 need(outside.length===4929,'New or unreviewed active renderer/bootstrap length')
 const first=bootstrapOffsets[0]+bootstrapPrefix.length,version=outside.slice(first,first+40)
 need(/^[a-f0-9]{40}$/.test(version),'Unreviewed active renderer/bootstrap deployment literal')
 let comparison=outside
 for(const offset of [...bootstrapOffsets].reverse()){
  need(outside.slice(offset,offset+bootstrapPrefix.length+41)===bootstrapPrefix+version+'/',
   'Unreviewed active renderer/bootstrap literal binding')
  const at=offset+bootstrapPrefix.length
  comparison=comparison.slice(0,at)+VERSION+comparison.slice(at+40)
 }
 need(sha(comparison)==='aab6d57159f8405cedcfa4bb2263e038dd1eade57a54c46187e5ae280488cf84',
  'New or unreviewed active renderer/bootstrap bytes')
 return {version,manifestURL:bootstrapPrefix+version+'/.vite/manifest.json'}
}
const headHrefBindings=[
 [0,'cdn_assets/','favicon.svg'],[1,'cdn_assets/','favicon.png'],[2,'cdn_assets/','apple-touch-icon.png'],
 [5,'frontend_non_user/','.vite/manifest.json'],
 [6,'cdn_assets/','fonts/WhitneySSm/woff2/WhitneySSm-Book_Web.woff2'],
 [7,'cdn_assets/','fonts/WhitneySSm/woff2/WhitneySSm-Medium_Web.woff2'],
 [8,'cdn_assets/','fonts/WhitneySSm/woff2/WhitneySSm-Semibold_Web.woff2'],
 [9,'cdn_assets/','fonts/WhitneySSm/WhitneySSm.css'],
]
function qualifyHeadDeclarations(links,declaration){
 need(links.length===10,'Unreviewed native renderer/bootstrap asset declaration count')
 const comparison=structuredClone(links)
 for(const[index,area,suffix]of headHrefBindings){
  need(links[index].attrs.href==='https://cdn.ashbyprd.com/'+area+declaration.version+'/'+suffix,
   'Unreviewed native renderer/bootstrap asset declaration binding')
  comparison[index].attrs.href='https://cdn.ashbyprd.com/'+area+VERSION+'/'+suffix
 }
 // This pins the complete parsed attribute/ancestor model. It neither rewrites
 // original head markup nor claims acquisition of font/icon/media bytes.
 need(sha(JSON.stringify(comparison))==='60ea6e27f3e47bc08f10c38ae46de3e11c75278aeb2fd633f63d0fbeb7f6ceb5',
  'Unreviewed native renderer/bootstrap asset declaration')
}

export function readNative(packet,isRole=false){
 const parsed=eightfoldDocument(packet.text),entries=parsed.entries
 uniqueIdentityAttributes(parsed.normalized)
 need(!entries.some(({node,ancestors})=>['svg','math'].includes(node.tag)
  &&!ancestors.some(parent=>parent.inert||['template','noscript','object'].includes(parent.tag))),
 'Unsupported active foreign-namespace programme representation')
 const visible=readVisibleNativeDocument(packet.text,{strict:true})
 const scripts=entries.filter(({node})=>node.tag==='script'),boots=scripts.filter(({node})=>node.raw?.includes('window.__appData'))
 need(boots.length===1&&active(boots[0])&&boots[0].ancestors.map(n=>n.tag).join('/')==='root/html/body','Unique active HTML boot carrier unavailable')
 const boot=boots[0].node
 need(keys(boot.attrs,['nonce'])&&typeof boot.raw==='string','Unreviewed boot attributes/src/type/nomodule')
 const range=literal(boot.raw),rawJSON=boot.raw.slice(range.start,range.end)
 const rendererSourceDeclaration=bootstrapDeclaration(boot.raw.slice(0,range.start)+'[ORIGINAL_NATIVE_MODEL]'+boot.raw.slice(range.end))
 const mounts=entries.filter(({node})=>node.attrs.id==='root')
 need(mounts.length===1&&active(mounts[0])&&visible.nodes(n=>n.attrs.id==='root').length===1,'Unique visible native mount unavailable')
 need(visible.text(visible.nodes(n=>n.tag==='root')[0])==='','Unreviewed visible native role/card/control')
 const htmlProgramme=entry=>!entry.node.nativeTagUnqualified&&!entry.ancestors.some(parent=>parent.nativeTagUnqualified||['template','noscript','svg','math','object'].includes(parent.tag))
 need(!entries.some(entry=>htmlProgramme(entry)&&['a','form','input','select','button','textarea','iframe','object','embed'].includes(entry.node.tag)),
  'Additional native programme/filter/application representation')
 const lds=scripts.filter(({node})=>node.attrs.type==='application/ld+json')
 need(scripts.length===(isRole?2:1)&&lds.length===(isRole?1:0)
  &&lds.every(entry=>active(entry)&&entry.ancestors.some(n=>n.tag==='head')&&keys(entry.node.attrs,['type'])),
  'Unreviewed or ambiguous active schema/script carrier')
 const model=originalJSON(rawJSON)
 shape(model,'ddRumApplicationId ddRumClientToken environment maintenanceMode schedulingMaintenanceMode organization posting jobBoard routerPrefix recaptchaUniversalPublicSiteKey','Unreviewed native top-level fields')
 need(model.environment==='production'&&model.maintenanceMode===false&&model.schedulingMaintenanceMode===false&&model.routerPrefix==='/',
  'Native availability/routing mode changed')
 need(sha(JSON.stringify(model.organization))==='c6793c490c7b2da4e39dadfb2f55eb6be5a3a071ca1bfaf535a18f0832e44cef','Native employer/account/theme/scope changed')
 const nonce=boot.attrs.nonce,metas=entries.filter(({node})=>node.attrs.id==='csp-nonce')
 need(typeof nonce==='string'&&/^[A-Za-z0-9_-]{43}$/.test(nonce)&&metas.length===1&&active(metas[0])
  &&metas[0].ancestors.map(n=>n.tag).join('/')==='root/html/head'
  &&metas[0].node.tag==='meta'&&keys(metas[0].node.attrs,['name','id','content'])
  &&metas[0].node.attrs.name==='csp-nonce'&&metas[0].node.attrs.content===nonce,'Original head/meta/script nonce binding changed')
 const policy=header(packet,'content-security-policy')
 const directives=typeof policy==='string'?policy.split(';').map(s=>s.trim()):[]
 const scriptDirectives=directives.filter(d=>/^script-src\s/.test(d)),token="'nonce-"+nonce+"'"
 need(scriptDirectives.length===1&&scriptDirectives[0].split(/\s+/).filter(s=>s===token).length===1
  &&[...policy.matchAll(/'nonce-[^']+'/g)].length===1,'Original CSP nonce does not bind current carrier')
 need(packet.text.split(nonce).length===3,'Unreviewed nonce occurrence model')
 qualifySecurityProfile(packet,isRole?'role':'board',nonce)
 const links=entries.filter(({node})=>node.tag==='link').map(({node,ancestors})=>({attrs:node.attrs,ancestors:ancestors.map(n=>n.tag)}))
 qualifyHeadDeclarations(links,rendererSourceDeclaration)
 const titles=entries.filter(({node})=>node.tag==='title')
 const charsets=entries.filter(({node})=>node.tag==='meta'&&has(node.attrs,'charset'))
 need(charsets.length===1&&active(charsets[0])&&keys(charsets[0].node.attrs,['charset'])
  &&charsets[0].node.attrs.charset.toLowerCase()==='utf-8'&&charsets[0].ancestors.map(n=>n.tag).join('/')==='root/html/head'
  &&!entries.some(({node})=>node.tag==='meta'&&has(node.attrs,'http-equiv')),'Unreviewed native head charset/encoding model')
 need(titles.length===1&&active(titles[0]),'Unique active native title unavailable')
 const title=decodeNativeEntities(titles[0].node.raw||'')
 if(!isRole)need(title==='Datafold Jobs'&&model.posting===null,'Native board page identity changed')
 const og=entries.filter(({node})=>node.tag==='meta'&&node.attrs.property==='og:url')
 need(og.length===1&&active(og[0])&&og[0].node.attrs.content===packet.url,'Original native OG URL identity changed')
 return {model,rawJSON,rawSchema:lds.map(({node})=>node.raw),schemas:lds.map(({node})=>originalJSON(node.raw)),title,
  originalHTML:packet.text,htmlSHA256:packet.hash,headers:packet.headers,nonce,originalCSP:policy,rendererSourceDeclaration}
}

const feedKeys='id title department team employmentType location secondaryLocations publishedAt isListed isRemote workplaceType address jobUrl applyUrl descriptionHtml descriptionPlain'
const briefKeys='id title teamId locationId locationName workplaceType employmentType secondaryLocations compensationTierSummary __typename'
const postingKeys='id title departmentName departmentExternalName locationName locationAddress workplaceType employmentType descriptionHtml isListed isConfidential teamNames secondaryLocationNames compensationTierSummary compensationTiers applicationDeadline compensationTierGuideUrl scrapeableCompensationSalarySummary compensationPhilosophyHtml applicationLimitCalloutHtml shouldAskForTextingConsent shouldAskForWhatsAppConsent candidateTextingPrivacyPolicyUrl candidateTextingTermsAndConditionsUrl legalEntityNameForTextingConsent automatedProcessingLegalNotice __typename'
export function readFeed(packet){
 const feed=originalJSON(packet.text)
 shape(feed,'jobs apiVersion','Incomplete/changed public feed envelope, pagination or error')
 need(feed.apiVersion==='1'&&Array.isArray(feed.jobs)&&feed.jobs.length<=6,'Public feed count/version bound')
 const ids=new Set()
 for(const job of feed.jobs){
  shape(job,feedKeys,'Unreviewed public job fields')
  need(typeof job.id==='string'&&UUID.test(job.id)&&!ids.has(job.id)&&job.isListed===true,'Duplicate/malformed/unlisted public role')
  ids.add(job.id)
  need(job.jobUrl===BOARD+'/'+job.id&&job.applyUrl===job.jobUrl+'/application','Public own/application URL changed')
 }
 return feed
}

export function readBoard(native,feed){
 const board=native.model.jobBoard
 shape(board,'stealthAccess teams jobPostings __typename','Unreviewed native board/termination model')
 need(board.__typename==='JobBoard'&&board.stealthAccess===false&&Array.isArray(board.teams)&&Array.isArray(board.jobPostings)
  &&board.jobPostings.length===feed.jobs.length,'Stealth/incomplete or mismatched native board count')
 const teams=new Map(),ids=new Set()
 for(const team of board.teams){
  shape(team,'id name externalName parentTeamId __typename','Unreviewed native team model')
  need(UUID.test(team.id)&&!teams.has(team.id)&&typeof team.name==='string'&&team.name.length>0
   &&(team.externalName===null||typeof team.externalName==='string')&&(team.parentTeamId===null||UUID.test(team.parentTeamId))&&team.__typename==='Team','Invalid/duplicate team forest')
  teams.set(team.id,team)
 }
 for(const team of teams.values()){
  const ancestors=new Set([team.id]);let parent=team.parentTeamId
  while(parent!==null){need(teams.has(parent)&&!ancestors.has(parent),'Orphan or cyclic team would omit native cards');ancestors.add(parent);parent=teams.get(parent).parentTeamId}
 }
 for(const brief of board.jobPostings){
  shape(brief,briefKeys,'Unreviewed native card fields')
  need(UUID.test(brief.id)&&!ids.has(brief.id)&&teams.has(brief.teamId)&&UUID.test(brief.locationId)&&brief.__typename==='JobPostingBriefsWithIdsAndTeamId','Missing/duplicate/orphan native card')
  ids.add(brief.id)
 }
 need(feed.jobs.every(record=>ids.has(record.id)),'Native board/API unique IDs disagree')
 return board
}

// USA is explicitly published as ISO3 in every original address and applicant
// model; it is not a country inferred from Remote or an American city.
export const publishedCountry=value=>typeof value==='string'?(value==='USA'?'United States':nativeCountryName(value)):null
function addressCountries(address,country){
 for(const[key,value]of Object.entries(address)){
  if(key==='@type'||key==='addressCountry')continue
  need(value===null||typeof value==='string','Unreviewed nested country/address value')
  if(typeof value!=='string')continue
  need(!/\bIndia(?:n)?\b/i.test(decodeNativeEntities(value)),'Contradictory explicit written address country')
  writtenCountries(decodeNativeEntities(value),country)
  for(const component of value.split(/[,;|/()[\]]|\s+[-–—]\s+/u)){
   const label=component.trim(),explicit=label.length>2?publishedCountry(label):null
   need(!explicit||explicit===country,'Contradictory explicit written address country')
  }
 }
}

const countryLabels=(()=>{
 const display=new Intl.DisplayNames(['en'],{type:'region'}),result=new Set()
 for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
  const code=String.fromCharCode(a,b),name=display.of(code)
  if(name!==code&&name.length>2&&nativeCountryName(name))result.add(name)
 }
 return [...result].sort((a,b)=>b.length-a.length)
})()
function writtenCountries(authored,country){
 // A supported Indian city is a reason to withhold this zero-only contract;
 // it never changes a native country or creates an India-positive record.
 need(!NATIVE_INDIA_LOCATION.test(authored),'Explicit India/city eligibility scope unresolved')
 for(const label of countryLabels){
  if(nativeCountryName(label)===country)continue
  const expression=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  need(!new RegExp('(?:^|[^\\p{L}])'+expression+'(?=$|[^\\p{L}])','iu').test(authored),'Additional written country/eligibility scope unresolved')
 }
}

const authoredBlocks=new Set(['p','div','section','article','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote','table','tr','th','td','dl','dt','dd'])
const authoredTags=new Set(['root',...authoredBlocks,'br','strong','b','em','i','u','s','span','code','small','sup','sub','a'])
// Join authored inline text directly and retain block/BR boundaries. Country
// checks must see Ind<span>ia</span> exactly as a word. This projection never
// changes the original HTML/JSON, and never executes source markup or scripts.
function authoredText(html,nativePlain=false){
 need(typeof html==='string','Unreviewed authored text channel')
 for(const match of html.matchAll(/<([a-z][^\s/>]*)\s+([^>]*)>/gi)){
  const seen=new Set()
  for(const[name]of readNativeAttributeTokens(match[2])){
   need(!seen.has(name),'Duplicate authored eligibility attribute');seen.add(name)
  }
 }
 const doc=readNativeDocument(html)
 const walk=node=>{
  need(!node.inert&&!node.nativeTagUnqualified&&authoredTags.has(node.tag),'Unreviewed authored criteria carrier/visibility')
  for(const[name,value]of Object.entries(node.attrs)){
   const style=node.tag==='p'||node.tag==='ul'?'min-height:1.5em':
    node.tag==='div'?'min-height:1.2em;margin-top:0px;margin-bottom:0px':null
   need(name==='style'&&style!==null&&value===style
    ||node.tag==='a'&&(name==='href'&&typeof value==='string'||name==='target'&&value==='_blank'
     ||name==='rel'&&value==='noopener noreferrer nofollow'),
   'Unreviewed authored criteria/eligibility carrier/style/attribute')
  }
  if(node.tag==='br')return '\n'
  let text=node.children.map(child=>typeof child==='string'?decodeNativeEntities(child):walk(child)).join('')
  // These three native plaintext presentation rules are demonstrated by both
  // actual full descriptions. Case remains exact everywhere outside headings;
  // list markers and link targets are added rather than erased from criteria.
  if(nativePlain&&/^h[1-6]$/.test(node.tag))text=text.toUpperCase()
  if(nativePlain&&node.tag==='li')text=' - '+text
  if(node.tag==='a'){
   need(typeof node.attrs.href==='string','Unreviewed authored link target')
   text+=' '+node.attrs.href
  }
  return (authoredBlocks.has(node.tag)?'\n':'')+text+(authoredBlocks.has(node.tag)?'\n':'')
 }
 return walk(doc.nodes(node=>node.tag==='root')[0])
}
const layoutText=text=>text.normalize('NFC').replace(/\s+/gu,' ').trim()
function geography(posting,record,brief,schema){
 need(Array.isArray(record.secondaryLocations)&&!record.secondaryLocations.length&&Array.isArray(brief.secondaryLocations)&&!brief.secondaryLocations.length
  &&Array.isArray(posting.secondaryLocationNames)&&!posting.secondaryLocationNames.length,'Additional or unknown work-country scope')
 shape(record.address,'postalAddress','Unreviewed native address wrapper')
 shape(record.address.postalAddress,'addressCountry addressRegion addressLocality','Unreviewed native work-country model')
 shape(schema.jobLocation,'@type address','Unreviewed native schema location model')
 shape(schema.jobLocation.address,'@type addressLocality addressRegion addressCountry','Unreviewed native schema address model')
 need(schema.jobLocation['@type']==='Place'&&schema.jobLocation.address['@type']==='PostalAddress'&&posting.locationAddress===null,'Additional/nested own location scope')
 const country=publishedCountry(record.address.postalAddress.addressCountry)
 need(country&&country!=='India'&&publishedCountry(schema.jobLocation.address.addressCountry)===country
  &&publishedCountry(record.location)===country&&publishedCountry(posting.locationName)===country
  &&brief.locationName===record.location,'Explicit work-country disagreement or unresolved country')
 shape(schema.applicantLocationRequirements,'@type name','Unreviewed applicant-country model')
 need(schema.applicantLocationRequirements['@type']==='Country'&&publishedCountry(schema.applicantLocationRequirements.name)===country,'Applicant-country disagreement/unknown')
 addressCountries(record.address.postalAddress,country);addressCountries(schema.jobLocation.address,country)
 return country
}

function supplements(posting,schema){
 need(Array.isArray(posting.compensationTiers),'Unreviewed compensation tier collection')
 const ids=new Set()
 for(const tier of posting.compensationTiers){
  shape(tier,'id title tierSummary __typename','Unreviewed compensation tier fields')
  need(UUID.test(tier.id)&&!ids.has(tier.id)&&tier.__typename==='JobPostingCompensationTiers'
   &&(tier.title===null||typeof tier.title==='string')&&typeof tier.tierSummary==='string'&&tier.tierSummary.length>0,'Invalid/ambiguous compensation tier')
  ids.add(tier.id)
 }
 // These current nulls are retained as unknown, never replaced by defaults.
 for(const key of ['applicationDeadline','compensationTierGuideUrl','applicationLimitCalloutHtml','candidateTextingPrivacyPolicyUrl','candidateTextingTermsAndConditionsUrl','automatedProcessingLegalNotice'])
  need(posting[key]===null,'Unreviewed authored notice/deadline/application supplement: '+key)
 need(posting.shouldAskForTextingConsent===false&&posting.shouldAskForWhatsAppConsent===false&&posting.legalEntityNameForTextingConsent==='Datafold','Unreviewed consent model')
 need(posting.compensationPhilosophyHtml===null||typeof posting.compensationPhilosophyHtml==='string','Unreviewed compensation philosophy')
 if(posting.compensationTierSummary===null){
  need(!posting.compensationTiers.length&&posting.scrapeableCompensationSalarySummary===null&&!has(schema,'baseSalary'),'Unreconciled salary supplements')
 }else{
  need(typeof posting.compensationTierSummary==='string'&&posting.compensationTiers.length===1&&posting.compensationTiers[0].title===null,'Unreviewed compensation summary model')
  const salary=schema.baseSalary
  shape(salary,'@type currency value','Unreviewed salary structure')
  shape(salary.value,'@type minValue maxValue unitText','Unreviewed salary interval')
  need(salary['@type']==='MonetaryAmount'&&salary.currency==='USD'&&salary.value['@type']==='QuantitativeValue'&&salary.value.unitText==='YEAR'
   &&Number.isFinite(salary.value.minValue)&&Number.isFinite(salary.value.maxValue)&&salary.value.minValue>0&&salary.value.maxValue>=salary.value.minValue,'Invalid/foreign salary interval')
  // Exact reviewed presentation. Numeric endpoints are checked independently;
  // no punctuation/whitespace erasure can hide an authored condition.
  const match=/^\$([0-9]+)K – \$([0-9]+)K • Offers Equity • Offers Commission$/u.exec(posting.compensationTierSummary)
  need(match&&Number(match[1])*1000===salary.value.minValue&&Number(match[2])*1000===salary.value.maxValue,'Native salary summary/interval disagreement')
  const tier=posting.compensationTiers[0].tierSummary
  const tierMatch=/^Base \(OTE \$([0-9]+)K–\$([0-9]+)K, uncapped commission\) /u.exec(tier)
  need(tierMatch&&tier.endsWith(posting.compensationTierSummary)
   &&posting.scrapeableCompensationSalarySummary===`$${match[1]}K - $${match[2]}K`,'Unreviewed or contradictory native compensation terms')
  const describedOTE=[...posting.descriptionHtml.matchAll(/\$([0-9]+)K–\$([0-9]+)K OTE/gu)]
  const describedBase=[...posting.descriptionHtml.matchAll(/\bBase \$([0-9]+)K–\$([0-9]+)K\./gu)]
  need(describedOTE.length===1&&describedBase.length===1&&describedOTE[0][1]===tierMatch[1]&&describedOTE[0][2]===tierMatch[2]
   &&describedBase[0][1]===match[1]&&describedBase[0][2]===match[2],'Native compensation/full description disagreement')
 }
 return {nativeCompensationTiers:posting.compensationTiers,nativeCompensationPhilosophyHTML:posting.compensationPhilosophyHtml,
  nativeCompensationTierSummary:posting.compensationTierSummary,nativeSalary:schema.baseSalary??null,nativeDeadline:posting.applicationDeadline,
  nativeApplicationLimitHTML:posting.applicationLimitCalloutHtml,nativeAutomatedProcessingLegalNotice:posting.automatedProcessingLegalNotice,
  nativeTextingConsentLegalName:posting.legalEntityNameForTextingConsent}
}

export function readRole(native,record,brief,board,now){
 const posting=native.model.posting,schema=native.schemas[0],org=native.model.organization
 shape(posting,postingKeys,'Unreviewed own-role fields')
 const schemaKeys='@context @type title description directApply identifier datePosted hiringOrganization jobLocation employmentType jobLocationType applicantLocationRequirements'+(has(schema,'baseSalary')?' baseSalary':'')
 shape(schema,schemaKeys,'Unreviewed own JobPosting fields')
 need(posting.id===record.id&&posting.__typename==='JobPostingDetails'&&posting.isListed===true&&posting.isConfidential===false&&native.model.jobBoard===null,'Own role availability/identity changed')
 shape(schema.identifier,'@type name value','Unreviewed native role identifier')
 need(schema['@context']==='https://schema.org/'&&schema['@type']==='JobPosting'&&schema.directApply===true
  &&schema.identifier['@type']==='PropertyValue'&&schema.identifier.name==='Datafold'&&schema.identifier.value===record.id,'Original JobPosting role identity changed')
 need(typeof record.title==='string'&&record.title.length>0&&posting.title===record.title&&schema.title===record.title&&brief.title===record.title
  &&native.title===record.title+' @ Datafold','Native title identity disagreement')
 shape(schema.hiringOrganization,'@type name sameAs logo','Unreviewed hiring employer model')
 need(schema.hiringOrganization['@type']==='Organization'&&schema.hiringOrganization.name==='Datafold'
  &&schema.hiringOrganization.sameAs==='https://www.datafold.com'&&schema.hiringOrganization.logo===org.theme.logoSquareImageUrl,'Native employer/public website disagreement')
 const team=board.teams.find(value=>value.id===brief.teamId)
 need(team&&posting.departmentName===team.name&&posting.departmentExternalName===(team.externalName??team.name)
  &&record.department===team.name&&Array.isArray(posting.teamNames)&&same(posting.teamNames,[team.name]),'Native role/team forest correspondence changed')
 need(typeof posting.descriptionHtml==='string'&&posting.descriptionHtml.length>100&&posting.descriptionHtml===record.descriptionHtml
  &&schema.description===posting.descriptionHtml&&typeof record.descriptionPlain==='string'&&record.descriptionPlain.length>100,'Full original description disagreement')
 const projectedPlain=authoredText(posting.descriptionHtml,true)
 need(layoutText(projectedPlain)===layoutText(record.descriptionPlain),'Native plain/full HTML material criteria disagreement')
 const country=geography(posting,record,brief,schema)
 need(nativeDate(record.publishedAt)&&schema.datePosted===record.publishedAt.slice(0,10)&&Date.parse(record.publishedAt)<=Date.parse(now),'Invalid/contradictory native publication date')
 need(posting.workplaceType==='Remote'&&record.workplaceType==='Remote'&&brief.workplaceType==='Remote'&&record.isRemote===true
  &&schema.jobLocationType==='TELECOMMUTE','Native work-mode disagreement or unknown')
 need(posting.employmentType==='FullTime'&&record.employmentType==='FullTime'&&brief.employmentType==='FullTime'&&schema.employmentType==='FULL_TIME','Native employment-type disagreement')
 need(same(posting.compensationTierSummary,brief.compensationTierSummary),'List/detail compensation disagreement')
 const extra=supplements(posting,schema)
 const authored=[posting.descriptionHtml,record.descriptionPlain,posting.title,posting.departmentName,posting.departmentExternalName,
  posting.compensationPhilosophyHtml??'',posting.compensationTierSummary??'',...posting.compensationTiers.flatMap(tier=>[tier.title??'',tier.tierSummary])]
  .map(value=>authoredText(value)).join('\n')
 need(!/\b(?:India(?:n)?|worldwide|anywhere\s+in\s+the\s+world)\b/i.test(authored),'Additional written India/global eligibility scope unresolved')
 writtenCountries(authored,country)
 return {id:record.id,url:record.jobUrl,title:record.title,country,nativeEmployer:schema.hiringOrganization,
  nativeDatePosted:record.publishedAt,nativeSchemaDatePosted:schema.datePosted,nativeRemoteStatus:posting.workplaceType,
  descriptionHTML:posting.descriptionHtml,descriptionHTMLSHA256:sha(posting.descriptionHtml),originalDescriptionPlain:record.descriptionPlain,
  nativePlainDescriptionReconciled:true,nativePlainProjection:'Published heading uppercase, per-LI marker and own anchor target; NFC/layout whitespace only; all other case, punctuation, numeric values and word boundaries exact.',
  ...extra,originalNativePosting:posting,originalPublicRecord:record,originalSchema:schema,originalNativeJSON:native.rawJSON,
  originalJobPostingJSON:native.rawSchema[0],originalOwnHTML:native.originalHTML,originalWorkCountryModel:record.address,
  originalApplicantRequirements:schema.applicantLocationRequirements,originalHTMLSHA256:native.htmlSHA256,
  applicationVisited:false,screeningCriteriaAcquired:false,publisherLegalNameRegistryVerified:false}
}
