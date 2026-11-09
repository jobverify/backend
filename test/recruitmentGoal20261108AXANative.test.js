import test from 'node:test'
import assert from 'node:assert/strict'
import {createCatalogScraper,getScraperCatalog} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {fixture,replay,mutateBody,changeJSON} from './test-data/axaNative20261108.js'

const expected=fixture.expected,provider=()=>getScraperCatalog().find(value=>value.source==='axa')
const nativeRows=['native-india-page-1','native-india-page-2'].flatMap(label=>expected.models[label].nativeValue.jobs)
const run=(r,options={})=>createCatalogScraper(provider()).run({...r.options,...options})
async function observed(r,options={}){
 let audit=null,records=null,jobs=null,error=null
 try{jobs=await run(r,{...options,onAudit:async(value,...args)=>{audit=value;await options.onAudit?.(value,...args)},onRecords:async(value,...args)=>{records=value;await options.onRecords?.(value,...args)}})}catch(cause){error=cause}
 return{audit,records,jobs,error}
}

test('AXA registered extraction preserves all26 complete independent original models',async()=>{
 const r=replay(),o=await observed(r);assert.equal(o.error,null)
 assert.deepEqual(o.jobs.nativeCollectionEvidence.models,expected.models)
 assert.equal(o.audit.rawResponses.length,26);assert.equal(r.requests.length,26);assert.deepEqual(r.uncaptured,[])
})

test('AXA all15 native candidates and full details remain complete before country qualification',async()=>{
 const o=await observed(replay());assert.equal(o.error,null);assert.equal(o.records.length,15)
 for(const[index,row]of o.records.entries()){
  assert.deepEqual(row.sourceNativeListingRecord,nativeRows[index])
  assert.deepEqual(row.sourceNativeDetail,expected.models['native-detail-'+index])
  assert.equal(row.sourceNativeIdentityBound,true);assert.equal(row.sourceDetailComplete,true)
 }
})

test('AXA all346678 authored detail HTML characters survive without shorter listing substitution',async()=>{
 const o=await observed(replay());assert.equal(o.error,null)
 assert.equal(o.records.reduce((sum,row)=>sum+row.sourceNativeOwnDescriptionHTML.length,0),346678)
 for(const[index,row]of o.records.entries()){
  assert.equal(row.sourceNativeOwnDescriptionHTML,expected.models['native-detail-'+index].nativeValue.description)
  assert.notEqual(row.sourceNativeOwnDescriptionHTML,nativeRows[index].data.description)
  assert.equal(row.sourceNativeCriteriaComplete,true)
 }
})

test('AXA eleven conflicting detail country codes remain whole and unknown',async()=>{
 const o=await observed(replay());assert.equal(o.error,null)
 const held=o.records.filter(row=>row.sourceCountryScopeUnresolved)
 assert.equal(held.length,11)
 for(const row of held){assert.equal(row.country,null);assert.equal(row.sourceNativeCountryClaimConflict,true);assert.equal(row.sourceNativeDetail.nativeValue.country,'India');assert.equal(row.sourceNativeDetail.nativeValue.country_code,'RS');assert.equal(row.sourceCurrentNativeRoleQualified,false)}
 assert.deepEqual(o.jobs.map(row=>row.jobId),expected.indiaJobIDs)
})

test('AXA an own additional India location is eligible despite its consistent Poland primary',async()=>{
 const o=await observed(replay());assert.equal(o.error,null)
 const job=o.jobs.find(row=>row.jobId==='24090'),native=o.records.find(row=>row.jobId==='24090')
 assert.ok(job);assert.equal(job.country,'India');assert.equal(job.city,'GURUGRAM')
 assert.equal(native.country,'Poland');assert.deepEqual(native.sourceNativeLocations.map(value=>value.country),['Poland','India'])
 assert.equal(native.sourceNativeListingRecord.data.country,'Poland');assert.equal(native.sourceNativeDetail.nativeValue.country,'Poland')
})

