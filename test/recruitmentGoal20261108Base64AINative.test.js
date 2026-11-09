import test from 'node:test'
import assert from 'node:assert/strict'
import {createCatalogScraper,getScraperCatalog} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {fixture,replay,mutateBody} from './test-data/base64aiNative20261108.js'

const expected=fixture.expected,provider=()=>getScraperCatalog().find(value=>value.source==='base64ai')
const run=(r,options={})=>createCatalogScraper(provider()).run({...r.options,...options})
async function observed(r,options={}){
 let audit=null,records=null,jobs=null,error=null
 try{jobs=await run(r,{...options,onAudit:async(value,...args)=>{audit=value;await options.onAudit?.(value,...args)},onRecords:async(value,...args)=>{records=value;await options.onRecords?.(value,...args)}})}catch(cause){error=cause}
 return{audit,records,jobs,error}
}

test('Base64.ai registered extraction preserves both complete independent original models',async()=>{
 const r=replay(),o=await observed(r);assert.equal(o.error,null)
 assert.deepEqual(o.jobs.nativeCollectionEvidence.models,expected.models)
 assert.equal(o.audit.rawResponses.length,2);assert.equal(r.requests.length,2);assert.deepEqual(r.uncaptured,[])
})

test('Base64.ai all four complete role records survive the empty India selection',async()=>{
 const o=await observed(replay());assert.equal(o.error,null);assert.equal(o.jobs.length,0);assert.equal(o.records.length,4)
 assert.deepEqual(o.records.map(row=>row.sourceNativeRecord),expected.models['current-primary'].nativeRoles)
 assert.deepEqual(o.records.map(row=>row.country),expected.countries)
})

test('Base64.ai retains all17231 original authored criteria HTML characters',async()=>{
 const o=await observed(replay());assert.equal(o.error,null)
 assert.equal(o.records.reduce((sum,row)=>sum+Array.from(row.sourceNativeOwnDescriptionHTML).length,0),17231)
 for(const[index,row]of o.records.entries()){
  assert.equal(row.sourceNativeOwnDescriptionHTML,expected.models['current-primary'].nativeRoles[index].nativeContentHTML)
  assert.equal(row.sourceDescription,row.sourceNativeOwnDescriptionHTML);assert.equal(row.sourceNativeCriteriaComplete,true)
 }
})

test('Base64.ai Global returns all four independently country-bound observed roles',async()=>{
 const o=await observed(replay(),{countryFilter:'Global'});assert.equal(o.error,null);assert.equal(o.jobs.length,4)
 assert.deepEqual(o.jobs.map(row=>row.country),['Turkey','United States','Turkey','Turkey'])
 assert.deepEqual(o.jobs.map(row=>row.title),expected.qualification.map(row=>row.title));assert.equal(new Set(o.jobs.map(row=>row.jobId)).size,4)
 assert.ok(o.jobs.every(row=>row.sourceNativeIdentityBound&&row.sourceCurrentNativeRoleQualified))
})

test('Base64.ai absent native IDs and dates stay nullable while adapter keys are explicitly synthetic',async()=>{
 const o=await observed(replay(),{countryFilter:'Global'});assert.equal(o.error,null)
 for(const row of o.jobs){assert.equal(row.sourceNativePostingId,null);assert.equal(row.postingDate,null);assert.equal(row.closingDate,null);assert.equal(row.jobIdIsSynthetic,true);assert.equal(typeof row.jobId,'string')}
 const second=await observed(replay(),{countryFilter:'Global'});assert.equal(second.error,null);assert.deepEqual(second.jobs.map(row=>row.jobId),o.jobs.map(row=>row.jobId))
})

test('Base64.ai current native publication does not claim collapsed rendering hiring or application completion',async()=>{
 const o=await observed(replay());assert.equal(o.error,null);assert.equal(o.audit.closingVerified,true)
 assert.ok(o.records.every(row=>row.sourceNativeCurrentPublicationQualified&&row.sourceNativeCriteriaComplete&&!row.sourceNativeCriteriaVisibilityQualified&&!row.activeApplyVerified&&!row.applicationVisited&&!row.sourceScopeComplete&&!row.lifecycleCleanupAllowed))
 assert.ok(o.records.every(row=>row.sourceNativeDisclosureOpen===false))
})

