import fs from 'node:fs'
import {readVisibleNativeDocument} from '../../utils/visibleNativeHtml.js'
import {readNativeDocument,decodeNativeEntities} from '../../utils/activeNativeHtml.js'
import {createPublicIO} from '../publicIO.js'
import {boundedDeclaredPublicGet} from '../boundedDeclaredPublicGet.js'
import {attachInventoryEvidence} from '../../utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../utils/sourceObservationEvidence.js'
import {text,ensure,equal,codeValid,publicURLs,accountMatches,pageIdentity,markdownRows,geography,validatePair,projectJob} from './nativeData.js'
export const PUBLIC_WORKABLE_PROFILES=JSON.parse(fs.readFileSync(new URL('./profiles.json',import.meta.url)))
export const publicWorkableMetadata=(p,previous={})=>({...previous,source:p.source,companyName:p.companyName,officialBrandName:p.companyName,
 companyCareerPage:p.primaryURLs[0],workableBoardUrl:publicURLs(p).board,countryFilter:p.countryFilter,atsPlatform:'workable-public-get',
 verifiedOn:null,verifiedAt:null,verifiedPublicJobCount:null,verifiedIndiaJobCount:null,verifiedInventoryStatus:'unverified',sourceScopeComplete:false,lifecycleCleanupAllowed:false,
 zeroResultPolicy:'coverage-gap',backfillMode:'discovery-only',boardIdentityVerified:false,officialBindingVerifiedAt:null,bindingEvidence:null,
 runtimeInventoryVerification:false,verifiedSampleJobUrl:null,verificationDisposition:'discovery-only-public-native-observations',
 paginationStrategy:'documented-public-get-location-views-and-published-owned-records',extractionStrategy:'original-all-country-native-pairs-before-country-selection',
 verifiedSurfaceSummary:'Public GET discovery observations only. Current company binding, native account and each own record are rechecked. Hidden locations remain unresolved. No employer/India-zero, browser/application activation, persistence or publication claim.'})
