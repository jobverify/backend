import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {runWorkdayScraper,WORKDAY_ADDITIONAL_WORKSITE_PROOF} from '../../scraper-support/myworkday/engine.js'
import {currentWorkdayBoardReceipt,WORKDAY_COUNTRY_INVENTORY_PROOF} from '../../scraper-support/myworkday/countryInventoryProof.js'
import {createNativeDetailRecovery} from '../../scraper-support/utils/nativeDetailRecovery.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createSurfaceReader} from '../atomberg/currentSurface.js'
import {readTemenosOfficePage,reconcileTemenosOffices,buildTemenosWorksiteProof,TEMENOS_BOARD,TEMENOS_CAREERS,TEMENOS_OFFICES,TEMENOS_JOBS} from './worksites.js'

const scraperDir=path.dirname(fileURLToPath(import.meta.url)),hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const rolePath=value=>{try{const u=new URL(value);return u.origin==='https://temenos.wd103.myworkdayjobs.com'&&!u.search&&!u.hash&&!u.username&&!u.password?u.pathname.replace(/^\/[a-z]{2}-[a-z]{2}(?=\/)/i,''):null}catch{return null}}
const activeDirectoryLink=html=>{
 const d=readVisibleNativeDocument(html,{strict:true});let found=false
 const visit=n=>{if(typeof n==='string')return;const a=n.attrs||{};if(n.inert||['script','style','head','template','noscript','svg'].includes(n.tag)||['hidden','inert','disabled'].some(k=>Object.hasOwn(a,k))||['aria-hidden','aria-disabled'].some(k=>Object.hasOwn(a,k)&&a[k].toLowerCase()!=='false')||/\b(?:hidden|invisible|sr-only)\b/i.test(a.class||'')||/(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(a.style||''))return
  if(n.tag==='a'&&a.href&&d.text(n).trim()){try{if(new URL(a.href,TEMENOS_CAREERS).href===TEMENOS_OFFICES)found=true}catch{}}
  for(const child of n.children||[])visit(child)
 };for(const root of d.nodes(n=>n.tag==='root'))visit(root);return found
}
export function createCurrentTemenosScraper(defaults={}){
 const collect=async(options={})=>{
  const o={...defaults,...options};if(o.fetchText||o.fetchPage)throw Error('Temenos requires observed public response status and URL')
  const allowed=url=>url===TEMENOS_CAREERS||url===TEMENOS_BOARD||url===TEMENOS_OFFICES||/^https:\/\/www\.temenos\.com\/offices\/page\/[1-9]\d*\/$/.test(url)||url.startsWith(TEMENOS_JOBS.replace(/\/jobs$/,'/job/'))
  const collectionStartedAt=Date.now(),jsonIntents=new Set(),responseMedia=new Map(),fetchImpl=o.fetchImpl??globalThis.fetch
  // The extra role reads use the already-declared CXS JSON endpoint. Keep the
  // ordinary surface-reader identity and budgets; request its JSON media only.
  const reader=createSurfaceReader('temenos',{timeoutMs:180000,...o,fetchImpl:async(url,init)=>{
   init.signal.throwIfAborted()
   if(!jsonIntents.has(url))return fetchImpl(url,init)
   const headers=new Headers(init.headers);headers.set('Accept','application/json')
   const response=await fetchImpl(url,{...init,headers});responseMedia.set(url,response.headers?.get?.('content-type')??'');return response
  }},allowed),attempt={attemptStartedAt:new Date(collectionStartedAt).toISOString(),attemptDeadlineAt:new Date(collectionStartedAt+(o.timeoutMs??180000)).toISOString()}
  const read=async(url,{json=false}={})=>{
   if(json){const target=new URL(url);if(!url.startsWith(TEMENOS_JOBS.replace(/\/jobs$/,'/job/'))||target.href!==url||target.search||target.hash)throw reader.fail('unreviewed native JSON detail URL');jsonIntents.add(url)}
   try{const row=await reader.read(url);reader.signal.throwIfAborted();if(json&&!/^application\/json(?:\s*;|$)/i.test(responseMedia.get(url)||''))throw reader.fail('public native detail JSON MIME changed');return row}
   catch(error){reader.signal.throwIfAborted();error.nativeEvidence={source:'temenos',stage:'public-worksite-response',requestedUrl:url,retainedResponses:reader.responses.map(r=>({url:r.url,status:r.status,rawBodyBase64:Buffer.from(r.body).toString('base64'),bodyBytes:Buffer.byteLength(r.body),bodySHA256:r.sha256,completedAt:r.completedAt}))};throw error}
   finally{jsonIntents.delete(url);responseMedia.delete(url)}
  }
  const binding=async()=>{const r=await read(TEMENOS_CAREERS);if(!activeDirectoryLink(r.body))throw reader.fail('current corporate office directory handoff missing');return currentWorkdayBoardReceipt({officialCareersUrl:TEMENOS_CAREERS,boardUrl:TEMENOS_BOARD,response:{ok:true,status:r.status,url:r.url,headers:new Headers({'content-type':'text/html'})},html:r.body})}
  const directory=async()=>{const pages=[],queue=[TEMENOS_OFFICES],seen=new Set();while(queue.length){if(seen.size>=10)throw reader.fail('public office directory pagination exceeds bound');const url=queue.shift();if(seen.has(url))continue;seen.add(url);const r=await read(url),p=readTemenosOfficePage(r.body,url);pages.push(p);for(const next of p.paginationLinks)if(!seen.has(next)&&!queue.includes(next))queue.push(next)}return reconcileTemenosOffices(pages)}
  const nativePass=async(proof)=>reader.wait(()=>runWorkdayScraper({company:'Temenos',source:'temenos',baseUrl:TEMENOS_BOARD,scraperDir,signal:reader.signal,requestTimeoutMs:o.requestTimeoutMs||20000,retryBaseDelayMs:0,...(o.requestScheduler?{requestScheduler:o.requestScheduler}:{}),nativeDetailRecovery:createNativeDetailRecovery(),sourceWorksiteCountryProof:proof}))
  const validateDetail=(native,role)=>{const p=native?.jobPostingInfo;if(!p||p.title!==role.title||p.jobPostingId!==role.externalPath.split('/').at(-1)||rolePath(p.externalUrl)!==rolePath(role.url)||!role.bulletFields.includes(p.jobReqId)||!/^TEMENOS(?:\s|$)/i.test(native.hiringOrganization?.name||'')||typeof p.jobDescription!=='string'||!p.jobDescription.trim()||typeof p.startDate!=='string'||!p.startDate.trim())throw reader.fail('public native detail role, employer, original date or full description binding changed');return{url:role.url,requisitionId:p.jobReqId,nativePayload:structuredClone(native),nativeSHA256:hash(native)}}
  const extraDetails=async(roles,existing)=>{const result=[];for(const role of roles){if(existing.has(role.url))continue;const api=TEMENOS_JOBS.replace(/\/jobs$/,'')+role.externalPath,r=await read(api,{json:true});let p;try{p=JSON.parse(r.body)}catch{throw reader.fail('public native detail JSON malformed')}result.push(validateDetail(p,role))}return result}
  try{
   const corporate=await binding(),firstDirectory=await directory(),secondDirectory=await directory(),opening=await nativePass(buildTemenosWorksiteProof(firstDirectory,secondDirectory,corporate,attempt)),openingProof=opening[WORKDAY_COUNTRY_INVENTORY_PROOF],openingOfficeProof=opening[WORKDAY_ADDITIONAL_WORKSITE_PROOF]
   if(!openingProof||!openingOfficeProof)throw reader.fail('current native country proof missing')
   const nativeRoles=openingProof.listingRoles,openingExisting=new Map(openingOfficeProof.roles.map(r=>[r.url,r])),extraOpening=await extraDetails(nativeRoles,openingExisting),nativeDetails=nativeRoles.map(role=>{const record=openingExisting.get(role.url);return record?validateDetail(record.nativePayload,role):extraOpening.find(r=>r.url===role.url)})
   const closingCorporate=await binding(),thirdDirectory=await directory()
   // Read extra public details before the final engine pass. Its own closing
   // complete listing follows all public criteria and directory reads.
   const extraClosing=await extraDetails(nativeRoles,openingExisting),closing=await nativePass(buildTemenosWorksiteProof(secondDirectory,thirdDirectory,closingCorporate,attempt)),closingProof=closing[WORKDAY_COUNTRY_INVENTORY_PROOF],closingOfficeProof=closing[WORKDAY_ADDITIONAL_WORKSITE_PROOF]
   if(!closingProof||!closingOfficeProof)throw reader.fail('closing native country proof missing')
   const closingNativeRoles=closingProof.listingRoles,closingExisting=new Map(closingOfficeProof.roles.map(r=>[r.url,r])),closingNativeDetails=closingNativeRoles.map(role=>{const record=closingExisting.get(role.url),extra=extraClosing.find(r=>r.url===role.url);return record?validateDetail(record.nativePayload,role):extra||null})
   const sameRoles=JSON.stringify(nativeRoles)===JSON.stringify(closingNativeRoles),currentByUrl=new Map(closingNativeDetails.filter(Boolean).map(r=>[r.url,r])),changedRoles=nativeDetails.filter(r=>r.nativeSHA256!==currentByUrl.get(r.url)?.nativeSHA256).map(r=>r.url),closingStable=sameRoles&&changedRoles.length===0&&closingNativeDetails.every(Boolean),engineEvidence=readInventoryEvidence(closing),complete=closingStable&&engineEvidence?.listingComplete===true
   const worksiteCountryBindings=closingOfficeProof.roles.flatMap(r=>r.additionalWorksiteCountryBindings.map(p=>({...p,jobUrl:r.url,requisitionId:r.requisitionId})))
   let jobs=closing.filter(job=>!changedRoles.includes(job.jobUrl||job.url||job.link));if(!sameRoles)jobs=[]
   if(Number.isSafeInteger(o.maxJobs)&&o.maxJobs>0)jobs=jobs.slice(0,o.maxJobs)
   for(const job of jobs){const native=currentByUrl.get(job.link);Object.assign(job,{sourceScopeComplete:false,lifecycleCleanupAllowed:false,sourceNativeDetailRecord:native?.nativePayload??null,sourceNativeWorksiteCountryProof:worksiteCountryBindings.filter(p=>p.jobUrl===job.link)})}
   const inventoryEvidence={...engineEvidence,status:complete?'complete-inventory':'coverage-gap',listingComplete:complete,reportedTotal:complete?closingNativeRoles.length:null,indiaFacetCount:complete?closing.length:null,pagesFetched:reader.responses.length+(engineEvidence?.pagesFetched||0),verifiedAt:new Date().toISOString(),reason:complete?'temenos-current-configured-workday-board-and-exact-role-worksites-reconciled;company-totals-and-cleanup-unverified':'temenos-current-configured-board-closing-or-native-criteria-unresolved'}
   attachInventoryEvidence(jobs,inventoryEvidence);attachSourceObservationEvidence(jobs,{source:'temenos',recordKind:'vacancy-rows',observedRecordCount:nativeRoles.length,observedVacancyCount:nativeRoles.length,sourceScopeComplete:false})
   const result={jobs,nativeRoles,closingNativeRoles,nativeDetails,closingNativeDetails,changedRoles,closingStable,directorySnapshots:[firstDirectory,secondDirectory,thirdDirectory],worksiteCountryBindings,openingCountryProof:openingProof,closingCountryProof:closingProof,corporateReceipts:[corporate,closingCorporate],responses:reader.responses,inventoryEvidence,companyGlobalTotal:null,companyIndiaTotal:null,configuredBoardScopeComplete:complete,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
   Object.defineProperty(jobs,WORKDAY_COUNTRY_INVENTORY_PROOF,{value:closingProof});Object.defineProperty(jobs,WORKDAY_ADDITIONAL_WORKSITE_PROOF,{value:closingOfficeProof});Object.defineProperty(jobs,'sourceAudit',{value:result});if(o.onAudit)await reader.wait(()=>o.onAudit(result));return result
  }finally{reader.dispose()}
 }
 return{collect,run:async options=>(await collect(options)).jobs}
}
export const run=async options=>createCurrentTemenosScraper().run(options)
