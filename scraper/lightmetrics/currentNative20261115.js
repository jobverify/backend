import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const profile=JSON.parse(fs.readFileSync(new URL('./currentProfile20261115.json',import.meta.url),'utf8'))
const sha=value=>createHash('sha256').update(value).digest('hex')
const problem=message=>Object.assign(Error('Lightmetrics current native: '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(value,message)=>{if(!value)throw problem(message)}
const one=(values,label)=>{need(values.length===1,'missing or ambiguous '+label);return values[0]}
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const descendants=node=>{const out=[],todo=[node];while(todo.length){const n=todo.pop();if(!n||typeof n!=='object'||n.inert)continue;out.push(n);for(let i=n.children.length-1;i>=0;i--)if(typeof n.children[i]==='object')todo.push(n.children[i])}return out}
const resourceURLs=(doc,url)=>doc.nodes(n=>n.tag==='script'&&n.attrs.src||n.tag==='link'&&n.attrs.rel==='stylesheet').map(n=>new URL(n.attrs.src||n.attrs.href,url).href)

function roles(html){
 const doc=readNativeDocument(html),list=one(doc.nodes(n=>doc.hasClass(n,'career_collection_list')),'current own role list')
 const cards=list.children.filter(n=>typeof n==='object'&&doc.hasClass(n,'w-dyn-item')).map(node=>{
  const children=descendants(node),title=one(children.filter(n=>/^h[1-4]$/.test(n.tag)),'native card title')
  const links=children.filter(n=>n.tag==='a'&&n.attrs.href).map(n=>new URL(n.attrs.href,profile.board).href)
  const url=one([...new Set(links)],'native exact role link')
  need(new URL(url).origin===new URL(profile.home).origin&&new URL(url).pathname.startsWith('/career/'),'native role employer origin changed')
  return{title:doc.text(title),url,originalCardText:doc.text(node),originalCardModel:structuredClone(node)}
 })
 need(cards.length===5&&new Set(cards.map(c=>c.url)).size===cards.length,'current native membership changed; no zero evidence')
 return cards
}
function role(html,model,card){
 const doc=readNativeDocument(html),main=one(doc.nodes(n=>n.tag==='main'),'own complete role main'),sections=main.children.filter(n=>typeof n==='object'&&n.tag==='section')
 need(sections.length===3,'original role sections changed')
 const heading=one(doc.nodes(n=>n.tag==='h1',main),'own native role title')
 need(doc.text(heading)===model.title&&card.title===model.title,'native card and full role title disagree')
 const canonical=one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'native canonical role')
 need(canonical.attrs.href===model.url,'native canonical role identity changed')
 const header=doc.text(sections[0]),criteria=doc.text(sections[1]),headers=doc.nodes(n=>/^h[1-4]$/.test(n.tag),sections[1]).map(doc.text)
 need(descendants(sections[0]).some(n=>doc.text(n)===model.location)&&card.originalCardText.includes(model.location),'same own native card and role must explicitly publish India')
 need(model.location.endsWith(', India')&&descendants(sections[0]).some(n=>doc.text(n)===model.employmentLabel),'native original work-country or employment text unavailable')
 need(headers.includes('Job Description')&&headers.includes('Requirements')&&headers.includes('Benefits')&&criteria.length>=1200&&criteria.includes('equal opportunity employer'),'full native original requirements, benefits and common hiring conditions missing')
 need(!/\b(?:(?:applications\s+are\s+(?:no\s+longer\s+accepted|closed))|(?:no\s+longer\s+accepting\s+applications)|(?:(?:this|the)\s+(?:role|job|position)\s+is\s+(?:closed|filled|unavailable)))\b/i.test(header+' '+criteria),'native role explicitly unavailable')
 const apply=one(doc.nodes(n=>n.tag==='a'&&n.attrs.href==='#Apply-for-this-Position',sections[0]),'own published application anchor')
 need(doc.text(apply)==='Apply for this Position'&&sections[2].attrs.id==='Apply-for-this-Position','native application role context changed')
 const form=one(doc.nodes(n=>n.tag==='form'&&n.attrs.id==='wf-form-Career-Form',sections[2]),'own role form')
 const description=header+'\n\n'+criteria
 return{title:model.title,url:model.url,location:model.location,employmentLabel:model.employmentLabel,description,criteria,header,
  originalOwnRoleHTML:html,sourceNativeDateLabel:/^ENGINEERING\s*\|\s*([A-Za-z]+ \d{1,2}, \d{4})\s/.exec(header)?.[1]||null,
  application:{url:new URL(apply.attrs.href,model.url).href,rolePage:model.url,formAttributes:structuredClone(form.attrs),kind:'current-own-role-page-form',submissionPerformed:false,renderedApplicationQualified:false}}
}

export async function runCurrentLightmetrics(options={}){
 options.signal?.throwIfAborted()
 need(!(options.fetchText||options.fetchPage||options.fetchJson)||options.fetchImpl,'original HTTP metadata required')
 const duration=options.sourceDeadlineMs??85000,interval=options.requestIntervalMs??500
 need(Number.isSafeInteger(duration)&&duration>0&&duration<=85000,'invalid source deadline')
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=60000&&(interval>=500||options.fetchImpl),'invalid native host pacing')
 const observedAt=typeof options.now==='function'?options.now():new Date().toISOString();need(Number.isFinite(Date.parse(observedAt)),'invalid observation clock')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(problem('source deadline exceeded')),duration)
 const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,receipts=[],last=new Map()
 const allowed=new Set([profile.configuredHome]);let reads=0,total=0
 const read=async url=>{
  signal.throwIfAborted();need(allowed.has(url)&&Object.hasOwn(profile.originalPackets,url)&&++reads<=60,'unbound current native URL or request cap')
  const origin=new URL(url).origin,wait=Math.max(0,interval-(performance.now()-(last.get(origin)??-Infinity)))
  if(wait)await delay(wait,undefined,{signal});last.set(origin,performance.now())
  const p=await boundedDeclaredPublicRead(url,{signal,timeoutMs:15000,overflowError:problem('native streaming byte bound'),fetchImpl:async(value,init)=>{
   const response=await(options.fetchImpl||globalThis.fetch)(value,{...init,cache:'no-store',credentials:'omit'});let bytes=0
   const body=response.body===null?null:{cancel:r=>response.body.cancel(r),getReader(){const reader=response.body.getReader();return{
    async read(){const part=await reader.read();if(!part.done){need(types.isUint8Array(part.value),'native stream must contain bytes');need(part.value.byteLength<=4000000-bytes&&part.value.byteLength<=16000000-total,'native streaming byte bound');bytes+=part.value.byteLength;total+=part.value.byteLength}return part},
    cancel:r=>reader.cancel(r),releaseLock:()=>reader.releaseLock()}}}
   return{status:response.status,url:response.url,headers:response.headers,body}
  }})
  const bytes=Buffer.from(p.bodyBase64,'base64'),expected=profile.originalPackets[url];receipts.push({requestedURL:url,...p,bytes:bytes.length,sha256:sha(bytes)})
  need(p.status===expected.status&&p.url===expected.finalURL,'native HTTP status or final URL changed')
  need((p.headers['content-type']||'').split(';')[0].trim().toLowerCase()===expected.mime,'native MIME changed')
  const wholePrograms=profile.reviewedWholeProgramVariants?.[url]||[expected]
  need(wholePrograms.some(program=>bytes.length===program.bytes&&sha(bytes)===program.sha256),'whole current native publisher, criteria, client or style changed')
  need((p.headers.location??null)===(expected.location??null),'native redirect authority changed')
  try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch{throw problem('original native UTF8 unavailable')}
 }
 const pass=async()=>{
  await read(profile.configuredHome);allowed.add(profile.home)
  const documents=new Map(),home=await read(profile.home);documents.set(profile.home,home)
  const hd=readNativeDocument(home),handoffs=hd.nodes(n=>n.tag==='a'&&n.attrs.href&&new URL(n.attrs.href,profile.home).href===profile.board)
  need(handoffs.length>0&&hd.nodes(n=>n.tag==='title'&&/LightMetrics/.test(n.raw||'')).length===1,'current own corporate identity/careers handoff missing')
  allowed.add(profile.board);const board=await read(profile.board);documents.set(profile.board,board)
  const cards=roles(board),selected=[]
  for(const model of profile.roleModels){const card=one(cards.filter(c=>c.url===model.url),'own published India card');allowed.add(model.url)
   const page=await read(model.url);documents.set(model.url,page);selected.push(role(page,model,card))
  }
  const declared=[...new Set([...documents].flatMap(([url,html])=>resourceURLs(readNativeDocument(html),url)))]
  need(equal(declared,profile.assetURLs),'current native declared client/style cohort changed')
  for(const url of declared){allowed.add(url);await read(url)}
  return{cards,selected}
 }
 try{
  const opening=await pass(),closing=await pass();need(equal(opening,closing),'full closing native role, country, criteria or membership changed');signal.throwIfAborted()
  const holds=opening.cards.filter(c=>!profile.roleModels.some(r=>r.url===c.url)).map(c=>({title:c.title,url:c.url,reason:'native-work-country-unresolved;full-native-detail-not-qualified',originalCard:c}))
  const jobs=opening.selected.map(r=>({source:profile.source,company:profile.company,companyDomain:'lightmetrics.ai',companyCareerPage:profile.board,title:r.title,
   jobId:null,requisitionId:null,sourceNativeIdentifier:null,sourceNativeIdentity:{kind:'current-own-canonical-role-url',value:r.url},sourceCanonicalRoleURL:r.url,
   sourceUrl:r.url,link:r.url,applyUrl:r.application.url,country:'India',city:null,location:r.location,employmentType:'Full-Time',remoteStatus:null,
   jobDescription:r.description,sourceDescription:r.description,postingDate:null,firstEverPostedAt:null,closingDate:null,sourceNativeDateLabel:r.sourceNativeDateLabel,sourceDateSemanticsUnresolved:true,
   nativeSourceRecord:{originalOwnRoleHTML:r.originalOwnRoleHTML,originalNativeRoleHeader:r.header,originalNativeFullCriteria:r.criteria,originalPublishedApplication:r.application},
   sourceNativeEmployerBinding:{configuredCorporateURL:profile.configuredHome,currentCorporateURL:profile.home,currentNativeCareers:profile.board,brand:profile.brand},
   sourceNativeCountryProof:{nativeCardCountry:r.location,ownRoleHeaderCountry:r.location,cityDictionaryUsed:false},
   sourceDetailComplete:true,sourceNativeClosingReconciled:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceRenderedApplicationQualified:false,scrapedAt:observedAt}))
  const evidence={source:profile.source,observedAt,recordKind:'vacancy-rows',observedRecordCount:opening.cards.length,observedVacancyCount:opening.cards.length,nativeRows:opening.cards,closingNativeRows:closing.cards,holds,originalResponses:receipts,fullOriginalCriteriaPreserved:true,companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,applicationSubmitted:false}
  attachSourceObservationEvidence(jobs,{source:profile.source,recordKind:'vacancy-rows',observedRecordCount:opening.cards.length,observedVacancyCount:opening.cards.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:profile.board,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reads,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:'current-own-native-full-role-criteria-and-explicit-country+declared-client/style-and-complete-document-closing-reconciled;city-only-cards-held;company-inventory-and-zero-unqualified'})
 }catch(error){
  if(options.signal?.aborted)throw options.signal.reason
  if(error&&typeof error==='object'&&Object.isExtensible(error))try{Object.assign(error,{softFailure:true,abortRetries:true,failureKind:error.failureKind||'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false,sourceAudit:{source:profile.source,originalResponses:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false}})}catch{}
  throw error
 }finally{clearTimeout(timer)}
}