test('AXA public native publication is distinguished from unknown country and rendered or hiring claims',async()=>{
 const o=await observed(replay());assert.equal(o.error,null)
 assert.equal(o.records.filter(row=>row.sourceNativeCurrentPublicationQualified).length,15)
 assert.equal(o.records.filter(row=>row.sourceCurrentNativeRoleQualified).length,4)
 assert.ok(o.records.every(row=>!row.sourceNativeCriteriaVisibilityQualified&&!row.activeApplyVerified&&!row.applicationVisited&&!row.sourceScopeComplete&&!row.lifecycleCleanupAllowed))
})

test('AXA zero and one-job output caps follow full native pagination details and closing',async()=>{
 for(const maxJobs of[0,1]){const r=replay(),o=await observed(r,{maxJobs});assert.equal(o.error,null);assert.equal(o.jobs.length,maxJobs);assert.equal(o.records.length,15);assert.equal(r.requests.length,26);assert.deepEqual(o.audit.models,expected.models)}
})

test('AXA awaited detached audit and record observers cannot mutate retained originals',async()=>{
 const events=[],o=await observed(replay(),{onAudit:async value=>{await new Promise(resolve=>setTimeout(resolve,2));value.models['native-detail-0'].nativeValue.description='edited';value.rawResponses.length=0;events.push('audit')},onRecords:async value=>{await new Promise(resolve=>setTimeout(resolve,2));value[0].sourceNativeOwnDescriptionHTML='edited';events.push('records')}})
 assert.equal(o.error,null);assert.deepEqual(events,['audit','records']);assert.deepEqual(o.jobs.nativeCollectionEvidence.models,expected.models);assert.equal(o.jobs.nativeCollectionEvidence.rawResponses.length,26)
})