const heldInitially=['www.coinbase.com','careers.confluent.io','www.pinterestcareers.com','cgsinc.com','www.springboard.com','job-boards.greenhouse.io','www.ft.com','c27rhq.csb.app']
const starts=new Map()
const gate=async(url,signal)=>{
 const host=new URL(url).hostname,start=Math.max(Date.now(),starts.get(host)||0);starts.set(host,start+1000)
 if(start>Date.now())await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(signal.reason)}
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve()},start-Date.now());signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort()})
 signal?.throwIfAborted()
}
const parallel=async(items,visit,signal)=>{
 let next=0;const results=await Promise.allSettled(Array.from({length:4},async()=>{while(next<items.length){signal?.throwIfAborted();await visit(items[next++])}}))
 const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason
}
export const createPublicWorkableSource=(profile,defaults={})=>({name:profile.source,async run(passed={}){
 const options={...defaults,...passed},{signal,onAudit=()=>{},onRecords=()=>{},now=()=>new Date().toISOString()}=options,maxJobs=options.maxJobs===Infinity?null:options.maxJobs??null
 ensure(['India','Global'].includes(profile.countryFilter),'countryFilter must be India or Global')
 ensure(maxJobs===null||Number.isSafeInteger(maxJobs)&&maxJobs>=0,'maxJobs must be a nonnegative safe integer or null')
 ensure(!(options.fetchText||options.fetchJson)||options.fetchPage||options.fetchImpl,'original HTTP provenance required')
 signal?.throwIfAborted();const time=typeof now==='function'?now():now,observedAt=time instanceof Date?time.toISOString():time
 ensure(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'invalid observation clock')
 const u=publicURLs(profile),allowedURLs=new Set([...profile.primaryURLs,u.board,u.account,u.collection,u.widget,...(profile.markdownURL?[profile.markdownURL]:[])]),held=new Set(heldInitially)
 const allowed=url=>allowedURLs.has(url.href)&&!held.has(url.hostname),originalFetch=options.fetchImpl||globalThis.fetch
 const fetchPage=options.fetchPage|| (async url=>{
  await gate(url,signal);ensure(allowed(new URL(url)),'public host held while queued')
  return boundedDeclaredPublicGet(url,{fetchImpl:(requested,init)=>originalFetch(requested,{...init,headers:{...init.headers,Accept:'text/html,application/json,text/markdown,*/*;q=0.5'}}),
   signal:AbortSignal.any([AbortSignal.timeout(15000),...(signal?[signal]:[])]),overflowError:Error('Public Workable: native entity exceeds input limit')})
 })
 const io=createPublicIO({fetchPage,signal,allowed}),original=page=>Boolean(page?.usable&&page.transportQualified&&page.bodyBase64&&typeof page.originalText==='string')
 const load=async url=>{const page=await io.load(url,{fresh:true});if([401,403,429].includes(page?.status))held.add(new URL(url).hostname);return page}
 const follow=async url=>{
  const seen=new Set()
  for(let n=0;n<5;n++){
   ensure(!seen.has(url),'native redirect loop');seen.add(url);const page=await load(url)
   if(page?.status>=300&&page.status<400){const next=new URL(page.headers.location,url).href;ensure(allowedURLs.has(next),'undeclared native redirect target');url=next;continue}
   return page
  }throw Error('Public Workable: native redirect limit')
 }
 const phases=[]
 for(const phaseName of ['opening','closing']){
  const phase={name:phaseName,issues:[],records:[],listingRows:[],markdownRows:[],originalPrimaryPages:[],employerBindingQualified:false,companyDeclaredHandoff:false,listingReadQualified:false,markdownReadQualified:false,selectedCollectionComplete:true};phases.push(phase)
  const protect=async(label,fn)=>{try{return await fn()}catch(error){signal?.throwIfAborted();phase.issues.push(label+': '+error.message);return null}}
  let companyHandoff=false,accountGood=false,boardGood=false
  for(const url of profile.primaryURLs)await protect('company primary',async()=>{
   const page=await follow(url);phase.originalPrimaryPages.push(page);ensure(original(page),'original company response unavailable')
   const d=readVisibleNativeDocument(page.originalText,{strict:true});ensure(d.nodes(n=>n.tag==='title').some(n=>profile.primaryTitles.some(t=>text(decodeNativeEntities(n.raw)).includes(t))),'current company publisher/title changed')
   phase.companyDeclaredHandoff ||= readNativeDocument(page.originalText).nodes(n=>n.tag==='a'&&n.attrs.href).some(n=>{try{return new URL(n.attrs.href,page.url).href===u.board}catch{return false}})
   companyHandoff ||= d.nodes(n=>n.tag==='a'&&n.attrs.href).some(n=>{try{return new URL(n.attrs.href,page.url).href===u.board}catch{return false}})
  })
  await protect('native account',async()=>{const page=await follow(u.account);phase.originalAccountResponse=page;ensure(original(page),'original account unavailable');phase.originalAccount=io.json(page);ensure(accountMatches(profile,phase.originalAccount),'reciprocal native account identity changed');accountGood=true})
  await protect('native board',async()=>{const page=await follow(u.board);phase.originalBoard=page;ensure(original(page),'original board unavailable');pageIdentity(page,profile.companyName+' - Current Openings');boardGood=true})
  phase.employerBindingQualified=companyHandoff&&accountGood&&boardGood
  if(!companyHandoff)phase.issues.push(phase.companyDeclaredHandoff?'current-company-handoff-visibility-unqualified':'current-company-handoff-missing')
  const collection=await protect('public collection',async()=>{
   const page=await follow(u.collection);phase.originalCollectionResponse=page;ensure(original(page),'original collection unavailable');const model=io.json(page);phase.originalCollection=model
   ensure(model&&model.name===profile.companyName&&Array.isArray(model.jobs)&&!model.error&&model.success!==false&&model.ok!==false&&model.status!=='error','invalid public collection/error envelope');return model.jobs
  })
  phase.listingReadQualified=collection!==null;phase.listingRows=collection||[];phase.listingRowCount=phase.listingRows.length
  if(!collection)phase.selectedCollectionComplete=false
  if(profile.markdownURL){const parsed=await protect('markdown collection',async()=>{const page=await follow(profile.markdownURL);phase.originalMarkdownCollection=page;ensure(original(page),'original markdown collection unavailable');return markdownRows(profile,page.originalText)});phase.markdownRows=parsed?.rows||[];phase.markdownPeerIssues=parsed?.issues||[];phase.markdownReadQualified=parsed!==null;if(!parsed||parsed.issues.length)phase.selectedCollectionComplete=false;phase.issues.push(...phase.markdownPeerIssues.map(i=>i.kind+(i.id?': '+i.id:'')))}
  const groups=new Map(),mdByID=new Map();for(const row of phase.markdownRows)if(!mdByID.has(row.id))mdByID.set(row.id,row)
  for(const row of phase.listingRows){
   if(!row||typeof row!=='object'||Array.isArray(row)||!codeValid(row.shortcode)){phase.issues.push('malformed native listing peer');phase.selectedCollectionComplete=false;continue}
   if(!groups.has(row.shortcode))groups.set(row.shortcode,[]);groups.get(row.shortcode).push(row)
  }
  for(const id of mdByID.keys())if(!groups.has(id)){groups.set(id,[]);phase.selectedCollectionComplete=false;phase.issues.push('markdown-only-native-post: '+id)}
  if(profile.markdownURL)for(const id of groups.keys())if(!mdByID.has(id)){phase.selectedCollectionComplete=false;phase.issues.push('widget-only-native-post: '+id)}
  await parallel([...groups],async([id,variants])=>{
   const urls=publicURLs(profile,id),md=mdByID.get(id),row={id,listingVariants:variants,originalNative:null,originalOwnHTML:null,originalOwnAPIResponse:null,originalOwnMarkdown:null,
    markdownDeclaration:md??null,markdownDeclarations:phase.markdownRows.filter(r=>r.id===id),ownPairQualified:false,issues:[],requisitionId:null,fieldProvenance:{publication:'native.published+listing.published_on',geography:'native.locations; hidden visibility retained',criteria:'native.description+requirements+benefits; original listing/markdown retained',salary:'native.salary_*; original own markdown corroboration',identity:'native.accountUid+shortcode+published own redirect/canonical/title',employerJobCode:'native.code; not a requisition ID'}}
   phase.records.push(row)
   for(const url of [urls.generic,urls.own,urls.own+'/',urls.ownAPI,...(md?[md.url]:[])])allowedURLs.add(url)
   try{
    const api=await follow(urls.ownAPI);row.originalOwnAPIResponse=api;ensure(original(api),'native own original unavailable');row.originalNative=io.json(api)
    row.originalOwnHTML=await follow(variants[0]?.url||urls.generic);ensure(original(row.originalOwnHTML),'own original HTML unavailable')
    if(md){row.originalOwnMarkdown=await follow(md.url);ensure(original(row.originalOwnMarkdown),'own original markdown unavailable')}
    row.originalPageContext=validatePair(profile,id,variants,row.originalNative,row.originalOwnHTML,md,row.originalOwnMarkdown?.originalText)
    row.ownPairQualified=true
   }catch(error){signal?.throwIfAborted();row.issues.push(error.message);phase.selectedCollectionComplete=false}
   row.geography=geography(row.originalNative)
  },signal)
  // Network scheduling cannot change the declared posting order.
  const order=[...groups.keys()];phase.records.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id))
 }
 signal?.throwIfAborted()
 const merged=new Map(),employerBindingQualified=phases.every(p=>p.employerBindingQualified)
 for(const phase of phases)for(const row of phase.records){
  const prior=merged.get(row.id),history=[...(prior?.history||[]),{phase:phase.name,originalNative:row.originalNative,listingVariants:row.listingVariants,ownPairQualified:row.ownPairQualified,issues:row.issues}]
  const changed=prior&&prior.ownPairQualified&&(!row.ownPairQualified||!equal(prior.originalNative,row.originalNative)||!equal(prior.listingVariants,row.listingVariants))
  const selected=row.ownPairQualified||!prior?row:prior
  merged.set(row.id,{...selected,history,stableAcrossPhases:!changed&&(prior?.stableAcrossPhases??true),issues:[...new Set([...(prior?.issues||[]),...row.issues,...(changed?['native-post-changed-between-phases']:[])])]})
 }
 const observations=[...merged.values()]
 for(const row of observations){
  if(phases.some(p=>(p.listingReadQualified||p.markdownReadQualified)&&!p.records.some(r=>r.id===row.id))){row.stableAcrossPhases=false;row.issues.push('native-post-missing-from-complete-phase')}
  row.employerBindingQualified=employerBindingQualified;row.discoveryQualified=employerBindingQualified&&row.ownPairQualified&&row.stableAcrossPhases
  row.countrySelected=profile.countryFilter==='Global'||row.geography.countries.includes('India')||row.geography.unresolved
  row.candidateEligible=row.discoveryQualified&&row.countrySelected}
 const candidates=observations.filter(r=>r.candidateEligible).map(r=>projectJob(profile,r,observedAt)),jobs=maxJobs===null?candidates:candidates.slice(0,maxJobs)
 const issues=[...new Set([...phases.flatMap(p=>p.issues),...io.issues.map(i=>i.kind+': '+(i.url||'')),...observations.flatMap(r=>r.issues.map(s=>r.id+': '+s))])]
 const audit={source:profile.source,observedAt,countryFilter:profile.countryFilter,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  employerBindingQualified,companyDeclaredHandoff:phases.every(p=>p.companyDeclaredHandoff),selectedCollectionComplete:phases.every(p=>p.selectedCollectionComplete),candidateCount:candidates.length,returnedCount:jobs.length,
  observations,phases,issues,rawPages:io.rawPages,websiteJavaScriptExecuted:false,applicationActivationQualified:false,persistenceQualified:false}
 await onAudit(structuredClone(audit));signal?.throwIfAborted();await onRecords(structuredClone(observations));signal?.throwIfAborted()
 attachInventoryEvidence(jobs,{status:jobs.length?'discovery-only':'coverage-gap',surface:u.board,firstParty:employerBindingQualified,listingComplete:false,pagesFetched:io.rawPages.length,
  reportedTotal:null,indiaFacetCount:null,verifiedAt:null,reason:'selected-native-observations-only; whole-employer-and-country-scope-unqualified'+(issues.length?'; '+issues.join('; '):'')})
 attachSourceObservationEvidence(jobs,{source:profile.source,recordKind:'vacancy-rows',observedRecordCount:observations.length,observedVacancyCount:observations.length,sourceScopeComplete:false})
 return jobs
}})