test('Base64.ai zero and one-job caps follow complete acquisition and retained Global evidence',async()=>{
 for(const maxJobs of[0,1]){const r=replay(),o=await observed(r,{maxJobs,countryFilter:'Global'});assert.equal(o.error,null);assert.equal(o.jobs.length,maxJobs);assert.equal(o.records.length,4);assert.equal(r.requests.length,2);assert.deepEqual(o.audit.models,expected.models)}
})

test('Base64.ai detached awaited observers cannot edit full originals or role bodies',async()=>{
 const events=[],o=await observed(replay(),{onAudit:async value=>{await new Promise(resolve=>setTimeout(resolve,2));value.models['current-primary'].nativeRoles[0].nativeContentHTML='edited';value.rawResponses.length=0;events.push('audit')},onRecords:async value=>{await new Promise(resolve=>setTimeout(resolve,2));value[0].sourceNativeOwnDescriptionHTML='edited';events.push('records')}})
 assert.equal(o.error,null);assert.deepEqual(events,['audit','records']);assert.deepEqual(o.jobs.nativeCollectionEvidence.models,expected.models);assert.equal(o.jobs.nativeCollectionEvidence.rawResponses.length,2)
})

test('Base64.ai India zero stays a scoped observation with unknown company totals',async()=>{
 const o=await observed(replay());assert.equal(o.error,null)
 assert.deepEqual(readSourceObservationEvidence(o.jobs,'base64ai'),{source:'base64ai',recordKind:'vacancy-rows',observedRecordCount:4,observedVacancyCount:4,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 const inventory=readInventoryEvidence(o.jobs);assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null);assert.equal(inventory.listingComplete,false)
 assert.equal(o.audit.companyGlobalTotal,null);assert.equal(o.audit.companyIndiaTotal,null);assert.equal(o.audit.authoritativeIndiaZero,false)
})

test('Base64.ai full native mail declarations remain data without an application or coding-task visit',async()=>{
 const r=replay(),o=await observed(r);assert.equal(o.error,null)
 assert.deepEqual(r.requests.map(value=>value.url),fixture.packets.map(value=>value.requestedURL))
 assert.ok(r.requests.every(value=>value.method==='GET'&&value.redirect==='manual'&&value.credentials==='omit'))
 assert.deepEqual(o.records.map(row=>row.sourceNativeRecord.nativeApplications),expected.models['current-primary'].nativeRoles.map(row=>row.nativeApplications))
 assert.equal(o.audit.applicationActions,0);assert.equal(o.audit.publisherProgramsExecuted,false)
})

test('Base64.ai a real own native India location qualifies without frozen foreign-role exclusions',async()=>{
 const native=expected.models['current-primary'].nativeRoles[0],original=native.nativeRoleHTML,changed=original.replace(native.nativeLocation,'India (Remote)')
 const r=replay(packet=>mutateBody(packet,source=>{assert.equal(source.split(original).length-1,1);return source.replace(original,changed)})),o=await observed(r)
 assert.equal(o.error,null);assert.equal(o.jobs.length,1);assert.equal(o.jobs[0].country,'India');assert.equal(o.jobs[0].title,'Machine Learning Engineer');assert.equal(o.records.length,4)
})

test('Base64.ai effective metadata clears stale sentinel counts and runtime validation',()=>{
 const value=provider();assert.equal(value.catalogOverride,true);assert.equal(value.parser,'live-parser');assert.equal(value.countryFilter,'India');assert.equal(value.backfillMode,null);assert.equal(value.runtimeValidation,null);assert.equal(value.verifiedIndiaJobCount,null);assert.equal(value.verifiedPublicJobCount,null);assert.equal(value.sourceScopeComplete,false);assert.equal(value.lifecycleCleanupAllowed,false)
})

test('Base64.ai zero request budget preserves inspectable empty failure evidence',async()=>{
 const r=replay(),o=await observed(r,{maxRequests:0});assert.equal(o.error?.code,'BASE64AI_REQUEST_BUDGET');assert.equal(r.requests.length,0);assert.equal(o.error.nativeEvidence.rawResponses.length,0);assert.equal(o.error.nativeEvidence.observations.length,0)
})

test('Base64.ai direct registered export shares the full Global native contract',async()=>{
 const{run:direct}=await import('../scraper/base64ai/script.js');let jobs=null,error=null
 try{jobs=await direct({...replay().options,countryFilter:'Global'})}catch(cause){error=cause}
 assert.equal(error,null);assert.equal(jobs.length,4);assert.equal(jobs.nativeCollectionEvidence.observations.length,4)
})

import {execFile} from 'node:child_process'
import {fileURLToPath} from 'node:url'
const originalRole=expected.models['current-primary'].nativeRoles[0]
function editRole(packet,edit,index=0){const role=expected.models['current-primary'].nativeRoles[index];mutateBody(packet,source=>{assert.equal(source.split(role.nativeRoleHTML).length-1,1);return source.replace(role.nativeRoleHTML,edit(role.nativeRoleHTML,role))})}
const replaceLocation=(packet,value)=>editRole(packet,(html,role)=>html.replace(role.nativeLocation,value))
function appendHead(source,markup){const at=source.lastIndexOf('</head>');assert.notEqual(at,-1);assert.equal(source.indexOf('</head>'),at);return source.slice(0,at)+markup+source.slice(at)}
function canonical(source,value){const tags=[...source.matchAll(/<link\b[^>]*\brel\s*=\s*(['"])canonical\1[^>]*>/gi)].filter(match=>match[0].includes('https://base64.ai/careers/'));assert.equal(tags.length,1);return source.replace(tags[0][0],tags[0][0].replace('https://base64.ai/careers/',value))}
async function independent(source){
 const program='import runpy,sys,json\nn=runpy.run_path(sys.argv[1])\ns=sys.stdin.buffer.read().decode("utf-8")\ntry:\n m=n["original_model"](s)\n result={"accepted":True,"model":m,"facts":[n["qualification"](m,r) for r in m["nativeRoles"]]}\nexcept (AssertionError,ValueError):\n result={"accepted":False}\nprint(json.dumps(result))'
 const helper=fileURLToPath(new URL('./helpers/base64aiNativeOracle20261108.py',import.meta.url))
 const out=await new Promise((resolve,reject)=>{const child=execFile('python',['-I','-B','-X','utf8','-c',program,helper],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024},(error,stdout,stderr)=>error?reject(Object.assign(error,{stdout,stderr})):resolve({stdout,stderr}));child.stdin.end(source)})
 assert.equal(out.stderr,'');return JSON.parse(out.stdout)
}
const firstPacket=()=>fixture.packets[0]
function responseFor(body,{status=200,mime='text/html',url=firstPacket().requestedURL}={}){const response=new Response(body,{status,headers:{'content-type':mime}});Object.defineProperty(response,'url',{value:url});return response}

test('Base64.ai boundary foreign canonical retains full records without granting native identity',async()=>{
 const r=replay(packet=>mutateBody(packet,source=>canonical(source,'https://foreign.example/careers/'))),o=await observed(r)
 assert.equal(o.error?.code,'BASE64AI_NATIVE_PROOF');assert.equal(r.requests.length,1);assert.equal(o.records.length,4);assert.ok(o.records.every(row=>!row.sourceNativeIdentityBound));assert.equal(o.error.nativeEvidence.rawResponses[0].response.bodyComplete,true)
})

test('Base64.ai boundary inactive head title cannot grant publication authority',async()=>{
 const title='<title>'+expected.models['current-primary'].head.titles[0]+'</title>',r=replay(packet=>mutateBody(packet,source=>{assert.equal(source.split(title).length-1,1);return source.replace(title,'<template>'+title+'</template>')})),o=await observed(r)
 assert.equal(o.error?.code,'BASE64AI_NATIVE_PROOF');assert.equal(r.requests.length,1);assert.ok(o.records.every(row=>!row.sourceNativeIdentityBound))
})

test('Base64.ai boundary foreign active base remains held without a foreign request',async()=>{
 const r=replay(packet=>mutateBody(packet,source=>appendHead(source,'<base href="https://foreign.example/careers/">'))),o=await observed(r)
 assert.equal(o.error?.code,'BASE64AI_NATIVE_PROOF');assert.equal(r.requests.length,1);assert.equal(o.error.nativeEvidence.models['current-primary'].nativeBases[0].href,'https://foreign.example/careers/')
})

for(const value of['constructor','__proto__','toString'])test('Base64.ai boundary unknown own country '+value+' stays typed null',async()=>{
 const r=replay(packet=>replaceLocation(packet,value)),o=await observed(r,{countryFilter:'Global'})
 assert.equal(o.error,null);assert.equal(o.jobs.length,3);assert.equal(o.records.length,4);assert.equal(o.records[0].country,null);assert.equal(o.records[0].sourceCountryScopeUnresolved,true)
})

test('Base64.ai boundary offices remote work and company copy cannot fill a missing own country',async()=>{
 const r=replay(packet=>replaceLocation(packet,'Remote')),o=await observed(r,{countryFilter:'Global'})
 assert.equal(o.error,null);assert.equal(o.jobs.length,3);assert.equal(o.records[0].country,null);assert.ok(o.records[0].sourceNativeOwnDescriptionHTML.includes('North America'))
})

test('Base64.ai boundary foreign email recipient keeps all criteria without identity qualification',async()=>{
 const r=replay(packet=>editRole(packet,html=>html.replace('mailto:careers@base64.ai','mailto:careers@foreign.example'))),o=await observed(r,{countryFilter:'Global'})
 assert.equal(o.error,null);assert.equal(o.jobs.length,3);assert.equal(o.records[0].sourceNativeIdentityBound,false);assert.equal(o.records.length,4);assert.equal(r.requests.length,2)
})

test('Base64.ai boundary duplicate summary titles keep the complete malformed role',async()=>{
 const summary=originalRole.nativeSummaries[0].nativeHTML,r=replay(packet=>editRole(packet,html=>html.replace(summary,summary+summary))),o=await observed(r,{countryFilter:'Global'})
 assert.equal(o.error,null);assert.equal(o.jobs.length,3);assert.equal(o.records[0].sourceNativeRecord.nativeSummaries.length,2);assert.equal(o.records[0].sourceNativeIdentityBound,false)
})

test('Base64.ai boundary unknown nested criteria and prototype-named attributes remain exact data',async()=>{
 const extra='<p data-native-extra="exact">An additional complete native criterion.</p>',r=replay(packet=>editRole(packet,(html,role)=>html.replace('<details ','<details __proto__="retained" ').replace(role.nativeContentHTML,role.nativeContentHTML+extra))),o=await observed(r,{countryFilter:'Global'})
 assert.equal(o.error,null);assert.equal(o.jobs.length,4);assert.ok(o.records[0].sourceNativeRecord.nativeRoleHTML.includes(extra));assert.ok(o.records[0].sourceDescription.includes(extra));assert.equal(Object.hasOwn(o.records[0].sourceNativeRecord.nativeAttributes,'__proto__'),true);assert.equal(o.records[0].sourceNativeRecord.nativeAttributes.__proto__,'retained');assert.equal({}.base64Polluted,undefined)
})

test('Base64.ai boundary an unclosed native role cannot claim complete original role HTML',async()=>{
 const r=replay(packet=>editRole(packet,html=>{const at=html.lastIndexOf('</details>');assert.notEqual(at,-1);return html.slice(0,at)+html.slice(at+10)})),o=await observed(r,{countryFilter:'Global'})
 assert.equal(o.error,null);assert.equal(o.jobs.length,3);assert.equal(o.records[0].sourceNativeRecord.nativeRoleHTML,null);assert.equal(o.records[0].sourceNativeCriteriaComplete,false)
})

for(const[name,attribute]of[['status','data-status="closed"'],['date','data-expiry="2020-01-01"']])test('Base64.ai boundary unsupported native '+name+' withdraws publication without inventing dates',async()=>{
 const r=replay(packet=>editRole(packet,html=>html.replace('<details ','<details '+attribute+' '))),o=await observed(r,{countryFilter:'Global'})
 assert.equal(o.error,null);assert.equal(o.jobs.length,3);assert.equal(o.records[0].sourceNativeCurrentPublicationQualified,false);assert.equal(o.records[0].postingDate,null);assert.equal(o.records[0].closingDate,null)
})

test('Base64.ai boundary repository oracle independently derives all full original models',async()=>{
 for(const packet of fixture.packets){const out=await independent(Buffer.from(packet.bodyBase64,'base64').toString('utf8'));assert.equal(out.accepted,true);assert.deepEqual(out.model,expected.models[packet.label]);assert.deepEqual(out.facts,expected.qualification)}
})

test('Base64.ai boundary independent oracle holds a contradictory native closed status',async()=>{
 const source=Buffer.from(firstPacket().bodyBase64,'base64').toString('utf8'),changed=originalRole.nativeRoleHTML.replace('<details ','<details data-status="closed" '),out=await independent(source.replace(originalRole.nativeRoleHTML,changed))
 assert.equal(out.accepted,true);assert.equal(out.facts[0].qualified,false);assert.equal(out.facts[0].fullCriteriaComplete,true)
})

test('Base64.ai boundary closing criteria changes retain both complete models and withhold jobs',async()=>{
 const r=replay(packet=>{if(packet.label==='closing-primary')editRole(packet,html=>html.replace('Responsibilities','Changed responsibilities'))}),o=await observed(r,{countryFilter:'Global'})
 assert.equal(o.error?.code,'BASE64AI_NATIVE_CLOSING_CONFLICT');assert.equal(r.requests.length,2);assert.equal(o.records.length,4);assert.equal(o.error.nativeEvidence.closingVerified,false);assert.ok(o.error.nativeEvidence.models['closing-primary'].nativeRoles[0].nativeContentHTML.includes('Changed responsibilities'))
})

test('Base64.ai boundary generator metadata removal is not the observed version exception',async()=>{
 const r=replay(packet=>{if(packet.label==='closing-primary')mutateBody(packet,source=>source.replace(/<meta\b[^>]*name=["']generator["'][^>]*>/i,''))}),o=await observed(r)
 assert.equal(o.error?.code,'BASE64AI_NATIVE_CLOSING_CONFLICT');assert.equal(r.requests.length,2)
})

test('Base64.ai boundary unrelated optional metadata can be absent on both originals',async()=>{
 const r=replay(packet=>mutateBody(packet,source=>source.replace(/<meta\b[^>]*property=["']og:image["'][^>]*>/i,''))),o=await observed(r,{countryFilter:'Global'})
 assert.equal(o.error,null);assert.equal(o.jobs.length,4);assert.equal(o.records.length,4)
})

test('Base64.ai boundary request budget one retains all opening roles before closing stops',async()=>{
 const r=replay(),o=await observed(r,{maxRequests:1})
 assert.equal(o.error?.code,'BASE64AI_REQUEST_BUDGET');assert.equal(r.requests.length,1);assert.equal(o.records.length,4);assert.equal(o.error.nativeEvidence.rawResponses.length,1);assert.equal(o.jobs,null)
})

test('Base64.ai boundary HTTP403 remains primary over a partial denied stream',async()=>{
 const cause=Object.freeze(Error('denied stream interrupted')),raw=new TextEncoder().encode('<html>Access denied'),stream=new ReadableStream({pull:((sent=false)=>controller=>{if(!sent){sent=true;controller.enqueue(raw)}else controller.error(cause)})()})
 let requests=0;const o=await observed(replay(),{fetchImpl:async()=>{requests++;return responseFor(stream,{status:403})}})
 assert.equal(o.error?.status,403);assert.equal(o.error.failureKind,'blocked_or_access_denied');assert.equal(requests,1);assert.equal(o.error.nativeEvidence.rawResponses[0].response.bodyComplete,false);assert.equal(o.error.nativeEvidence.rawResponses[0].response.bodyBytes,raw.length)
})

test('Base64.ai boundary partial healthy stream preserves exact cause and acquired bytes',async()=>{
 const cause=Object.freeze(Error('healthy stream interrupted')),raw=Buffer.from(firstPacket().bodyBase64,'base64').subarray(0,300),stream=new ReadableStream({pull:((sent=false)=>controller=>{if(!sent){sent=true;controller.enqueue(raw)}else controller.error(cause)})()})
 const o=await observed(replay(),{fetchImpl:async()=>responseFor(stream)})
 assert.equal(o.error.cause,cause);assert.equal(o.error.nativeEvidence.rawResponses.length,1);assert.equal(o.error.nativeEvidence.rawResponses[0].response.rawBodyBase64,raw.toString('base64'));assert.equal(o.error.nativeEvidence.rawResponses[0].response.bodyComplete,false)
})

test('Base64.ai boundary incorrect MIME retains the complete unusable original',async()=>{
 const raw=Buffer.from(firstPacket().bodyBase64,'base64'),o=await observed(replay(),{fetchImpl:async()=>responseFor(raw,{mime:'application/json'})})
 assert.equal(o.error?.code,'BASE64AI_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.rawResponses.length,1);assert.equal(o.error.nativeEvidence.rawResponses[0].response.bodyComplete,true)
})

test('Base64.ai boundary actual HTTP200 Incapsula denial is not an empty native inventory',async()=>{
 const html='<html><body><iframe src="/_Incapsula_Resource?incident_id=public">Request unsuccessful. Incapsula incident ID: public</iframe></body></html>'
 let requests=0;const o=await observed(replay(),{fetchImpl:async()=>{requests++;return responseFor(html)}})
 assert.equal(o.error?.code,'BASE64AI_ACCESS_DENIED');assert.equal(o.error.failureKind,'blocked_or_access_denied');assert.equal(requests,1);assert.equal(o.error.nativeEvidence.rawResponses[0].response.body,html)
})

test('Base64.ai boundary source deadline rejects a late producer without later evidence mutation',async()=>{
 const raw=Buffer.from(firstPacket().bodyBase64,'base64'),o=await observed(replay(),{sourceTimeoutMs:20,readTimeoutMs:100,fetchImpl:async()=>{await new Promise(resolve=>setTimeout(resolve,120));return responseFor(raw)}})
 assert.equal(o.error?.code,'BASE64AI_NATIVE_TIMEOUT');const before=structuredClone(o.error.nativeEvidence);await new Promise(resolve=>setTimeout(resolve,150));assert.deepEqual(o.error.nativeEvidence,before);assert.equal(before.rawResponses.length,0)
})

test('Base64.ai boundary callback deadline retains the completed original collection',async()=>{
 const o=await observed(replay(),{auditTimeoutMs:20,onAudit:async()=>new Promise(()=>{})})
 assert.equal(o.error?.code,'BASE64AI_AUDIT_TIMEOUT');assert.equal(o.error.nativeEvidence.rawResponses.length,2);assert.equal(o.error.nativeEvidence.observations.length,4)
})

test('Base64.ai boundary frozen callback failure preserves its exact cause',async()=>{
 const cause=Object.freeze(Error('observer failed')),o=await observed(replay(),{onAudit:async()=>{throw cause}})
 assert.equal(o.error.cause,cause);assert.equal(o.error.nativeEvidence.rawResponses.length,2);assert.equal(o.error.nativeEvidence.observations.length,4)
})

test('Base64.ai boundary false caller cancellation has inspectable detached terminal evidence',async()=>{
 const{readBase64AIFailureEvidence}=await import('../scraper/base64ai/native20261108.js'),controller=new AbortController(),r=replay(),o=await observed(r,{signal:controller.signal,onAudit:async()=>controller.abort(false)})
 assert.equal(o.error,false);const evidence=readBase64AIFailureEvidence(controller.signal);assert.equal(evidence.rawResponses.length,2);assert.equal(evidence.observations.length,4);evidence.rawResponses.length=0;assert.equal(readBase64AIFailureEvidence(controller.signal).rawResponses.length,2)
})

for(const variant of['foreign-canonical','inactive-title','foreign-base'])test('Base64.ai independent binding withholds identity for '+variant,async()=>{
 let source=Buffer.from(firstPacket().bodyBase64,'base64').toString('utf8')
 if(variant==='foreign-canonical')source=canonical(source,'https://foreign.example/careers/')
 if(variant==='inactive-title'){const title='<title>'+expected.models['current-primary'].head.titles[0]+'</title>';assert.equal(source.split(title).length-1,1);source=source.replace(title,'<template>'+title+'</template>')}
 if(variant==='foreign-base')source=appendHead(source,'<base href="https://foreign.example/careers/">')
 const out=await independent(source);assert.equal(out.accepted,true);assert.equal(out.facts.length,4);assert.ok(out.facts.every(value=>!value.identityBound&&!value.qualified))
})
