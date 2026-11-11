import {isDeepStrictEqual} from 'node:util'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {decodeHTML} from 'entities'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createRupeekTransport} from './transport20261111.js'
import revealProfile from './reveal20261111.json' with {type:'json'}

export const CAREERS='https://rupeek.com/about/careers'
export const CANONICAL='https://rupeek.com/careers'
const need=(ok,message)=>{if(!ok)throw Object.assign(Error('[rupeek] '+message),{abortRetries:true,code:'RUPEEK_NATIVE_CONTRACT'})}
const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const excluded=new Set(['template','blockquote','q','pre','code','noscript','style','textarea','script'])
function document(html){
 const d=readNativeDocument(html),root=d.nodes(n=>n.tag==='root')[0]
 const nodes=(predicate,subtree=root)=>{const result=[],walk=n=>{if(n.inert||excluded.has(n.tag))return;if(predicate(n))result.push(n);for(const c of n.children)if(typeof c!=='string')walk(c)};walk(subtree);return result}
 const text=n=>{const walk=x=>typeof x==='string'?decodeHTML(x):x.inert||excluded.has(x.tag)?'':x.children.map(walk).join(' ');return norm(walk(n))}
 const bases=[],walk=n=>{if(['template','noscript'].includes(n.tag))return;if(n.tag==='base')bases.push(n);for(const c of n.children)if(typeof c!=='string')walk(c)};walk(root);need(!bases.length,'unreviewed document base')
 return{nodes,text,root}
}
const one=(rows,label)=>{need(rows.length===1,'unique active '+label+' required');return rows[0]}
function revealStream(d,html){
 const all=[],programs=[],placeholders=[]
 const walk=(n,path=[])=>{
  if(typeof n==='string')return
  all.push({n,path})
  if(['template','noscript'].includes(n.tag)){if(n.attrs.id===revealProfile.placeholderID&&!path.some(p=>p.inert||excluded.has(p.tag)))placeholders.push(n);return}
  if(n.tag==='script')programs.push(n)
  for(const [name,value]of Object.entries(n.attrs))need(!/^on/i.test(name)&&!/^\s*(?:javascript|vbscript|data)\s*:/i.test(value),'unreviewed executable document surface')
  for(const c of n.children)walk(c,[...path,n])
 };walk(d.root)
 const sources=all.filter(({n})=>n.attrs.id===revealProfile.sourceID)
 need(sources.length===1&&placeholders.length===1,'unique native reveal source/placeholder required')
 const {n:source,path}=sources[0]
 need(source.tag==='div'&&source.attrs.hidden===''&&Object.keys(source.attrs).length===2&&path.at(-1)?.tag==='body'&&!path.some(n=>n.inert||excluded.has(n.tag)),'native reveal source boundary changed')
 need((html.match(/<!--\$\?--><template id="B:1"><\/template>/g)||[]).length===1,'own native suspense placeholder changed')
 const ids=[],collect=n=>{if(typeof n==='string')return;if([revealProfile.placeholderID,revealProfile.sourceID].includes(n.attrs.id))ids.push(n);for(const c of n.children)collect(c)};collect(d.root)
 need(ids.length===2,'duplicate native reveal IDs')
 const external=programs.filter(n=>n.attrs.src).map(n=>n.attrs.src)
 need(isDeepStrictEqual(external,revealProfile.externalScripts),'current executable external script set changed')
 const inline=programs.filter(n=>!n.attrs.src),hashes=[]
 for(const n of inline){
  const rawHash=createHash('sha256').update(n.raw??'').digest('hex')
  need(Object.keys(n.attrs).length===0||isDeepStrictEqual(n.attrs,{id:'_R_'})&&rawHash===revealProfile.inlineProgramSHA256[1],'reviewed classic inline executable script attributes changed')
  const raw=n.raw??''
  if(/^self\.__next_f\.push\(/.test(raw)){
   const ast=parse(raw,{ecmaVersion:'latest'}),expression=ast.body[0]?.expression,call=expression?.callee
   need(ast.body.length===1&&expression.type==='CallExpression'&&call.type==='MemberExpression'&&!call.computed&&call.property.name==='push'&&call.object.type==='MemberExpression'&&!call.object.computed&&call.object.object.name==='self'&&call.object.property.name==='__next_f'&&expression.arguments.length===1,'native flight program changed')
   const data=expression.arguments[0]
   need(data.type==='ArrayExpression'&&data.elements.length===2&&data.elements[0].type==='Literal'&&data.elements[0].value===1&&data.elements[1].type==='Literal'&&typeof data.elements[1].value==='string','native flight data must be literal-only')
  }else hashes.push(createHash('sha256').update(raw).digest('hex'))
 }
 need(isDeepStrictEqual(hashes,revealProfile.inlineProgramSHA256)&&inline.filter(n=>n.raw===revealProfile.revealCall).length===1,'current executable reveal program set changed')
 need(programs.some(n=>createHash('sha256').update(n.raw??'').digest('hex')===revealProfile.revealProgramSHA256),'reviewed native reveal routine missing')
 const projected=structuredClone(source)
 const unhide=(n,parentInert=false)=>{
  const ownHidden=Object.hasOwn(n.attrs,'hidden')||Object.hasOwn(n.attrs,'inert')||n.attrs['aria-hidden']?.toLowerCase()==='true'||/(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)/i.test(n.attrs.style??'')
  n.inert=parentInert||ownHidden||n.nativeTagUnqualified===true||excluded.has(n.tag)
  for(const c of n.children)if(typeof c!=='string')unhide(c,n.inert)
 }
 delete projected.attrs.hidden;unhide(projected)
 return projected
}
const names=(()=>{const result=new Set();for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const name=nativeCountryName(String.fromCharCode(a,b));if(name&&name.length>2)result.add(name)}return [...result].map(name=>[name,new RegExp('(?<![\\p{L}\\p{N}])'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![\\p{L}\\p{N}])','iu')])})()
export function locationCountry(value){
 const text=norm(value),written=names.filter(([,p])=>p.test(text)).map(([name])=>name)
 const typed=[...text.matchAll(/\bcountry(?:\s+code)?\s*[:=-]\s*([^,;|]+)/gi)].map(m=>nativeCountryName(m[1]))
 const exact=nativeCountryName(text)
 const found=[...new Set([...written,...typed,...(exact?[exact]:[])])]
 if(found.length!==1||!found[0]||/\b(?:not(?:\s+in)?|outside|except|excluding|non)[-\s]*India\b|\bremote\b/i.test(text))return null
 return found[0]
}
export function inspectCareers(html){
 const d=document(html),head=one(d.nodes(n=>n.tag==='head'),'publisher head')
 const title=one(d.nodes(n=>n.tag==='title',head),'publisher title'),canonical=one(d.nodes(n=>n.tag==='link'&&n.attrs.rel?.toLowerCase()==='canonical',head),'publisher canonical')
 need(norm(decodeHTML(title.raw))==='Join our team | Rupeek | Careers'&&canonical.attrs.href===CANONICAL,'verified official careers page publisher changed')
 const text=d.text(d.root),legacy=/Why join Us\??/i.test(text)&&/Engineering at Rupeek/.test(text)&&/Open Positions/.test(text)
 const current=['Excellent Growth','Wealth creation','Work that matters','Passionate, Energetic People','Innovation'].every(v=>text.includes(v))
 need(legacy||current,'verified official careers page declaration changed')
 let anchors=d.nodes(n=>n.tag==='a'&&typeof n.attrs.href==='string'&&n.attrs.href.includes('/jobs/view/'))
 // Stream identity is an HTML attribute fact, independent of quoting or
 // inactive duplicate markup. Never let an added visible card select a less
 // strict path while any current server-stream boundary remains in the page.
 let streamPresent=false
 const inspectStream=n=>{if(typeof n==='string')return;if(/^[BS]:\d+$/.test(n.attrs.id??''))streamPresent=true;for(const c of n.children)inspectStream(c)};inspectStream(d.root)
 if(streamPresent){
  const projected=revealStream(d,html)
  need(!anchors.length,'unreviewed visible role cards outside own current stream')
  anchors=d.nodes(n=>n.tag==='a'&&typeof n.attrs.href==='string'&&n.attrs.href.includes('/jobs/view/'),projected)
 }
 const rows=[]
 for(const anchor of anchors){
  const href=anchor.attrs.href;let u;try{u=new URL(href)}catch{need(false,'native role URL invalid')}
  const match=/^\/jobs\/view\/[a-zA-Z0-9%_-]+-(\d+)$/.exec(u.pathname)
  need(u.protocol==='https:'&&u.hostname==='www.linkedin.com'&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&match,'native role URL authority/identity changed')
  const p=d.nodes(n=>n.tag==='p',anchor).map(d.text),locations=p.filter(v=>/^Location\s*:/i.test(v))
  need(p.length===3&&p[0]&&locations.length===1&&locations[0]===p[1]&&p[2],'native role card fields changed')
  const location=p[1].replace(/^Location\s*:\s*/i,''),country=locationCountry(location)
  rows.push({title:p[0],location,city:location.split(',')[0].trim(),country,...(country?{}:{sourceCountryScopeUnresolved:true}),jobId:match[1],requisitionId:null,sourceUrl:href,applyUrl:href,postingDate:p[2]})
 }
 need(rows.length>0&&rows.length<=60&&new Set(rows.map(r=>r.jobId)).size===rows.length,'native role cards missing/duplicated/unbounded')
 return rows
}
export const hasOfficialRupeekCareersSignals=html=>{try{inspectCareers(html);return true}catch{return false}}
export const extractJobCardsFromCareersHtml=html=>{try{return inspectCareers(html)}catch{return []}}
const hasClass=(n,c)=>(n.attrs.class??'').split(/\s+/).includes(c)
const blocks=new Set(['p','div','li','td','th','dt','dd','section','article','aside','main','address','nav','figure','figcaption','dl','details','summary','h1','h2','h3','h4','h5','h6','br'])
function textBlocks(d,root){
 const result=[];let pending='';const flush=()=>{if(norm(pending))result.push(norm(pending));pending=''}
 const walk=n=>{if(typeof n==='string'){pending+=' '+decodeHTML(n);return}if(n.inert||excluded.has(n.tag))return;if(blocks.has(n.tag))flush();for(const c of n.children)walk(c);if(blocks.has(n.tag))flush()};walk(root);flush();return result
}
function consistentCriteria(lines,country){
 for(let i=0;i<lines.length;i++){
  let value=lines[i]
  if(/^(?:Employer|Organization(?: Name)?|Work(?:place| Location)|Job Location|Location|Country(?: code)?)\s*:?$/i.test(value))value+=': '+lines[i+(lines[i+1]===':'?2:1)]
  const employer=/^(?:Employer|Organization(?: Name)?)\s*:\s*(.+)$/i.exec(value)||/\b(?:you (?:(?:will|would) be|are) employed by|this (?:role|position|job) is (?:for|at)|(?:your |the )?employer (?:is|will be))\s+(.+?)(?:[.!]|$)/i.exec(value)
  if(employer)need(/^Rupeek(?:[.!]|$)/i.test(employer[1]),'own criteria employer conflict')
  need(!/\bRupeek\s+(?:is\s+not|isn't)\s+(?:your|the)\s+employer\b|\byou\s+(?:are not|will not be|won't be)\s+(?:employed\s+by|an?\s+employee\s+of)\s+Rupeek\b/i.test(value),'own criteria employer denial')
  const work=/^(?:Work(?:place| Location)|Job Location|Location|Country(?: code)?)\s*:\s*(.+)$/i.exec(value)||/\b(?:(?:this|the) (?:role|position|job)|(?:the )?successful candidate|you)\s+(?:will be|is|are)\s+(?:based|located)\s+in\s+(.+?)(?:[.!]|$)/i.exec(value)
  if(work){
   const own=locationCountry(work[1]),explicit=names.some(([,p])=>p.test(work[1]))||/^Country(?: code)?\s*:/i.test(value)||/\bcountry(?: code)?\s*:/i.test(work[1])||/\b(?:not|non)[-\s]*India\b/i.test(work[1])
   need(!explicit||own===country,'own criteria workplace country unresolved/conflict')
  }
 }
}
export function readRole(html,row){
 const d=document(html),head=one(d.nodes(n=>n.tag==='head'),'detail head'),canonical=one(d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical',head),'own role canonical')
 const u=new URL(canonical.attrs.href),expected=new URL(row.sourceUrl)
 need(u.protocol==='https:'&&['in.linkedin.com','www.linkedin.com'].includes(u.hostname)&&!u.port&&!u.username&&!u.password&&u.pathname===expected.pathname&&!u.search&&!u.hash,'own role canonical identity mismatch')
 const title=d.text(one(d.nodes(n=>n.tag==='h1'&&hasClass(n,'topcard__title')),'own role heading'))
 need(title===row.title,'own role title mismatch')
 const org=one(d.nodes(n=>n.tag==='a'&&hasClass(n,'topcard__org-name-link')),'own native employer'),orgURL=new URL(org.attrs.href)
 need(d.text(org)==='Rupeek'&&orgURL.protocol==='https:'&&orgURL.hostname==='in.linkedin.com'&&orgURL.pathname==='/company/rupeek'&&!orgURL.port&&!orgURL.username&&!orgURL.password,'own role publisher mismatch')
 const location=d.text(one(d.nodes(n=>n.tag==='span'&&hasClass(n,'topcard__flavor--bullet')),'own workplace'))
 need(location===row.location&&row.country&&locationCountry(location)===row.country,'own role location/country mismatch')
 const pageTitle=one(d.nodes(n=>n.tag==='title',head),'own publisher title')
 need(norm(decodeHTML(pageTitle.raw))===`${title} at Rupeek — ${location} | LinkedIn Jobs`,'own native title publisher/workplace mismatch')
 const urn=one(d.nodes(n=>n.attrs['data-semaphore-content-type']==='JOB'&&n.attrs['data-semaphore-content-urn']),'own native job URN')
 need(urn.attrs['data-semaphore-content-urn']==='urn:li:jobPosting:'+row.jobId,'own native ID mismatch')
 const section=one(d.nodes(n=>n.tag==='section'&&hasClass(n,'description')),'own description section')
 const content=one(d.nodes(n=>n.tag==='div'&&hasClass(n,'show-more-less-html__markup'),section),'own full description')
 const lines=textBlocks(d,content);consistentCriteria(lines,row.country)
 need(!/\b(?:no longer accepting applications|no longer available|position (?:is|has been) filled)\b/i.test(d.text(section)),'own role closed')
 const criteria=lines.filter(v=>!/^[-•\s]*$/.test(v)),duties=criteria.findIndex(v=>/^(?:Key\s+)?Responsibilities\s*:?(?:\s.*)?$/i.test(v)),requirements=criteria.findIndex(v=>/^(?:Eligibility|Qualifications|Requirements(?: and skills)?)\s*:?(?:\s.*)?$/i.test(v))
 const headingOnly=new Set(d.nodes(n=>/^h[1-6]$/.test(n.tag),content).map(d.text))
 for(const node of d.nodes(n=>['p','div','li'].includes(n.tag),content)){
  let plain='',formatted=false
  const walk=(n,inFormatting=false)=>{if(typeof n==='string'){if(!inFormatting)plain+=' '+decodeHTML(n);return}if(n.inert||excluded.has(n.tag))return;const bold=inFormatting||['b','strong','em'].includes(n.tag);if(bold)formatted=true;for(const c of n.children)walk(c,bold)}
  walk(node);if(formatted&&!norm(plain))headingOnly.add(d.text(node))
 }
 const labelVocabulary=/^(?:(?:about|role|summary|key|responsibilities|requirements?|qualifications?|eligibility|experience|education|skills?|required|preferred|minimum|additional|relevant|technical|professional|work|prior|knowledge|and|or|abilities|competencies|of|the|apply|now)[\s:.,/-]*)+$/i
 const substantive=value=>value.split(/\s+/).length>=5&&!headingOnly.has(value)&&!labelVocabulary.test(value)&&!/^(?:Job Title|Employer|Organization(?: Name)?|Work Location|Job Location|Location|Country|Department|Division)\s*:/i.test(value)
 need(duties>=0&&requirements>duties&&criteria.slice(duties+1,requirements).some(substantive)&&criteria.slice(requirements+1).some(substantive),'own full criteria sections missing or empty')
 const nativeCriteria=d.nodes(n=>n.tag==='li'&&hasClass(n,'description__job-criteria-item'),section).map(item=>({label:d.text(one(d.nodes(n=>n.tag==='h3'&&hasClass(n,'description__job-criteria-subheader'),item),'native criteria label')),value:d.text(one(d.nodes(n=>n.tag==='span'&&hasClass(n,'description__job-criteria-text'),item),'native criteria value'))}))
 need(nativeCriteria.length>0&&nativeCriteria.length<=8&&nativeCriteria.every(c=>c.label&&c.value)&&new Set(nativeCriteria.map(c=>c.label)).size===nativeCriteria.length,'native role criteria metadata incomplete/duplicated')
 consistentCriteria(nativeCriteria.map(c=>c.label+': '+c.value),row.country)
 const jobDescription=[...lines,...nativeCriteria.map(c=>c.label+': '+c.value)].join('\n')
 return{jobDescription,sourceDescription:jobDescription,sourceDescriptionHTML:null,sourceDetailComplete:true,fullSourceDetailQualified:true,sourceDetailFailureKind:null,sourceNativePublisherName:'Rupeek',sourceEmployerBinding:{kind:'own-native-topcard-company-link',nativeCompanyURL:org.attrs.href,legalEntityVerified:false},nativeLegalEmployer:null,publicExperienceChecked:true,skipPublicExperienceEnrichment:true,sourceNativeDetail:{canonicalURL:canonical.attrs.href,title,location,jobPostingURN:urn.attrs['data-semaphore-content-urn'],descriptionLines:lines,nativeCriteria}}
}
function assertPublicRoleAccess(html){
 const d=document(html),titles=d.nodes(n=>n.tag==='title').map(n=>norm(decodeHTML(n.raw)))
 if(titles.some(t=>/^(?:Sign [Ii]n|LinkedIn Login|Join LinkedIn|Security Verification|Access Denied|Just a moment)/.test(t)))throw Object.assign(Error('[rupeek] public native login or access wall; origin held'),{code:'RUPEEK_NATIVE_ACCESS',abortRetries:true})
}
export async function runNative(options={}){
 options.signal?.throwIfAborted()
 need(['fetchText','fetchJson','fetchResponse','fetchBytes','fetchPage','fetchHtml'].every(k=>options[k]==null),'complete native HTTP responses required; body-only callbacks unsupported')
 const max=options.maxJobs??20;need(Number.isSafeInteger(max)&&max>=1&&max<=20,'native own-detail cap must be 1..20')
 const receipts=[],session=createRupeekTransport(options,receipts)
 let observedCorporateCards=null
 try{
  const opening=await session.read(CAREERS,'html'),rows=inspectCareers(opening.text),jobs=[],proofs=new Map()
  observedCorporateCards=structuredClone(rows)
  for(const row of rows.slice(0,max)){
   session.declare(row.sourceUrl)
   const response=await session.read(row.sourceUrl,'html');assertPublicRoleAccess(response.text);let proof=null,failure=null
   try{proof=readRole(response.text,row);proofs.set(row.jobId,proof)}catch(error){failure=error.message}
   session.check()
   jobs.push({...row,...(/country|workplace|location/i.test(failure??'')?{country:null,sourceCountryScopeUnresolved:true}:{}),company:'Rupeek',source:'rupeek',sourceRecordKind:'corporate-public-role-card',sourceExperienceScopeUnresolved:true,link:row.applyUrl,nativeRequisitionId:null,nativeLegalEmployer:null,legalEmployer:null,employmentType:null,experienceRequired:null,minimumQualification:null,requiredSkills:[],jobDescription:null,sourceDescription:null,sourceDescriptionHTML:null,publicExperienceChecked:false,skipPublicExperienceEnrichment:true,sourceDetailComplete:false,sourceDetailFailureKind:failure??'own-native-criteria-unverified',sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,...proof})
  }
  const closing=await session.read(CAREERS,'html');need(isDeepStrictEqual(inspectCareers(closing.text),rows),'closing corporate role cards changed')
  for(const job of jobs){const response=await session.read(job.sourceUrl,'html');assertPublicRoleAccess(response.text);const expected=proofs.get(job.jobId);if(expected){const closing=readRole(response.text,job);need(isDeepStrictEqual(closing,expected),'closing own complete role changed')}else need(response.receipt.sha256===receipts.find(p=>p.url===job.sourceUrl).sha256,'closing held own detail changed');session.check()}
  const audit={source:'rupeek',recordKind:'corporate-public-role-cards',observedCorporateRoleCards:rows.length,ownCriteriaQualified:proofs.size,nativeVacancyTotal:null,indiaVacancyTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,originalPages:receipts,corporateRoleCards:rows,closingCorporateMatches:true,closingOwnRolesMatch:true,legalEmployerVerified:false}
  for(let i=0;i<jobs.length;i++){jobs[i].scrapedAt=options.now?.()??new Date().toISOString();if(i===0)jobs[i].sourceNativeReadEvidence=audit}
  Object.defineProperty(jobs,'sourceAudit',{value:audit});await session.race(()=>options.onAudit?.(structuredClone(audit)));session.check()
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:1,reportedTotal:null,indiaFacetCount:null,reason:'bounded-first-party-corporate-role-cards-company-scope-unverified'})
 }catch(error){
  if(error instanceof Error&&!options.signal?.aborted&&Object.isExtensible(error)){
   const retry=Object.getOwnPropertyDescriptor(error,'abortRetries');if(!retry||retry.configurable)Object.defineProperty(error,'abortRetries',{value:true,writable:true,configurable:true,enumerable:true});else if(retry.writable)error.abortRetries=true
   const packets=receipts.map(p=>({url:p.url,finalURL:p.finalUrl,status:p.status,headers:p.headers,rawBodyBase64:p.rawBodyBase64,bodyBytes:p.bytes,bodySHA256:p.sha256,requestedAt:p.requestedAt,completedAt:p.observedAt}))
   Object.defineProperty(error,'nativeEvidence',{value:{source:'rupeek',recordKind:'corporate-public-role-cards',observedCorporateRoleCards:observedCorporateCards?.length??null,corporateRoleCards:observedCorporateCards,observedListingCount:null,jobs:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,inventoryComplete:false,transportPackets:packets,retainedResponses:packets}})
  }
  throw error
 }finally{session.close()}
}