test('AXA India candidate counts never become complete company totals or cleanup authority',async()=>{
 const o=await observed(replay());assert.equal(o.error,null)
 assert.deepEqual(readSourceObservationEvidence(o.jobs,'axa'),{source:'axa',recordKind:'vacancy-rows',observedRecordCount:15,observedVacancyCount:15,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 const inventory=readInventoryEvidence(o.jobs);assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null);assert.equal(inventory.listingComplete,false)
 assert.equal(o.audit.candidateQueryReportedTotal,15);assert.equal(o.audit.companyIndiaTotal,null);assert.equal(o.audit.companyGlobalTotal,null)
})

test('AXA effective registration clears stale sentinel backfill counts and validation claims',()=>{
 const value=provider();assert.equal(value.catalogOverride,true);assert.equal(value.parser,'live-parser');assert.equal(value.countryFilter,'India');assert.equal(value.atsPlatform,'first-party-and-jibe-public-native-json');assert.equal(value.runtimeValidation,null);assert.equal(value.backfillMode,null);assert.equal(value.verifiedIndiaJobCount,null);assert.equal(value.verifiedPublicJobCount,null);assert.equal(value.sourceScopeComplete,false);assert.equal(value.lifecycleCleanupAllowed,false)
})

test('AXA direct registered export and Global selection retain all native candidate models',async()=>{
 const{run:direct}=await import('../scraper/axa.workday/script.js')
 const jobs=await direct({...replay().options,countryFilter:'Global'});assert.equal(jobs.length,4)
 assert.equal(jobs.nativeCollectionEvidence.observations.length,15);assert.equal(jobs.find(row=>row.jobId==='24090').country,'Poland')
 assert.equal(jobs.nativeCollectionEvidence.candidateQueryCountry,'India')
})

test('AXA only exact anonymous declared requests include the native internal=false selector',async()=>{
 const r=replay(),o=await observed(r);assert.equal(o.error,null)
 assert.deepEqual(r.requests.map(value=>value.url),fixture.packets.map(value=>value.requestedURL))
 assert.ok(r.requests.every(value=>value.method==='GET'&&value.redirect==='manual'&&value.credentials==='omit'&&!value.url.includes('/login')&&!value.url.includes('/apply')))
 for(const request of r.requests.filter(value=>new URL(value.url).pathname==='/api/jobs'))assert.equal(new URL(request.url).searchParams.get('internal'),'false')
 assert.equal(o.audit.applicationActions,0);assert.equal(o.audit.publisherProgramsExecuted,false)
})

test('AXA complete native account assignments and both differing board configurations survive',async()=>{
 const o=await observed(replay());assert.equal(o.error,null)
 assert.equal(o.audit.models['redirected-public-board'].nativeAccount.env,'prod')
 assert.equal(o.audit.models['redirected-public-board'].nativeSettings.globalSearch.useStar,false)
 assert.equal(o.audit.models['closing-public-board'].nativeSettings.globalSearch.useStar,true)
 assert.equal(o.audit.closingVerified,true)
 assert.equal(o.audit.models['declared-search-client'].nativeSHA256,'8fa15e15e8165865026e2f5768af0160b4e1739096302d078e540131894c7f3f')
})

test('AXA a zero request budget fails before acquisition with inspectable empty evidence',async()=>{
 const r=replay(),o=await observed(r,{maxRequests:0});assert.equal(o.error?.code,'AXA_REQUEST_BUDGET');assert.equal(r.requests.length,0);assert.equal(o.error.nativeEvidence.rawResponses.length,0);assert.equal(o.error.nativeEvidence.observations.length,0)
})

test('AXA CMS bootstrap preserves every literal fallback and complete primary settings as data',async()=>{
 const o=await observed(replay());assert.equal(o.error,null)
 const primary=o.audit.models['current-primary']
 assert.deepEqual(primary,expected.models['current-primary'])
 assert.equal(primary.nativeSettings.contextSettings.currentClient,'axa')
 assert.deepEqual(primary.nativeAccount.models.jobs.core,{page_class:'jobs',page_subclass:'home'})
 assert.equal(primary.nativeConfigurationAssignments.length,7)
 assert.equal(primary.nativeConfigurationCarriers.length,2)
 assert.equal(o.audit.publisherProgramsExecuted,false)
})

import {execFile} from 'node:child_process'
import {fileURLToPath} from 'node:url'
const boardLabels=['redirected-public-board','closing-public-board']
function appendBody(source,markup){const index=source.lastIndexOf('</body>');assert.notEqual(index,-1);return source.slice(0,index)+markup+source.slice(index)}
function canonicalTag(source,href){const tags=[...source.matchAll(/<link\b[^>]*\brel\s*=\s*(['"])canonical\1[^>]*>/gi)].filter(match=>match[0].includes(href));assert.equal(tags.length,1);return tags[0][0]}
function replacePrimaryCanonical(source,value){const href=expected.models['current-primary'].head.canonicals[0],tag=canonicalTag(source,href);return source.replace(tag,tag.replace(href,value))}
function changeSettings(packet,edit){
 const assignment=expected.models[packet.label].nativeConfigurationAssignments.find(value=>value.target.length===1&&value.target[0]==='searchConfig'),value=structuredClone(assignment.value)
 edit(value);return mutateBody(packet,source=>{assert.ok(source.includes(assignment.nativeJavaScript));return source.replace(assignment.nativeJavaScript,'window.searchConfig='+JSON.stringify(value)+';')})
}

test('AXA contradictory active canonical claims hold before any public handoff',async()=>{
 const r=replay(packet=>{if(['current-primary','closing-primary'].includes(packet.label))mutateBody(packet,source=>replacePrimaryCanonical(source,'https://foreign.example/jobs'))}),o=await observed(r)
 assert.equal(o.error?.code,'AXA_NATIVE_PROOF');assert.equal(r.requests.length,1);assert.ok(o.error.nativeEvidence.models['current-primary'].head.canonicals.includes('https://foreign.example/jobs'))
})

test('AXA an active unmodeled configuration mutator cannot retain anonymous query authority',async()=>{
 const r=replay(packet=>{if(boardLabels.includes(packet.label))mutateBody(packet,source=>appendBody(source,'<script>Object.assign(window.searchConfig,{externalSearch:false});</script>'))}),o=await observed(r)
 assert.equal(o.error?.code,'AXA_NATIVE_PROOF');assert.equal(r.requests.length,3);assert.equal(o.error.nativeEvidence.rawResponses.at(-1).response.bodyComplete,true)
})

async function independentBoard(source){
 const program='import runpy,sys,json\nns=runpy.run_path(sys.argv[1])\ntry:\n result={"accepted":True,"model":ns["board"](sys.stdin.buffer.read().decode("utf-8"))}\nexcept (AssertionError,ValueError):\n result={"accepted":False}\nprint(json.dumps(result))'
 const path=fileURLToPath(new URL('./helpers/axaNativeConfigurationOracle20261108.py',import.meta.url))
 const result=await new Promise((resolve,reject)=>{const child=execFile('python',['-I','-B','-X','utf8','-c',program,path],{encoding:'utf8',timeout:30000,maxBuffer:1048576},(error,stdout,stderr)=>error?reject(Object.assign(error,{stdout,stderr})):resolve({stdout,stderr}));child.stdin.end(source)})
 assert.equal(result.stderr,'');return JSON.parse(result.stdout)
}

test('AXA independent oracle preserves both complete original board models from repository helpers',async()=>{
 for(const label of boardLabels){
  const packet=fixture.packets.find(value=>value.label===label)
  assert.deepEqual(await independentBoard(Buffer.from(packet.bodyBase64,'base64').toString('utf8')),{accepted:true,model:expected.models[label]})
 }
})

test('AXA independent oracle also refuses active unmodeled public-gate mutation',async()=>{
 const packet=fixture.packets.find(value=>value.label==='redirected-public-board'),source=appendBody(Buffer.from(packet.bodyBase64,'base64').toString('utf8'),'<script>Object.assign(window.searchConfig,{externalSearch:false});</script>')
 assert.deepEqual(await independentBoard(source),{accepted:false})
})

test('AXA unrelated non-JavaScript metadata sources do not replace or block the four active modules',async()=>{
 const r=replay(packet=>{if(boardLabels.includes(packet.label))mutateBody(packet,source=>appendBody(source,'<script type="application/json" src="https://foreign.example/prod/search/4.11.225/main.js"></script>'))}),o=await observed(r)
 assert.equal(o.error===null,true,o.error?.message);assert.equal(o.jobs.length,4);assert.deepEqual(o.audit.models['redirected-public-board'],expected.models['redirected-public-board']);assert.ok(o.audit.rawResponses[2].response.body.includes('application/json" src="https://foreign.example'))
})

test('AXA an inactive board title cannot grant public search authority',async()=>{
 const r=replay(packet=>{if(boardLabels.includes(packet.label))mutateBody(packet,source=>source.replace('<title>AXA Careers</title>','<template><title>AXA Careers</title></template>'))}),o=await observed(r)
 assert.equal(o.error?.code,'AXA_NATIVE_PROOF');assert.equal(r.requests.length,3)
})

test('AXA a foreign active main declaration remains evidence without a foreign request',async()=>{
 const r=replay(packet=>{if(boardLabels.includes(packet.label))mutateBody(packet,source=>source.replace('https://app.jibecdn.com/prod/search/4.11.225/main.js','https://foreign.example/prod/search/4.11.225/main.js'))}),o=await observed(r)
 assert.equal(o.error?.code,'AXA_NATIVE_PROOF');assert.equal(r.requests.length,3);assert.ok(o.error.nativeEvidence.models['redirected-public-board'].nativeRecruitmentScripts.at(-1).url.startsWith('https://foreign.example/'))
})

test('AXA only the exact declared public HTTP Location is followed',async()=>{
 const r=replay(packet=>{if(packet.label==='declared-all-jobs')packet.headers.location='https://foreign.example/jobs'}),o=await observed(r)
 assert.equal(o.error?.code,'AXA_NATIVE_PROOF');assert.equal(r.requests.length,2);assert.equal(o.error.nativeEvidence.models['declared-all-jobs'].declaredTarget,'https://foreign.example/jobs')
})

test('AXA duplicate native JSON country fields are retained as an original and refused',async()=>{
 const r=replay(packet=>{if(packet.label==='native-detail-0')mutateBody(packet,source=>source.replace(/^\{\s*/,'{"country_code":"XX",'))}),o=await observed(r)
 assert.equal(o.error?.code,'AXA_NATIVE_PROOF');assert.equal(r.requests.length,7);assert.equal(o.records.length,15);assert.equal(o.error.nativeEvidence.rawResponses.at(-1).response.bodyComplete,true)
})

test('AXA unfamiliar nested native fields and prototype names survive without polluting projections',async()=>{
 const extra=JSON.parse('{"__proto__":{"axaPollution":true},"clauses":["Own exact criterion",{"enabled":false}],"empty":[]}'),r=replay(packet=>{if(packet.label==='native-detail-0')changeJSON(packet,value=>{value.extra_native_terms=extra})}),o=await observed(r)
 assert.equal(o.error,null);assert.deepEqual(o.records[0].sourceNativeDetail.nativeValue.extra_native_terms,extra);assert.equal(Object.hasOwn(o.records[0].sourceNativeDetail.nativeValue.extra_native_terms,'__proto__'),true);assert.equal({}.axaPollution,undefined);assert.equal(o.records.length,15)
})

test('AXA a genuinely corrected own country can qualify without frozen role exclusions',async()=>{
 const r=replay(packet=>{if(packet.label==='native-detail-0')changeJSON(packet,value=>{value.country_code='IN'})}),o=await observed(r)
 assert.equal(o.error,null);assert.equal(o.jobs.length,5);assert.ok(o.jobs.some(value=>value.jobId==='20773'));assert.equal(o.records.filter(value=>value.sourceCountryScopeUnresolved).length,10)
})

test('AXA city description and India search cannot fill missing own country fields',async()=>{
 const r=replay(packet=>{if(packet.label.includes('native-india-page-'))changeJSON(packet,value=>{for(const row of value.jobs)if(row.data.req_id==='28368'){delete row.data.country;delete row.data.country_code}});if(packet.label==='native-detail-13')changeJSON(packet,value=>{delete value.country;delete value.country_code})}),o=await observed(r)
 assert.equal(o.error,null);assert.equal(o.jobs.length,3);const row=o.records.find(value=>value.jobId==='28368');assert.equal(row.country,null);assert.equal(row.city,expected.models['native-detail-13'].nativeValue.city);assert.equal(row.sourceCountryScopeUnresolved,true)
})

test('AXA a listing cannot donate the missing country of an additional detail location',async()=>{
 const r=replay(packet=>{if(packet.label==='native-detail-3')changeJSON(packet,value=>{delete value.additional_locations[0].country})}),o=await observed(r)
 assert.equal(o.error,null);assert.equal(o.jobs.some(value=>value.jobId==='24090'),false);assert.equal(o.records.find(value=>value.jobId==='24090').sourceCountryScopeUnresolved,true)
})

test('AXA an explicit private detail retains complete criteria without publication qualification',async()=>{
 const r=replay(packet=>{if(packet.label==='native-detail-12')changeJSON(packet,value=>{value.meta_data.icims.jps_is_public=false})}),o=await observed(r)
 assert.equal(o.error,null);assert.equal(o.jobs.length,3);const row=o.records.find(value=>value.jobId==='29423');assert.equal(row.sourceNativeCurrentPublicationQualified,false);assert.equal(row.sourceNativeCriteriaComplete,true);assert.deepEqual(row.sourceNativeDetail.nativeValue.description,expected.models['native-detail-12'].nativeValue.description)
})

test('AXA changing native totals preserve the entire second response before pagination stops',async()=>{
 const r=replay(packet=>{if(packet.label==='native-india-page-2')changeJSON(packet,value=>{value.totalCount=14;value.count=14})}),o=await observed(r)
 assert.equal(o.error?.code,'AXA_NATIVE_PROOF');assert.equal(r.requests.length,6);assert.equal(o.error.nativeEvidence.models['native-india-page-2'].nativeValue.jobs.length,5);assert.equal(o.error.nativeEvidence.rawResponses.length,6)
})

test('AXA repeated native identities retain full pages without duplicate detail requests',async()=>{
 const r=replay(packet=>{if(packet.label==='native-india-page-2')changeJSON(packet,value=>{value.jobs[0]=structuredClone(nativeRows[0])})}),o=await observed(r)
 assert.equal(o.error?.code,'AXA_NATIVE_PROOF');assert.equal(r.requests.length,6);assert.equal(o.records.length,15);assert.equal(o.error.nativeEvidence.models['native-india-page-2'].nativeValue.jobs.length,5)
})

test('AXA actual HTTP denial outranks a failing partial entity and ends acquisition',async()=>{
 const r=replay(packet=>{if(packet.label==='native-detail-2')packet.status=403}),base=r.options.fetchImpl,o=await observed(r,{fetchImpl:async(...args)=>{
  const original=await base(...args);if(String(args[0])!=='https://careers.axa.com/api/jobs/25853/en-us')return original
  await original.body.cancel();let pulls=0;const response=new Response(new ReadableStream({pull(controller){if(pulls++===0)controller.enqueue(new TextEncoder().encode('partial native denial'));else controller.error(Error('AXA denied stream failed'))}}),{status:403,headers:original.headers});Object.defineProperty(response,'url',{value:original.url});return response
 }})
 assert.equal(o.error.status,403);assert.equal(o.error.failureKind,'blocked_or_access_denied');assert.equal(r.requests.length,9);const packet=o.error.nativeEvidence.rawResponses.at(-1).response;assert.equal(packet.bodyComplete,false);assert.equal(packet.bodyBytes,21);assert.equal(packet.acquisitionFailure.message,'AXA denied stream failed');assert.equal(o.records.length,15)
})

test('AXA incorrect native JSON MIME preserves complete bytes before parsing is withheld',async()=>{
 const r=replay(packet=>{if(packet.label==='native-detail-0')packet.headers['content-type']='text/html'}),o=await observed(r)
 assert.equal(o.error?.code,'AXA_NATIVE_PROOF');assert.equal(r.requests.length,7);assert.equal(o.error.nativeEvidence.rawResponses.at(-1).response.bodyComplete,true);assert.equal(o.error.nativeEvidence.models['native-detail-0'],undefined)
})

test('AXA a mismatched original response identity cannot qualify a detail',async()=>{
 const r=replay(packet=>{if(packet.label==='native-detail-0')packet.url='https://foreign.example/jobs/20773'}),o=await observed(r)
 assert.equal(o.error?.code,'AXA_RESPONSE_IDENTITY');assert.equal(r.requests.length,7);assert.equal(o.error.nativeEvidence.rawResponses.at(-1).response.identityValidated,false)
})

test('AXA an identity entity length mismatch retains EOF bytes without completeness claims',async()=>{
 const r=replay(packet=>{if(packet.label==='current-primary'){packet.headers['content-encoding']='identity';packet.headers['content-length']=String(packet.bodyBytes+1)}}),o=await observed(r)
 assert.equal(o.error?.code,'AXA_BODY_LENGTH_MISMATCH');assert.equal(r.requests.length,1);const packet=o.error.nativeEvidence.rawResponses[0].response;assert.equal(packet.streamEOFObserved,true);assert.equal(packet.bodyComplete,false);assert.equal(packet.bodyBytes,fixture.packets[0].bodyBytes)
})

test('AXA detail budget exhaustion retains every complete candidate before any detail',async()=>{
 const r=replay(),o=await observed(r,{maxRequests:6});assert.equal(o.error?.code,'AXA_REQUEST_BUDGET');assert.equal(r.requests.length,6);assert.equal(o.records.length,15);assert.equal(o.error.nativeEvidence.candidateQueryReportedTotal,15);assert.ok(o.records.every(value=>value.sourceNativeDetail===null))
})

test('AXA finite page limits cannot silently truncate native inventory',async()=>{
 const r=replay(),o=await observed(r,{maxPages:1});assert.equal(o.error?.code,'AXA_INVALID_OPTIONS');assert.equal(r.requests.length,0)
})

test('AXA a rejected audit retains its exact frozen cause and complete native models',async()=>{
 const cause=Object.freeze(Error('AXA audit rejected'));let records=false
 const o=await observed(replay(),{onAudit:async()=>{throw cause},onRecords:async value=>{records=value.length===15}})
 assert.equal(o.error.cause,cause);assert.equal(records,true);assert.deepEqual(o.error.nativeEvidence.models,expected.models);assert.equal(o.error.nativeEvidence.rawResponses.length,26)
})

test('AXA exact false cancellation owns ignored late acquisition without changing retained evidence',async()=>{
 const r=replay(),base=r.options.fetchImpl,controller=new AbortController();let timer
 const o=await observed(r,{signal:controller.signal,fetchImpl:async(...args)=>{const response=await base(...args);timer=setTimeout(()=>controller.abort(false),5);await new Promise(resolve=>setTimeout(resolve,60));return response}});clearTimeout(timer)
 assert.equal(o.error,false);const{readAXAFailureEvidence}=await import('../scraper/axa.workday/native20261108.js'),proof=readAXAFailureEvidence(controller.signal);assert.equal(proof.rawResponses.length,0);await new Promise(resolve=>setTimeout(resolve,85));assert.deepEqual(readAXAFailureEvidence(controller.signal),proof)
})

test('AXA source lifetime outranks ignored longer acquisition without late evidence mutation',async()=>{
 const r=replay(),base=r.options.fetchImpl,o=await observed(r,{sourceTimeoutMs:15,readTimeoutMs:100,fetchImpl:async(...args)=>{const response=await base(...args);await new Promise(resolve=>setTimeout(resolve,60));return response}})
 assert.equal(o.error?.code,'AXA_NATIVE_TIMEOUT');assert.equal(o.error.nativeEvidence.rawResponses.length,0);const proof=structuredClone(o.error.nativeEvidence);await new Promise(resolve=>setTimeout(resolve,85));assert.deepEqual(o.error.nativeEvidence,proof)
})

test('AXA bounded audit refusal preserves all native models without late observer mutation',async()=>{
 const o=await observed(replay(),{auditTimeoutMs:25,onAudit:async value=>{await new Promise(resolve=>setTimeout(resolve,80));value.models['native-detail-0'].nativeValue.description='late edit'}})
 assert.equal(o.error?.code,'AXA_AUDIT_TIMEOUT');assert.equal(o.error.nativeEvidence.rawResponses.length,26);const proof=structuredClone(o.error.nativeEvidence);await new Promise(resolve=>setTimeout(resolve,90));assert.deepEqual(o.error.nativeEvidence,proof)
})

test('AXA contradictory active board canonicals hold before client or native API reads',async()=>{
 const r=replay(packet=>{if(boardLabels.includes(packet.label))mutateBody(packet,source=>{const href=expected.models[packet.label].head.canonicals[0],tag=canonicalTag(source,href);return source.replace(tag,tag.replace(href,'https://foreign.example/jobs'))})}),o=await observed(r)
 assert.equal(o.error?.code,'AXA_NATIVE_PROOF');assert.equal(r.requests.length,3);assert.ok(o.error.nativeEvidence.models['redirected-public-board'].head.canonicals.includes('https://foreign.example/jobs'))
})

test('AXA optional canonical absence preserves independently bound public account and role evidence',async()=>{
 for(const labels of[['current-primary','closing-primary'],boardLabels]){
  const r=replay(packet=>{if(labels.includes(packet.label))mutateBody(packet,source=>source.replace(canonicalTag(source,expected.models[packet.label].head.canonicals[0]),''))}),o=await observed(r)
  assert.equal(o.error===null,true,o.error?.message);assert.equal(o.jobs.length,4);assert.deepEqual(o.audit.models[labels[0]].head.canonicals,[]);assert.equal(o.audit.closingVerified,true)
 }
})


// One whole-repair review, one substantive regression/fix pass.
for(const[label,markup]of[
 ['module','<script type="module">window.searchConfig.externalSearch=false;</script>'],
 ['alias','<script>const c = window.searchConfig; c.externalSearch=false;</script>']
]){
 test('AXA review rejects active '+label+' public-gate mutation before query requests',async()=>{
  const r=replay(packet=>{if(boardLabels.includes(packet.label))mutateBody(packet,source=>appendBody(source,markup))}),o=await observed(r)
  assert.equal(o.error?.code,'AXA_NATIVE_PROOF');assert.equal(r.requests.length,3)
  assert.equal(o.error.nativeEvidence.rawResponses.at(-1).response.bodyComplete,true)
  assert.ok(o.audit);assert.equal(o.jobs,null)
 })
 test('AXA review independent repository oracle cannot preserve a stale gate after '+label+' mutation',async()=>{
  const packet=fixture.packets.find(value=>value.label==='redirected-public-board')
  const source=appendBody(Buffer.from(packet.bodyBase64,'base64').toString('utf8'),markup)
  const result=await independentBoard(source);if(label==='module')assert.ok(!result.accepted||result.model.nativeSettings.externalSearch===false);else assert.deepEqual(result,{accepted:false})
 })
}

for(const[label,bad]of[['null',null],['object',{other:'retained'}]]){
 test('AXA review retains malformed '+label+' listing in total failure observations',async()=>{
  const r=replay(packet=>{if(packet.label==='native-india-page-1')changeJSON(packet,value=>{value.jobs[0]=bad})}),o=await observed(r)
  assert.equal(o.error?.code,'AXA_NATIVE_PROOF');assert.equal(r.requests.length,5)
  assert.ok(o.audit);assert.equal(o.records.length,10);assert.equal(o.jobs,null)
  assert.deepEqual(o.error.nativeEvidence.models['native-india-page-1'].nativeValue.jobs[0],bad)
  assert.deepEqual(o.records[0].sourceNativeListingRecord,bad);assert.equal(o.records[0].jobId,null)
  assert.equal(o.records[0].sourceUrl,null);assert.equal(o.records[0].sourceNativeIdentityBound,false)
  assert.equal(o.error.nativeEvidence.rawResponses.at(-1).response.bodyComplete,true)
 })
}

for(const variant of['removal','addition','reverse']){
 test('AXA review holds useStar '+variant+' outside the admitted board boolean transition',async()=>{
  const r=replay(packet=>{
   if(variant==='removal'&&packet.label==='closing-public-board')changeSettings(packet,value=>{delete value.globalSearch.useStar})
   if(variant==='addition'&&packet.label==='redirected-public-board')changeSettings(packet,value=>{delete value.globalSearch.useStar})
   if(variant==='reverse'&&boardLabels.includes(packet.label))changeSettings(packet,value=>{value.globalSearch.useStar=packet.label==='redirected-public-board'})
  }),o=await observed(r)
  assert.equal(o.error?.code,'AXA_NATIVE_CLOSING_CONFLICT');assert.equal(r.requests.length,25)
  assert.equal(o.error.nativeEvidence.closingVerified,false);assert.equal(o.records.length,15);assert.equal(o.jobs,null)
 })
}

test('AXA review never applies the board useStar exception to primary configuration',async()=>{
 const r=replay(packet=>{if(['current-primary','closing-primary'].includes(packet.label))changeSettings(packet,value=>{value.globalSearch={useStar:packet.label==='closing-primary'}})}),o=await observed(r)
 assert.equal(o.error?.code,'AXA_NATIVE_CLOSING_CONFLICT');assert.equal(r.requests.length,26);assert.equal(o.jobs,null)
})

test('AXA review permits unchanged board booleans under unchanged complete native rows',async()=>{
 for(const flag of[false,true]){
  const r=replay(packet=>{if(boardLabels.includes(packet.label))changeSettings(packet,value=>{value.globalSearch.useStar=flag})}),o=await observed(r)
  assert.equal(o.error,null);assert.equal(o.jobs.length,4);assert.equal(o.audit.closingVerified,true)
 }
})

test('AXA review counts substantive description plus complete supported responsibilities',async()=>{
 const description='<p>Build reliable data systems.</p>',responsibilities='<p>'+('Own native source validation and maintain reliable hiring data. '.repeat(5))+'</p>'
 const r=replay(packet=>{if(packet.label==='native-detail-12')changeJSON(packet,value=>{value.description=description;value.responsibilities=responsibilities})}),o=await observed(r)
 assert.equal(o.error,null);const job=o.jobs.find(value=>value.jobId==='29423');assert.ok(job)
 assert.equal(job.sourceNativeOwnDescriptionHTML,description);assert.ok(job.sourceDescription.includes(responsibilities));assert.equal(job.sourceNativeCriteriaComplete,true)
})

test('AXA review reads pure literal inline modules while retaining the original analytics bootstrap',async()=>{
 const markup='<script type="module">window.searchConfig.review_literal_marker=true;</script>'
 const r=replay(packet=>{if(boardLabels.includes(packet.label))mutateBody(packet,source=>appendBody(source,markup))}),o=await observed(r)
 assert.equal(o.error,null);assert.equal(o.jobs.length,4)
 assert.equal(o.audit.models['redirected-public-board'].nativeSettings.review_literal_marker,true)
 const packet=fixture.packets.find(value=>value.label==='redirected-public-board')
 const independent=await independentBoard(appendBody(Buffer.from(packet.bodyBase64,'base64').toString('utf8'),markup))
 assert.equal(independent.accepted,true);assert.equal(independent.model.nativeSettings.review_literal_marker,true)
})
