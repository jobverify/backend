import {readFileSync} from 'node:fs'
import provider from './catalog.js'
import {inspectPublisher,moduleProof,nativeAppState,sha,stable} from './publisherScope.js'
import {createPublishingGapAtsScraper} from '../../scraper-support/utils/publishingGapAts.js'
import {verifyUnavailableAshbyRoles} from '../../scraper-support/utils/ashbyScopeEvidence.js'
import {extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createBasetenHttpReader} from './currentHttp.js'

const review=JSON.parse(readFileSync(new URL('./currentScope.json',import.meta.url),'utf8'))
const same=(a,b)=>stable(a)===stable(b),norm=v=>typeof v==='string'?v.replace(/\s+/g,' ').trim():''
const fail=message=>{const error=new Error('[baseten] '+message);Object.assign(error,{abortRetries:true,failureKind:'source_identity_unverified'});throw error}
const countryCodes=new Map([['United States','US'],['United Kingdom','GB'],['Canada','CA'],['India','IN']])
const rowFields=['id','title','department','team','employmentType','location','secondaryLocations','publishedAt','isListed','isRemote','workplaceType','address','jobUrl','applyUrl','descriptionHtml','descriptionPlain']
const keys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key))
// Native __appData is read as an AST-validated literal, never executed. The
// publisher's per-response CSP nonce is retained in raw HTML and audit; it is
// neither a role field nor substituted into any executable scope signature.
const nativeDataAttributes=attrs=>keys(attrs,['nonce'])&&Object.keys(attrs).length===1&&typeof attrs.nonce==='string'&&/^[A-Za-z0-9_-]{43}$/.test(attrs.nonce)
const isoDate=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))return false;const day=value.slice(0,10);return new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day}

function inspectNative(payload){
 const reasons=[],proofs=[]
 if(!keys(payload,['jobs','apiVersion'])||payload.apiVersion!=='1'||!Array.isArray(payload.jobs))fail('native complete envelope unavailable')
 if(payload.jobs.length>2000)fail('native response role bound exceeded')
 const ids=new Set()
 for(const row of payload.jobs){
  const issues=[],note=(ok,reason)=>{if(!ok)issues.push(reason)}
  note(keys(row,rowFields)&&rowFields.every(key=>Object.hasOwn(row,key)),'unknown-role-schema')
  if(!row||typeof row.id!=='string'||ids.has(row.id))fail('native role identity missing or duplicated')
  ids.add(row.id)
  note(row.isListed===true&&typeof row.isRemote==='boolean','unreviewed-active-status')
  note(rowFields.filter(k=>!['secondaryLocations','isListed','isRemote','address'].includes(k)).every(k=>typeof row[k]==='string'),'invalid-native-role-field-types')
  note(isoDate(row.publishedAt),'invalid-native-publication-date')
  note(sha(stable(row))===review.roleHashes[row.id],'unreviewed-role-content-or-criteria')
  note(Array.isArray(row.secondaryLocations),'invalid-location-array')
  const locationProofs=[]
  for(const [index,location]of [row,...(Array.isArray(row.secondaryLocations)?row.secondaryLocations:[])].entries()){
   const address=location?.address,postal=address?.postalAddress
   note(index===0||keys(location,['location','address']),'unknown-secondary-location-fields')
   note(keys(address,['postalAddress'])&&keys(postal,['addressCountry','addressLocality','addressRegion','streetAddress','postalCode'])&&Object.values(postal||{}).every(v=>typeof v==='string'),'unknown-postal-country-schema')
   const code=countryCodes.get(postal?.addressCountry)
   note(!!code,'native-country-unknown')
   note(typeof location?.location==='string'&&!/\b(?:worldwide|anywhere|global|APAC|EMEA|LATAM)\b/i.test(location.location),'unresolved-role-location-label')
   locationProofs.push({index,label:location?.location,rawAddress:address,country:postal?.addressCountry??null,countryCode:code??null,provenance:'native-role-assigned-postal-address'})
  }
  try{const text=extractActiveDescription(row.descriptionHtml),doc=readVisibleNativeDocument(row.descriptionHtml,{strict:true}),visible=doc.text(doc.nodes(n=>n.tag==='root')[0]);note(Boolean(text)&&text===visible&&norm(row.descriptionPlain).length>0,'native-full-visible-criteria-unavailable')}catch{issues.push('native-criteria-visibility-unresolved')}
  const fullCriteriaCopyComplete=issues.length===0
  const assignedDescriptionGap=review.roleOwnedDescriptionLocationGaps.find(gap=>gap.jobId===row.id)
  if(assignedDescriptionGap)issues.push('role-owned-description-geography-unresolved')
  proofs.push({jobId:row.id,rawRole:row,rawRoleSha256:sha(stable(row)),countryProofs:locationProofs,fullCriteriaCopyComplete,geographyComplete:issues.length===0,assignedDescriptionGap:assignedDescriptionGap??null,fullDetailComplete:issues.length===0,reasons:issues})
  reasons.push(...issues.map(reason=>reason+':'+row.id))
 }
 if(sha(stable(payload))!==review.nativePayloadSha256)reasons.push('unreviewed-native-complete-cohort')
 return {reasons,proofs,ids:[...ids]}
}

