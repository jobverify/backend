import {isDeepStrictEqual} from 'node:util'
import {decodeHTML} from 'entities'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {validatePublicPostingScope} from '../../scraper-support/utils/publishingGapAts.js'
import {NATIVE_INDIA_LOCATION} from '../../scraper-support/utils/greenhouseLocations.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export const CORPORATE='https://loadsmart.com/careers/',BOARD='https://jobs.lever.co/loadsmart/',API='https://api.lever.co/v0/postings/loadsmart?mode=json'
const fail=message=>Object.assign(Error('Loadsmart current native: '+message),{source:'loadsmart',softFailure:true,abortRetries:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(ok,message)=>{if(!ok)throw fail(message)}
const norm=value=>decodeHTML(String(value)).replace(/\s+/gu,' ').trim()
const text=node=>typeof node==='string'?decodeHTML(node):node.children.map(text).join('')
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)
const one=(values,label)=>{need(values.length===1,'Missing or ambiguous '+label);return values[0]}
function entriesOf(doc){const rows=[];const visit=(node,ancestors)=>{if(typeof node==='string')return;rows.push({node,ancestors});for(const child of node.children)visit(child,[...ancestors,node])};visit(one(doc.nodes(n=>n.tag==='root'),'native document root'),[]);return rows}
const active=e=>!e.node.inert&&!e.node.inactive&&!e.node.nativeTagUnqualified&&!e.ancestors.some(n=>n.inert||n.inactive||n.nativeTagUnqualified||['template','noscript','svg','math','object','iframe'].includes(n.tag))
function corporate(html){
 const doc=readNativeDocument(html),head=activeHead(html),entries=entriesOf(doc)
 need(head.titles.length===1&&/Loadsmart/i.test(head.titles[0])&&/careers/i.test(head.titles[0]),'Own corporate careers identity changed')
 const canonical=doc.nodes(n=>n.tag==='link'&&(n.attrs.rel??'').toLowerCase()==='canonical')
 need(canonical.length<=1&&canonical.every(n=>['https://loadsmart.com/careers/','https://loadsmart.com/careers'].includes(n.attrs.href)),'Own corporate canonical authority changed')
 const links=entries.filter(e=>e.node.tag==='a'&&e.node.attrs.href===BOARD&&active(e))
 need(links.length>0&&links.some(e=>norm(text(e.node))==='Explore open positions'),'Actual corporate handoff missing')
 return {publisherBrand:'Loadsmart',corporateURL:CORPORATE,declaredBoardURL:BOARD,title:head.titles[0],canonical:canonical[0]?.attrs.href??null,activeHandoffCount:links.length}
}
function board(html){
 const doc=readNativeDocument(html),entries=entriesOf(doc),head=activeHead(html)
 need(isDeepStrictEqual(head.titles,['Loadsmart'])&&head.metas.filter(m=>m.property==='og:url'&&['https://jobs.lever.co/loadsmart','https://jobs.lever.co/loadsmart/'].includes(m.content)).length===1,'Native board account identity changed')
 need(!doc.nodes(n=>n.tag==='script'&&!n.inert&&!n.inactive&&(n.attrs.type??'').toLowerCase()==='application/ld+json'&&n.raw?.trim()).length,'Unreviewed additional native structured criteria')
 const wrapper=one(entries.filter(e=>e.node.attrs.class==='postings-wrapper'&&active(e)),'native postings mount'),groups=new Map()
 let department=null
 for(const group of wrapper.node.children.filter(n=>typeof n!=='string')){
  need(group.attrs.class==='postings-group','Unreviewed native posting group')
  const header=group.children.find(n=>typeof n!=='string'&&n.attrs.class==='large-category-header')
  if(header)department=norm(text(header))
  const team=group.children.find(n=>typeof n!=='string'&&n.attrs.class==='posting-category-title large-category-label')
  need(department&&team,'Native department/team missing');groups.set(group,{department,team:norm(text(team))})
 }
 const filters=entries.filter(e=>e.node.attrs.class==='filter-button-wrapper filter-button-wrapper-margin-right')
 need(filters.length===4&&filters.every(active)&&isDeepStrictEqual(filters.map(e=>e.node.attrs['aria-label']),['Filter by Location type: All','Filter by Location: All','Filter by Team: All','Filter by Work type: All']),'Native publication filters changed')
 const raw=entries.filter(e=>Object.hasOwn(e.node.attrs,'data-qa-posting-id')||e.node.attrs.class?.split(/\s+/).includes('posting'))
 need(raw.length>0&&raw.length<=2000,'Bounded nonempty native publication required')
 const visible=readVisibleNativeDocument(html,{strict:true}),visibleIDs=new Set(visible.nodes(n=>n.attrs['data-qa-posting-id']).map(n=>n.attrs['data-qa-posting-id'])),ids=new Set(),postings=[]
 for(const e of raw){
  const n=e.node,id=n.attrs['data-qa-posting-id'],children=n.children.filter(c=>typeof c!=='string')
  need(n.tag==='div'&&n.attrs.class==='posting'&&typeof id==='string'&&!ids.has(id)&&active(e)&&e.ancestors.includes(wrapper.node)&&visibleIDs.has(id),'Duplicate hidden or disconnected native posting');ids.add(id)
  need(children.length===2&&children[1].tag==='a','Native card structure changed')
  const title=children[1],parts=title.children.filter(c=>typeof c!=='string')
  need(parts.length===2&&parts[0].children.every(c=>typeof c==='string'),'Native role title has unreviewed carriers')
  const labels=parts[1].children.filter(c=>typeof c!=='string'),group=e.ancestors.find(n=>groups.has(n)),apply=children[0].children.filter(c=>typeof c!=='string')
  need(labels.length===3&&labels.every(n=>n.children.every(c=>typeof c==='string'))&&group,'Native role categories changed')
  need(apply.length===1&&apply[0].tag==='a'&&title.attrs.href===BOARD+id&&apply[0].attrs.href===title.attrs.href,'Native role/account declaration changed')
  postings.push({id,title:norm(text(parts[0])),URL:title.attrs.href,workplace:norm(text(labels[0])),commitment:norm(text(labels[1])),location:norm(text(labels[2])),...groups.get(group)})
 }
 need(ids.size===visibleIDs.size,'Unreconciled native posting identity')
 return {publisherBrand:'Loadsmart',boardURL:BOARD,postings,filters:filters.map(e=>e.node.attrs['aria-label']),unfiltered:true}
}
const known=new Set(['additional','additionalPlain','applyUrl','categories','country','createdAt','description','descriptionBody','descriptionBodyPlain','descriptionPlain','hostedUrl','id','lists','opening','openingPlain','salaryDescription','salaryDescriptionPlain','salaryRange','text','workplaceType'])
function native(input){
 const literal=readLiteralModel(input);need(literal.validJSON,'Strict duplicate-free original native JSON required')
 const rows=literal.value;need(Array.isArray(rows)&&rows.length>0&&rows.length<=2000,'Complete nonempty native array required')
 const ids=new Set(),holds=[]
 for(const row of rows){
  need(object(row)&&typeof row.id==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(row.id)&&!ids.has(row.id),'Malformed or duplicate native role identity');ids.add(row.id)
  need(row.hostedUrl===BOARD+row.id&&row.applyUrl===row.hostedUrl+'/apply'&&typeof row.text==='string'&&row.text.trim(),'Native role/employer/application account conflict')
  need(object(row.categories)&&Object.keys(row.categories).sort().join(',')==='allLocations,commitment,department,location,team'&&['commitment','department','location','team'].every(k=>typeof row.categories[k]==='string'&&row.categories[k].trim())&&Array.isArray(row.categories.allLocations)&&row.categories.allLocations.length>0,'Complete native categories required')
  const reasons=[]
  if(Object.keys(row).some(k=>!known.has(k)))reasons.push('unreviewed-native-fields')
  if(typeof row.country!=='string'||!/^[A-Z]{2}$/.test(row.country)||row.country==='IN')reasons.push('native-india-or-country-requires-own-role-qualification')
  if(NATIVE_INDIA_LOCATION.test(decodeHTML(JSON.stringify(row))))reasons.push('native-india-prose-requires-own-role-qualification')
  for(const k of ['opening','openingPlain','description','descriptionPlain','descriptionBody','descriptionBodyPlain','additional','additionalPlain'])need(typeof row[k]==='string','Complete native criteria missing: '+k)
  need(Array.isArray(row.lists)&&row.lists.every(l=>object(l)&&Object.keys(l).sort().join(',')==='content,text'&&typeof l.text==='string'&&typeof l.content==='string'),'Native full criteria lists changed')
  if((row.descriptionBody+row.lists.map(l=>l.content).join('')).length<100)reasons.push('native-role-criteria-incomplete')
  if(!Number.isSafeInteger(row.createdAt)||row.createdAt<0||!['onsite','remote','hybrid'].includes(row.workplaceType))reasons.push('native-date-or-workplace-unqualified')
  if(Object.hasOwn(row,'salaryDescription')!==Object.hasOwn(row,'salaryDescriptionPlain')||Object.hasOwn(row,'salaryDescription')&&(typeof row.salaryDescription!=='string'||typeof row.salaryDescriptionPlain!=='string'))reasons.push('native-salary-representations-unqualified')
  if(Object.hasOwn(row,'salaryRange')){const s=row.salaryRange;if(!object(s)||Object.keys(s).sort().join(',')!=='currency,interval,max,min'||!Number.isFinite(s.min)||!Number.isFinite(s.max)||s.min>s.max||typeof s.currency!=='string'||typeof s.interval!=='string')reasons.push('native-salary-range-unqualified')}
  try{reasons.push(...validatePublicPostingScope([row],'lever',{source:'loadsmart',boardToken:'loadsmart',leverRegion:'global'}))}catch{reasons.push('contradictory-native-country-or-workplace')}
  if(reasons.length)holds.push({id:row.id,reasons})
 }
 return {rows,holds}
}
function reconcile(b,rows){
 need(b.postings.length===rows.length,'Native board/API membership disagreement')
 const byID=new Map(rows.map(r=>[r.id,r]))
 for(const p of b.postings){const r=byID.get(p.id);need(r&&p.title===norm(r.text)&&p.URL===r.hostedUrl&&p.location===norm(r.categories.location)&&p.commitment===r.categories.commitment&&p.department===r.categories.department&&p.team===r.categories.team&&p.workplace===({onsite:'On-site \u2014',hybrid:'Hybrid \u2014',remote:'Remote \u2014'})[r.workplaceType],'Native board/API whole role or workplace disagreement')}
}
export async function runCurrentLoadsmartSource(options={}){
 const caller=options.signal;caller?.throwIfAborted()
 for(const key of ['fetchPage','fetchText','fetchJson','readPage','readJson'])need(options[key]===undefined,'Original Response transport required; body-only callbacks rejected')
 for(const key of ['timeoutMs','maxDurationMs','deadlineMs','deadline','maxResponseBytes','maxBodyBytes','maxAggregateBytes','maxTotalBytes','requestBudget','requestLimit','concurrency'])need(options[key]===undefined,'Unsupported caller budget: '+key)
 need(options.onAudit===undefined||typeof options.onAudit==='function','Invalid audit observer')
 need(options.requestTimeoutMs===undefined||Number.isSafeInteger(options.requestTimeoutMs)&&options.requestTimeoutMs>0&&options.requestTimeoutMs<=15000,'Invalid request deadline')
 need(options.maxJobs===undefined||options.maxJobs===Infinity,'Output cap cannot qualify a native country cohort')
 need(options.maxRequests===undefined||options.maxRequests===6,'Complete six-read native budget required')
 const sourceTimeoutMs=options.sourceTimeoutMs??90000;need(Number.isSafeInteger(sourceTimeoutMs)&&sourceTimeoutMs>0&&sourceTimeoutMs<=90000,'Invalid source deadline')
 const control=new AbortController(),signal=caller?AbortSignal.any([caller,control.signal]):control.signal,timer=setTimeout(()=>control.abort(new DOMException('Loadsmart source deadline exceeded','TimeoutError')),sourceTimeoutMs)
 const audit={source:'loadsmart',recordKind:'vacancy-rows',startedAt:new Date().toISOString(),rawPublisherResponses:[],observations:[],companyGlobalTotal:null,companyIndiaTotal:null,companyIndiaZeroProven:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,downloadedJavaScriptExecuted:false,renderedApplicationQualified:false,applicationInteractions:0,applicationSubmissions:0,nativeCreatedAtIsPostingDate:false}
 const reader=createCurrentNativeReader({...options,signal,sourceTimeoutMs},{source:'loadsmart',admitted:[[CORPORATE,'html'],[BOARD,'html'],[API,'json']]})
 let bytes=0
 const read=async(url,phase)=>{reader.check();need(audit.rawPublisherResponses.length<6,'Source six-read ceiling');const row=await reader.read(url);audit.rawPublisherResponses.push({phase,...row});reader.check();bytes+=Buffer.byteLength(row.body);need(Buffer.byteLength(row.body)<=2*1024*1024&&bytes<=12*1024*1024,'Source parser/accepted aggregate byte ceiling');return row.body}
 try{
  const c=corporate(await read(CORPORATE,'opening-corporate')),b=board(await read(BOARD,'opening-board')),n=native(await read(API,'opening-native'))
  reconcile(b,n.rows);audit.observedRecordCount=n.rows.length;audit.observedVacancyCount=n.rows.length;audit.nativeCountries=Object.fromEntries([...new Set(n.rows.map(r=>r.country))].map(country=>[country,n.rows.filter(r=>r.country===country).length]))
  audit.observations=n.rows.map(row=>({id:row.id,sourceNativeRecord:structuredClone(row),nativeCountryRaw:row.country,qualificationHolds:n.holds.find(h=>h.id===row.id)?.reasons??[],nativeRolePageQualified:false,nativeApplicationEligibilityQualified:false}))
  const close=native(await read(API,'closing-native')),bb=board(await read(BOARD,'closing-board')),cc=corporate(await read(CORPORATE,'closing-corporate'))
  reconcile(bb,close.rows);need(isDeepStrictEqual(n,close)&&isDeepStrictEqual(b,bb)&&isDeepStrictEqual(c,cc),'Complete native publisher/account/role/criteria/country models changed at closing')
  reader.check();Object.assign(audit,{wholeNativeModelsClosingReconciled:true,nativeOpening:{corporate:c,board:b,...n},nativeClosing:{corporate:cc,board:bb,...close},nativeReadEvidence:reader.stats(),acceptedBytes:bytes,nativeRequestIntervalMs:500,nativeIndiaCount:n.rows.filter(r=>r.country==='IN').length,configuredNativeForeignCountryCohortComplete:n.holds.length===0,currentDeclaredNativePublicationComplete:true,completedAt:new Date().toISOString()})
  if(options.onAudit){need(typeof options.onAudit==='function','Invalid audit observer');let listener;try{await Promise.race([Promise.resolve().then(()=>{reader.check();return options.onAudit(structuredClone(audit))}),new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true});if(signal.aborted)listener()})]);reader.check()}finally{if(listener)signal.removeEventListener('abort',listener)}}
  const jobs=[];attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit})
  attachInventoryEvidence(jobs,{status:n.holds.length?'coverage-gap':'complete-inventory',surface:BOARD,firstParty:true,listingComplete:n.holds.length===0,lifecycleCleanupAllowed:false,pagesFetched:6,reportedTotal:null,indiaFacetCount:n.holds.length?null:0,verifiedAt:audit.completedAt,reason:'Paired own corporate-declared unfiltered native SSR/API publication and full original models. Only configured foreign-country cohort qualified; whole company totals, other channels, role/browser/application UI and cleanup unqualified.'})
  reader.check();return jobs
 }catch(error){caller?.throwIfAborted();audit.completedAt=new Date().toISOString();audit.nativeReadEvidence=reader.stats();if(error&&typeof error==='object')try{Object.defineProperty(error,'nativeCollectionEvidence',{value:audit,configurable:true})}catch{}throw error}
 finally{reader.close();clearTimeout(timer);control.abort();caller?.throwIfAborted()}
}
