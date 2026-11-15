import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const sha=value=>createHash('sha256').update(value).digest('hex'),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const problem=message=>Object.assign(Error('KPIT current native: '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(value,message)=>{if(!value)throw problem(message)},one=(values,label)=>{need(values.length===1,'missing or ambiguous '+label);return values[0]}
const norm=value=>String(value??'').replace(/\s+/g,' ').trim(),all=node=>[node,...node.children.filter(c=>typeof c!=='string').flatMap(all)]
const rootOf=d=>one(d.nodes(n=>n.tag==='root'),'native HTML root')
const byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
const nativeOrigin='https://talentojo.kpit.com',corporateOrigin='https://www.kpit.com'
const unexecutedResourceURLs=['https://www.googletagmanager.com/gtag/js?id=G-KMX4WXMZV6','https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700']
const unexecutedResources=new Set(unexecutedResourceURLs)
const reviewedFormLoaderURL='https://cxppusa1formui01cdnsa01-endpoint.azureedge.net/ind/FormLoader/FormLoader.bundle.js'
const nativeRole=/^https:\/\/talentojo\.kpit\.com\/tojo\/app\/job-apply\/#\/Career%20Portal\/([1-9]\d{3,8})$/
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
// Transport trace/cache/cookie fields cannot supply role evidence. No cookie is
// stored or replayed. Every other observed or new header remains part of the
// effective-context guard, including MIME/CSP/CORS/refresh/location policies.
const transportHeaders=new Set(['date','age','etag','expires','last-modified','cf-ray','x-azure-ref','x-ms-request-id','x-request-id','x-runtime','x-sucuri-cache','content-length','content-encoding','connection','keep-alive','transfer-encoding','server','alt-svc','cache-control','via','set-cookie','x-cache','cf-cache-status','fly-request-id','content-digest','x-ms-blob-content-md5','x-fd-int-roxy-purgeid'])
export const currentKpitHeaders=headers=>Object.fromEntries(Object.entries(headers).filter(([name])=>!transportHeaders.has(name)).sort(([a],[b])=>a.localeCompare(b)))

// Two current TranslatePress language controls receive generated PHP IDs.
// Validate the complete unique local control/dropdown bindings before replacing
// only those four literals. No job, country, text, mode or script is projected.
export function normalizeCurrentKpitDocument(html,url){
 if(new URL(url).origin!==corporateOrigin)return html
 const d=readNativeDocument(html),nodes=all(rootOf(d)),parents=new Map()
 for(const node of nodes)for(const child of node.children)if(typeof child!=='string')parents.set(child,node)
 const names=[...html.matchAll(/\btrp-shortcode-dropdown-[a-f0-9]{13}\b/g)].map(m=>m[0]),ids=[...new Set(names)]
 need(names.length===4&&ids.length===2,'current language-control literal inventory changed')
 ids.forEach((id,index)=>{
  const control=one(nodes.filter(n=>n.attrs['aria-controls']===id),'language controller'),target=one(nodes.filter(n=>n.attrs.id===id),'language dropdown')
  const wrapper=parents.get(target)
  need(names.filter(n=>n===id).length===2&&control.tag==='div'&&control.attrs.role==='button'&&control.attrs['aria-expanded']==='false'
   &&control.attrs['aria-label']==='Change language'&&d.text(control)==='English'
   &&target.tag==='div'&&target.attrs.role==='group'&&target.attrs['aria-label']==='Available languages'
   &&Object.hasOwn(target.attrs,'hidden')&&Object.hasOwn(target.attrs,'inert')
   &&wrapper===parents.get(parents.get(control))&&d.hasClass(wrapper,'trp-language-switcher'),'unreviewed language control/dropdown binding')
  html=html.replaceAll(id,'CURRENT_LANGUAGE_CONTROL_'+index)
 })
 return html
}

export function currentKpitResources(html,url){
 const d=readNativeDocument(html),resources=[]
 const walk=(node,inactive=false)=>{
  inactive||=['template','noscript','object','iframe','textarea','xmp','noembed','noframes','plaintext'].includes(node.tag)
  if(!inactive){const a=node.attrs
   if(node.tag==='script'&&a.src&&['','module','text/javascript','application/javascript'].includes((a.type??'').toLowerCase()))resources.push({tag:node.tag,attrs:a,url:new URL(a.src,url).href})
   if(node.tag==='link'&&a.href&&(a.rel??'').toLowerCase().split(/\s+/).includes('stylesheet'))resources.push({tag:node.tag,attrs:a,url:new URL(a.href,url).href})
  }
  for(const child of node.children)if(typeof child!=='string')walk(child,inactive)
 }
 walk(rootOf(d));return resources
}

export function currentKpitCards(html){
 const d=readNativeDocument(html),select=one(d.nodes(n=>n.tag==='select'&&n.attrs.name==='country'&&n.attrs.id==='country-select'),'native country selector')
 const selected=one(d.nodes(n=>n.tag==='option'&&Object.hasOwn(n.attrs,'selected'),select),'native selected country')
 need(selected.attrs.value==='India'&&d.text(selected)==='India','current own native country selection changed')
 const rows=d.nodes(n=>d.hasClass(n,'search_job_box'))
 need(rows.length===16,'current native membership changed; no empty or company-scope qualification')
 const seen=new Set()
 return rows.map(node=>{
  const link=one(d.nodes(n=>n.tag==='a'&&d.hasClass(n,'job-apply'),node),'own original native Apply anchor'),match=link.attrs.href?.match(nativeRole)
  need(match&&!seen.has(match[1])&&d.text(link)==='Apply','native application account, route or identity conflict');seen.add(match[1])
  const title=d.text(one(d.nodes(n=>n.tag==='h3',node),'complete native card title'))
  need(title,'native title unavailable')
  return{nativeID:match[1],url:link.attrs.href,title,text:d.text(node),originalNativeCard:structuredClone(node)}
 })
}

const closed=/\b(?:(?:(?:this|the)\s+)?(?:job|role|position|vacancy|opening)\s+(?:(?:is|was|has|have)\s+)?(?:(?:now|currently|already|temporarily)\s+)*(?:been\s+)?(?:(?:now|currently|already|temporarily)\s+)*(?:closed|filled|withdrawn|cancelled|canceled|expired|removed|unavailable|not\s+(?:currently\s+)?available|no\s+longer\s+(?:open|available|active))|(?:applications|recruitment|hiring)\s+(?:for\s+(?:(?:this|the)\s+)?(?:job|role|position)\s+)?(?:(?:are|is|has|have)\s+)?(?:(?:now|currently|already)\s+)*(?:been\s+)?(?:closed|ended|stopped|suspended)|(?:no\s+longer|not\s+currently)\s+accepting\s+(?:new\s+)?applications)\b/i
const criterionTags=new Set(['root','p','div','span','strong','b','em','i','u','ul','ol','li','br','h1','h2','h3','h4','h5','h6','table','tbody','thead','tr','th','td','a','pre','code','blockquote','font','sup','sub','s','hr'])
const criterionLabels={job_role:'Role',type:'Employment type',min_experience:'Minimum experience (years)',max_experience:'Maximum experience (years)',qualification:'Qualification',qualification_specialization:'Specialization',certification:'Certification',required_skills:'Essential skills',additional_skills:'Additional skills',services_deliverables:'Services and deliverables',comments:'Additional conditions',shift_timing:'Shift',travel_required:'Travel required',expected_joining_date:'Expected joining date (as published)',no_of_positions:'Openings',campus_degree:'Campus degree',campus_stream:'Campus stream'}
const criterionFields=Object.keys(criterionLabels)
const fieldText=value=>Array.isArray(value)?value.join(', '):String(value??'')
const authored=node=>typeof node==='string'?decodeNativeEntities(node):node.children.map(authored).join(' ')
export function currentKpitAuthoredRoleLinks(html){
 const d=readNativeDocument(html)
 return all(rootOf(d)).filter(node=>node.tag==='a').map(node=>({text:d.text(node),attrs:node.attrs}))
}
function fullModel(payload,card,expected){
 const {job,organization}=payload
 need(job&&organization&&organization.id===133&&organization.name==='KPIT'&&organization.url==='https://www.kpit.com'
  &&job.organization_id==='133','current native original employer/account binding changed')
 need(job.id===card.nativeID&&typeof job.code==='string'&&norm(job.code)&&norm(job.display_title||job.title)===card.title,'current native card/model ID, original code or complete title changed')
 need(job.country==='India'&&Array.isArray(job.location)&&job.location.length>0&&job.location.every(v=>typeof v==='string'&&norm(v)),'native assigned work-country or locations unqualified')
 need(job.status==='Published'&&job.resume_upload_limit_exhausted===false&&job.irrelevant_rejections_limit_exceeded===false
  &&job.has_offered_candidates===false&&job.template===''&&job.template_image==='','native current publication/application availability unqualified')
 need(typeof job.description==='string'&&job.description.trim(),'blank or untyped full native description')
 const d=readNativeDocument(job.description),root=rootOf(d),nodes=all(root),criteria=d.text(root)
 need(nodes.every(n=>criterionTags.has(n.tag)&&!n.inert&&!n.nativeTagUnqualified
  &&!Object.keys(n.attrs).some(name=>/^on/i.test(name)||['itemprop','itemscope','itemtype','hidden','inert','aria-hidden'].includes(name))), 'unreviewed native authored criteria carrier, hiding or activation')
 need(criteria.length>=200&&norm(authored(root))===criteria&&!closed.test(criteria),'full native criteria missing, hidden or explicitly unavailable')
 need(criteria.length===expected.criteriaCharacters&&sha(criteria)===expected.criteriaSHA256,'current full authored native criteria changed')
 const authoredRoleLinks=currentKpitAuthoredRoleLinks(job.description)
 need(same(authoredRoleLinks,expected.authoredRoleLinks),'current authored full-JD or alternative application references changed')
 need(authoredRoleLinks.every(link=>typeof link.attrs.href==='string'&&link.attrs.href.startsWith('https://')),'unqualified native role reference')
 const fields=Object.fromEntries(criterionFields.map(k=>[k,job[k]]))
 need(!closed.test(Object.values(fields).map(fieldText).join(' ')),'native criterion-bearing field contradicts availability')
 const description=[card.title,job.location.join(', ')+', '+job.country,'Published listing: '+card.text,
  ...criterionFields.filter(k=>job[k]!==null&&job[k]!==''&&(!Array.isArray(job[k])||job[k].length)).map(k=>criterionLabels[k]+': '+fieldText(job[k])),criteria].join('\n\n')
 return{card,job,organization,payload,criteria,fields,description,authoredRoleLinks}
}

export async function runCurrentKpit(options={}){
 options.signal?.throwIfAborted()
 need(!(options.fetchText||options.fetchPage||options.fetchJson),'original current HTTP bytes/metadata required')
 const profile=JSON.parse(fs.readFileSync(new URL('./currentProfile20261115.json',import.meta.url),'utf8'))
 const duration=options.sourceDeadlineMs??180000,interval=options.requestIntervalMs??500
 need(Number.isSafeInteger(duration)&&duration>0&&duration<=180000,'invalid bounded source deadline')
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=60000&&(interval>=500||options.fetchImpl),'invalid native host pacing')
 const observedAt=typeof options.now==='function'?options.now():new Date().toISOString();need(Number.isFinite(Date.parse(observedAt)),'invalid observation clock')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(problem('source deadline exceeded')),duration)
 const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,receipts=[],last=new Map(),gates=new Map()
 let allowed=new Set(),reads=0,total=0
 const pace=async(origin)=>{const previous=gates.get(origin)??Promise.resolve();let release;gates.set(origin,new Promise(r=>{release=r}));try{await previous;signal.throwIfAborted();const wait=interval-(performance.now()-(last.get(origin)??-Infinity));if(wait>0)await delay(wait,undefined,{signal});signal.throwIfAborted();last.set(origin,performance.now())}finally{release()}}
 const read=async(url,kind)=>{
  try{
   signal.throwIfAborted();need(allowed.has(url)&&Object.hasOwn(profile.packets,url)&&++reads<=210,'unbound native URL or read cap')
   const expected=profile.packets[url];await pace(new URL(url).origin);let size=0
   const packet=await boundedDeclaredPublicRead(url,{signal,timeoutMs:15000,overflowError:problem('native streaming byte bound'),fetchImpl:async(value,init)=>{
    const response=await(options.fetchImpl??globalThis.fetch)(value,{...init,cache:'no-store',credentials:'omit',headers:{'User-Agent':UA,Accept:kind==='json'?'application/json,text/plain,*/*':kind==='html'?'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8':'*/*'}})
    return{status:response.status,url:response.url,headers:response.headers,body:response.body===null?null:{cancel:e=>response.body.cancel(e),getReader(){const reader=response.body.getReader();return{
     async read(){const part=await reader.read();if(!part.done){need(types.isUint8Array(part.value),'native stream requires original bytes');const length=byteLength.call(part.value);need(length<=4000000-size&&length<=24000000-total,'native streaming byte bound');size+=length;total+=length}return part},
     cancel:e=>reader.cancel(e),releaseLock:()=>reader.releaseLock(),
    }}}}
   }})
   const bytes=Buffer.from(packet.bodyBase64,'base64');receipts.push({requestedURL:url,...packet,bytes:bytes.length,sha256:sha(bytes)})
   need(packet.status===expected.status&&packet.url===expected.finalURL,'native original HTTP status/final URL changed')
   // One observed Azure cache diagnostic is admitted only as a second complete
   // header set on this exact unchanged program. It is never ignored globally.
   const headerVariants=expected.reviewedHeaderVariants
   need(!headerVariants||(url===reviewedFormLoaderURL&&headerVariants.length===2&&same(headerVariants[0],expected.headers)),'unreviewed effective header variant contract')
   need((headerVariants??[expected.headers]).some(headers=>same(currentKpitHeaders(packet.headers),headers)),'native effective HTTP header context changed')
   let text
   if(profile.documents.includes(url)){
    try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch{throw problem('native document original UTF8 unavailable')}
    need(bytes.length===expected.bytes&&sha(normalizeCurrentKpitDocument(text,url))===expected.normalizedSHA256,'whole current native document, criteria, controls or client declaration changed')
   }else need(bytes.length===expected.bytes&&sha(bytes)===expected.sha256,'whole current native model/program/style/redirect changed '+url)
   signal.throwIfAborted();return{packet,text:()=>text??new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}
  }catch(error){if(!signal.aborted)controller.abort(error);throw error}
 }
 const chain=async(url,kind)=>{const seen=new Set();for(let n=0;n<5;n++){need(!seen.has(url),'native redirect loop');seen.add(url);const r=await read(url,kind);if(r.packet.status===200)return{url,...r};need([301,302,307,308].includes(r.packet.status),'native public denial is not inventory');const next=new URL(r.packet.headers.location,url);need(next.protocol==='https:'&&!next.username&&!next.password&&Object.hasOwn(profile.packets,next.href),'unreviewed current HTTPS redirect');allowed.add(next.href);url=next.href}throw problem('native redirect bound exceeded')}
 const phase=async()=>{
  allowed=new Set([profile.configuredHome]);const career=await chain(profile.configuredHome,'html'),cd=readNativeDocument(career.text())
  need(career.url===profile.careerURL&&cd.nodes(n=>n.tag==='meta'&&n.attrs.property==='og:site_name'&&n.attrs.content==='KPIT').length===1,'current original corporate publisher unavailable')
  need(cd.nodes(n=>n.tag==='a'&&n.attrs.href===corporateOrigin+'/job-listing/'&&/^(?:Open Positions|View all jobs)$/.test(cd.text(n))).length>=1,'current corporate native listing handoff unavailable')
  allowed.add(profile.listingURL);const listing=await read(profile.listingURL,'html'),cards=currentKpitCards(listing.text())
  need(same(cards,profile.cards),'current own native card membership or original criteria changed')
  allowed.add(cards[0].url);const native=await read(cards[0].url,'html')
  const nd=readNativeDocument(native.text());need(norm(decodeNativeEntities(one(nd.nodes(n=>n.tag==='title'),'native employer title').raw??''))==='Be a Automobeliever at KPIT','native own employer shell changed')
  allowed.add(profile.templateURL);const template=await read(profile.templateURL,'html')
  const surfaces=[{url:career.url,text:career.text()},{url:profile.listingURL,text:listing.text()},{url:cards[0].url,text:native.text()},{url:profile.templateURL,text:template.text()}]
  const declarations=surfaces.flatMap(s=>currentKpitResources(s.text,s.url).map(r=>({documentURL:s.url,...r})))
  const allResources=[...new Set(declarations.map(r=>r.url))]
  need(same(allResources,profile.assetURLs),'whole current active native dependency cohort changed')
  // Publication authority comes from the current own corporate/card documents,
  // native programs/template and full API models. This HTTP-only reader never
  // executes analytics or fonts. Their entire authored declarations stay pinned
  // in the documents and inventory; only these exact two URLs are not fetched.
  need(same(profile.authorityScope.unexecutedResourceURLs,unexecutedResourceURLs),'unreviewed authority scope')
  const unexecutedDeclaredResources=unexecutedResourceURLs.map(url=>({url,declarations:declarations.filter(r=>r.url===url),requested:false,executed:false,usedAsRoleData:false}))
  need(unexecutedDeclaredResources.every(r=>r.declarations.length>0),'current unexecuted resource declaration missing')
  const resources=allResources.filter(url=>!unexecutedResources.has(url))
  need(same(resources,profile.authorityScope.authoritativeResourceURLs),'native authoritative resource cohort changed')
  for(const url of resources)allowed.add(url)
  let cursor=0
  const workers=Array.from({length:2},async()=>{while(cursor<resources.length){signal.throwIfAborted();await chain(resources[cursor++],'asset')}})
  const settled=await Promise.allSettled(workers),failed=settled.find(r=>r.status==='rejected');if(failed)throw failed.reason
  const models=[]
  for(const card of cards){const url=nativeOrigin+'/service/jobs/'+card.nativeID;allowed.add(url);const raw=await read(url,'json');models.push(fullModel(JSON.parse(raw.text()),card,profile.models[card.nativeID]))}
  return{cards,models,unexecutedDeclaredResources}
 }
 try{
  const opening=await phase(),closing=await phase();need(same(opening,closing),'independent native full-role/membership/employer/country/conditions closing changed');signal.throwIfAborted()
  const heldRows=[],qualified=[]
  for(const r of opening.models){
   const hold=profile.heldModels[r.job.id]
   if(hold){
    need(['linked-full-job-description-unqualified','native-alternative-application-unqualified'].includes(hold.reason)
     &&r.authoredRoleLinks.length>0&&same(r.authoredRoleLinks,hold.authoredRoleLinks),'unreviewed native criteria/application hold')
    heldRows.push({nativeID:r.job.id,reason:hold.reason,nativeApplicationURL:r.card.url,authoredRoleLinks:r.authoredRoleLinks,
     fullNativeCriteria:r.criteria,originalNativeRecord:r.payload,originalNativeCard:r.card,referenceReview:hold.referenceReview,
     sourceDetailComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
   }else{
    need(r.authoredRoleLinks.length===0,'linked native criteria or alternative application requires independent public proof')
    qualified.push(r)
   }
  }
  need(qualified.length===13&&heldRows.length===3,'current qualified/held native role cohort changed')
  const jobs=qualified.map(r=>({source:'kpit',company:'KPIT',companyDomain:'kpit.com',companyCareerPage:profile.configuredHome,title:r.card.title,
   jobId:r.job.id,sourceNativeIdentifier:r.job.id,requisitionId:null,sourceNativeCodeRaw:r.job.code,sourceCanonicalRoleURL:r.card.url,sourceUrl:r.card.url,link:r.card.url,applyUrl:r.card.url,
   country:r.job.country,city:r.job.location.length===1?r.job.location[0]:null,locations:r.job.location.map(city=>({city,country:r.job.country})),location:r.job.location.join(', ')+', '+r.job.country,
   employmentType:r.job.type,experienceRequired:r.job.min_experience+'-'+r.job.max_experience+' years',jobDescription:r.description,sourceDescription:r.description,
   sourceNativeDescriptionHTML:r.job.description,sourceNativeFullCriteria:r.criteria,sourceNativeCriterionFields:r.fields,sourceNativeRecord:r.payload,sourceNativeCard:r.card,sourceNativeAuthoredLinks:r.authoredRoleLinks,
   sourceNativeCountryProof:{apiURL:nativeOrigin+'/service/jobs/'+r.job.id,originalCountry:r.job.country,originalLocations:r.job.location,cityDictionaryUsed:false},
   sourceNativeEmployerProof:{configuredCorporateURL:profile.configuredHome,currentCareerURL:profile.careerURL,originalOrganization:r.organization,originalJobOrganizationID:r.job.organization_id},
   sourceNativeApplication:{url:r.card.url,nativeID:r.job.id,source:'Career Portal',currentStatus:r.job.status,templateURL:profile.templateURL,currentDeclaredController:profile.controllerURL,submissionPerformed:false,renderedApplicationQualified:false},
   postingDate:null,firstEverPostedAt:null,closingDate:null,sourceNativeCreatedAtRaw:r.job.created_at,sourceNativeUpdatedAtRaw:r.job.updated_at,sourceNativeExpectedJoiningDateRaw:r.job.expected_joining_date,sourceDateSemanticsUnresolved:true,
   sourceDetailComplete:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceNativeClosingReconciled:true,sourceRenderedApplicationQualified:false,scrapedAt:observedAt}))
  attachSourceObservationEvidence(jobs,{source:'kpit',recordKind:'vacancy-rows',observedRecordCount:opening.cards.length,observedVacancyCount:opening.cards.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{configurable:true,value:{source:'kpit',nativeRows:opening.cards,closingNativeRows:closing.cards,openingModels:opening.models.map(r=>r.payload),closingModels:closing.models.map(r=>r.payload),authoredRoleLinks:opening.models.map(r=>({nativeID:r.job.id,links:r.authoredRoleLinks})),closingAuthoredRoleLinks:closing.models.map(r=>({nativeID:r.job.id,links:r.authoredRoleLinks})),heldRows,unexecutedDeclaredResources:opening.unexecutedDeclaredResources,closingUnexecutedDeclaredResources:closing.unexecutedDeclaredResources,originalResponses:receipts,currentFullClosingReconciled:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,applicationRequested:false,renderedApplicationQualified:false}})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:profile.listingURL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reads,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:'current-corporate-declared-native-account+full-current-published-API-criteria+native-India+native-client-style-header-model-and-membership-closing;unexecuted-analytics-font-declarations-retained-without-body-or-rendering-qualification;three-unqualified-linked-criteria-or-alternative-application-rows-held;company-scope-zero-and-application-operation-unqualified'})
 }catch(error){
  if(!controller.signal.aborted)controller.abort(error)
  if(options.signal?.aborted)throw options.signal.reason
  if(error&&typeof error==='object'&&Object.isExtensible(error))try{Object.defineProperty(error,'sourceAudit',{value:{source:'kpit',originalResponses:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false},enumerable:true,configurable:true})}catch{}
  throw error
 }finally{clearTimeout(timer)}
}