export async function runCurrentBasetenInventory(options={}){
 const requestTimeoutMs=options.requestTimeoutMs??10000,collectionTimeoutMs=options.collectionTimeoutMs??120000
 if(!Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>30000||!Number.isSafeInteger(collectionTimeoutMs)||collectionTimeoutMs<1||collectionTimeoutMs>180000)fail('invalid request or collection deadline')
 const deadline=new AbortController(),timer=setTimeout(()=>deadline.abort(new Error('[baseten] collection deadline exceeded')),collectionTimeoutMs)
 const signal=options.signal?AbortSignal.any([options.signal,deadline.signal]):deadline.signal
 try{return await collectCurrentBasetenInventory({...options,requestTimeoutMs,signal})}finally{clearTimeout(timer)}
}

async function collectCurrentBasetenInventory(options){
 if(['fetchJson','fetchText','fetchPage'].some(k=>options[k])||options.maxJobs!=null||options.maxPages!=null)fail('native HTTP metadata required; body-only overrides and inventory caps unsupported')
 const {fetchImpl=fetch,signal,onAudit}=options,reasons=new Set(),receipts=[]
 const note=(ok,reason)=>{if(!ok)reasons.add(reason);return ok}
 const request=createBasetenHttpReader({fetchImpl,signal,fail,receipts,requestTimeoutMs:options.requestTimeoutMs})
 async function snapshot(phase){
  const official=await request(review.official,'html');let publisher=null
  try{publisher=inspectPublisher(official.body,review.official);note(publisher.domSha256===review.publisher.domSha256&&publisher.streamSha256===review.publisher.streamSha256&&publisher.departmentsSha256===review.publisher.departmentsSha256,'unreviewed-publisher-whole-dom-flight-or-hiring-scope')}
  catch(error){reasons.add('publisher-route-binding-unavailable:'+error.message)}
  const payloadResponse=await request(review.feed,'json'),payload=JSON.parse(payloadResponse.body),native=inspectNative(payload)
  native.reasons.forEach(reason=>reasons.add(reason))
  // Run the strongest unchanged public ATS validator on the ORIGINAL complete
  // JSON. No projected feed, rewritten HTML, country default or synthetic link.
  const strongestJobs=await createPublishingGapAtsScraper(provider).run({fetchJson:async url=>{if(url!==review.feed)fail('unexpected strongest-engine endpoint');return payload},signal}),strongestEvidence=readInventoryEvidence(strongestJobs)
  note(strongestEvidence?.reason==='ashby-public-posting-api-incomplete:provider-source-scope-unresolved','strongest-engine-additional-incomplete-reasons')
  const boardResponse=await request(review.board,'html');let board=null
  try{const state=nativeAppState(boardResponse.body);board=state.app
   note(state.bootstrapSha256===review.nativeAppBootstrap.sha256&&nativeDataAttributes(state.attrs),'unreviewed-native-board-bootstrap')
   note(sha(stable(board))===review.nativeBoardAppSha256,'unreviewed-native-board-state')
   note(board.environment==='production'&&board.maintenanceMode===false&&board.schedulingMaintenanceMode===false&&board.organization?.organizationId==='cd6e3ffd-856f-4739-903c-c192a5c1dc54'&&board.organization.name==='Baseten'&&board.organization.publicWebsite==='https://www.baseten.co/'&&board.organization.hostedJobsPageSlug==='baseten'&&board.posting===null,'native-employer-identity-unavailable')
   const posts=board.jobBoard?.jobPostings
   note(Array.isArray(posts)&&posts.length===payload.jobs.length&&new Set(posts.map(p=>p.id)).size===posts.length&&posts.every(p=>payload.jobs.some(row=>row.id===p.id&&row.title===p.title&&row.location===p.locationName&&row.workplaceType===p.workplaceType&&row.employmentType===p.employmentType)),'native-board-complete-id-title-contract-changed')
  }catch(error){reasons.add('native-board-state-unavailable:'+error.message)}
  const currentPublisher=publisher?.format==='turbopack-literal-job-list'
  const assets=[]
  // Replaced publisher programs must be qualified from their current literal
  // declarations. Never request a stale October asset or stale advertised role
  // as if the redesigned page still declared it.
  const declaredAssets=currentPublisher?publisher.declarations:publisher?review.assets:[]
  if(!publisher)reasons.add('publisher-declared-program-scope-unavailable')
  for(const asset of declaredAssets){
   if(!asset.sha256){reasons.add('unreviewed-declared-asset:'+asset.url);assets.push({...asset,verified:false,reason:'actual-program-or-style-response-not-yet-reviewed'});continue}
   try{const result=await request(asset.url,asset.kind),proof={...asset,actualSha256:result.receipt.sha256,actualContentType:result.receipt.contentType,verified:result.receipt.sha256===asset.sha256&&result.receipt.contentType===asset.contentType}
    note(proof.verified,'declared-asset-program-style-or-metadata-changed:'+asset.url)
    for(const expected of review.modules.filter(m=>m.url===asset.url)){const actual=moduleProof(result.body,expected.id);note(actual.sha256===expected.sha256,'reviewed-renderer-module-dataflow-changed:'+expected.id);proof.moduleProof={id:actual.id,sha256:actual.sha256,reviewedDataflow:expected.reviewedDataflow}}
    assets.push(proof)
   }catch(error){signal?.throwIfAborted();reasons.add('declared-asset-unavailable:'+asset.url);assets.push({...asset,verified:false,error:error.message})}
  }
  const cms=currentPublisher?publisher.jobs:publisher?.departments.flatMap(d=>d.jobs)||[],cmsId=row=>currentPublisher?row.id:row.applicationId,cmsIds=[...new Set(cms.map(cmsId))],nativeIds=new Set(native.ids)
  if(publisher){
   if(!currentPublisher)note(publisher.departments.every(d=>d.jobsMeta?.count===d.jobs.length),'cms-department-count-unreconciled')
   for(const row of cms){const id=cmsId(row),match=payload.jobs.find(j=>j.id===id),alias=review.titleAliases.find(a=>a.id===id&&a.cmsTitle===row.title&&a.nativeTitle===match?.title)
    if(match)note(norm(row.title)===norm(match.title)||!currentPublisher&&!!alias,'unreviewed-cms-native-title-alias:'+id)
   }
   note(same(cmsIds.filter(id=>!nativeIds.has(id)).sort(),currentPublisher?[]:review.cmsOnly.map(r=>r.id).sort()),'unreviewed-advertised-cms-only-role')
   note(same(native.ids.filter(id=>!cmsIds.includes(id)).sort(),currentPublisher?[]:review.nativeOnly.map(r=>r.id).sort()),'unreviewed-native-only-role')
  }
  const unavailable=[]
  for(const missing of publisher&&!currentPublisher?review.cmsOnly:[]){
   for(const suffix of ['', '/']){
    const url=review.board+'/'+missing.id+suffix
    try{const result=await request(url,'html',404),state=nativeAppState(result.body)
     note(state.bootstrapSha256===review.unavailableAppBootstrap.sha256&&nativeDataAttributes(state.attrs),'unreviewed-unavailable-role-bootstrap')
     note(sha(stable(state.app))===review.unavailableNativeAppSha256,'unreviewed-unavailable-role-null-state')
     // Invoke the unchanged validator only on the actual canonical response.
     // The published trailing-slash variant is independently reconciled to
     // that same typed native null state, retaining its actual URL and bytes.
     const checked=suffix?{proofs:state.app.environment==='production'&&state.app.maintenanceMode===false&&state.app.schedulingMaintenanceMode===false&&state.app.organization===null&&state.app.posting===null&&state.app.jobBoard===null&&!/verify you are human|checking your browser|access denied|cf-chl-/i.test(result.body)?[{jobId:missing.id,url,status:404,method:'native-ashby-unavailable-role-state',sha256:result.receipt.nativeTextSha256}]:[],failures:[]}:await verifyUnavailableAshbyRoles([missing.id],{boardToken:'baseten'},{fetchPage:async canonical=>({status:result.receipt.status,url:result.receipt.finalUrl,html:result.body}),signal})
     note(checked.proofs.length===1&&checked.failures.length===0,'advertised-role-unavailability-unproved:'+missing.id)
     unavailable.push({...result.receipt,jobId:missing.id,method:'native-ashby-unavailable-role-state',canonicalValidatorProof:checked.proofs[0]??null,rawNativeApp:state.app})
    }catch(error){signal?.throwIfAborted();reasons.add('advertised-role-terminal-state-unavailable:'+missing.id);unavailable.push({jobId:missing.id,url,error:error.message})}
   }
  }
  return {phase,officialBody:official.body,publisher,payload,native,board,strongestEvidence,strongestJobs,assets,cms,cmsIds,unavailable}
 }
 const opening=await snapshot('opening'),closing=await snapshot('closing')
 signal?.throwIfAborted()
 note(same(opening.payload,closing.payload),'native-closing-cohort-or-full-criteria-changed')
 note(opening.publisher?.domSha256===closing.publisher?.domSha256&&opening.publisher?.streamSha256===closing.publisher?.streamSha256,'publisher-closing-scope-changed')
 note(same(opening.board,closing.board),'native-board-closing-state-changed')
 const complete=reasons.size===0,healthy=new Map(opening.native.proofs.map(p=>[p.jobId,p.fullDetailComplete&&closing.native.proofs.some(c=>c.jobId===p.jobId&&c.fullDetailComplete&&c.rawRoleSha256===p.rawRoleSha256)]))
 const jobs=opening.strongestJobs.map(job=>({...job,companyCareerPage:review.official,sourceScopeComplete:complete,sourceListingComplete:complete,lifecycleCleanupAllowed:complete,sourceDetailComplete:healthy.get(job.jobId)===true}))
 const nativeCountryScopeUnresolvedRoleIds=[...new Set([...opening.native.proofs,...closing.native.proofs].filter(p=>!p.geographyComplete).map(p=>p.jobId))].sort()
 const fullNativeCriteriaCopies=opening.native.proofs.filter(p=>p.fullCriteriaCopyComplete&&closing.native.proofs.some(c=>c.jobId===p.jobId&&c.fullCriteriaCopyComplete&&c.rawRoleSha256===p.rawRoleSha256)).length
 const audit={source:'baseten',productionWrites:false,complete,sourceScopeComplete:complete,lifecycleCleanupAllowed:complete,nativeCount:opening.payload.jobs.length,closingNativeCount:closing.payload.jobs.length,retainedNativeCriteriaCopies:opening.payload.jobs.filter(row=>typeof row.descriptionHtml==='string'&&row.descriptionHtml.length>0&&typeof row.descriptionPlain==='string'&&row.descriptionPlain.length>0).length,fullNativeCriteriaCopies,fullNativeDetails:opening.native.proofs.filter(p=>healthy.get(p.jobId)).length,nativeCountryScopeUnresolvedRoleIds,reasons:[...reasons],opening,closing,receipts,originalNativePayloadPreserved:true,publisherJavaScriptExecuted:false}
 Object.defineProperty(jobs,'sourceAudit',{value:audit});onAudit?.(structuredClone(audit))
 signal?.throwIfAborted()
 attachSourceObservationEvidence(jobs,{source:'baseten',recordKind:'vacancy-rows',observedRecordCount:opening.payload.jobs.length,observedVacancyCount:opening.payload.jobs.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 return attachInventoryEvidence(jobs,{status:complete?'complete-inventory':'discovery-only',firstParty:true,listingComplete:complete,surface:review.feed,pagesFetched:receipts.length,reportedTotal:complete||opening.publisher?.format==='webpack-departments'?opening.payload.jobs.length:null,indiaFacetCount:complete?opening.strongestEvidence.indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:complete?'baseten-native-and-actual-publisher-complete-closed-cohort':'baseten-source-scope-unresolved:'+audit.reasons.join(';')})
}
