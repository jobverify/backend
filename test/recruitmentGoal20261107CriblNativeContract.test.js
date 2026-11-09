import assert from 'node:assert/strict'
import test from 'node:test'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {fixture,replay,mutateBody} from './test-data/cribl20261107.js'
import {createCriblScraper,readCriblFailureEvidence} from '../scraper/cribl/native20261107.js'
import {PROFILE,flightDocument,primaryDeclaration,ownRole,geography,nativeCollection} from '../scraper/cribl/data20261107.js'
const provider=()=>getScraperCatalog().find(p=>p.source==='cribl')
test('registered Cribl route decodes every original native role before country filtering',async()=>{
 const r=replay();let audit,records,jobs,caught
 try{jobs=await createCatalogScraper(provider()).run({...r.options,onAudit:a=>{audit=a},onRecords:v=>{records=v}})}catch(e){caught=e}
 assert.deepEqual(r.uncaptured,[])
 assert.equal(caught?.message,undefined,'the registered route must implement the captured 78-post native contract')
 assert.equal(audit.observations.length,78)
 assert.equal(records.length,78)
 assert.deepEqual(records.map(v=>v.sourceNativeRecord),fixture.expected.nativeModels)
 assert.deepEqual(audit.observations.map(v=>v.nativeRecord),fixture.expected.nativeModels)
 assert.equal(r.requests.length,318)
 assert.equal(jobs.length,27)
 assert.equal(audit.knownForeignCount,51)
 assert.equal(audit.countryUnresolvedCount,27)
 assert.equal(audit.observedIndiaCount,0)
 assert.equal(audit.companyIndiaTotal,null)
 assert.equal(audit.companyGlobalTotal,null)
 assert.equal(audit.sourceScopeComplete,false)
 assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(readSourceObservationEvidence(jobs,'cribl').observedRecordCount,78)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 for(const row of records){
  assert.ok(row.sourceDescription.length>1000)
  assert.equal(row.sourceNativeContent,row.sourceNativeRecord.content)
  assert.equal(row.sourceUrl,'https://cribl.io/job-detail/'+row.jobId+'/')
  assert.equal(row.applyUrl,null)
  assert.equal(row.activeApplyVerified,false)
 }
 for(const row of jobs){assert.equal(row.country,null);assert.equal(row.countryUnresolved,true)}
})
const body=url=>Buffer.from(fixture.packets.find(p=>p.requestedURL===url).bodyBase64,'base64').toString('utf8')
const first=fixture.expected.nativeModels[0],firstURL='https://cribl.io/job-detail/'+first.id+'/'
const failureOf=async promise=>{try{await promise;assert.fail('Expected incomplete source to reject')}catch(e){if(e?.code==='ERR_ASSERTION')throw e;return e}}
test('maxJobs zero changes returned selection while all original role models are audited',async()=>{
 const r=replay();let count=0,audit;const jobs=await createCriblScraper(r.options).run({maxJobs:0,onAudit:a=>{audit=a;a.observations[0].nativeRecord.title='observer mutation'},onRecords:rows=>{count=rows.length;rows[0].sourceNativeRecord.title='observer mutation'}})
 assert.equal(jobs.length,0);assert.equal(count,78);assert.equal(r.requests.length,318)
 assert.equal(jobs.nativeCollectionEvidence.observations[0].nativeRecord.title,first.title)
 assert.equal(audit.observations.length,78)
 assert.equal(readSourceObservationEvidence(jobs,'cribl').observedRecordCount,78)
})
test('request exhaustion preserves all 78 listing models and the completed own role',async()=>{
 const r=replay(),error=await failureOf(createCriblScraper().run({...r.options,maxRequests:5}))
 assert.equal(error.code,'CRIBL_REQUEST_BUDGET');assert.equal(error.status,undefined)
 assert.equal(r.requests.length,5);assert.equal(error.nativeEvidence.observations.length,78)
 assert.equal(error.nativeEvidence.ownNativeModels,1);assert.equal(error.nativeEvidence.rawResponses.length,5)
 assert.deepEqual(error.nativeEvidence.observations.map(v=>v.listingRecord),fixture.expected.nativeModels)
})
test('first denial retains its original body and stops before any subsequent role',async()=>{
 const r=replay({transform:p=>{if(p.requestedURL===firstURL){p.status=403;mutateBody(p,'<html><title>Access denied</title></html>')}}})
 let callbacks=0;const error=await failureOf(createCriblScraper().run({...r.options,onAudit:()=>{callbacks++},onRecords:()=>{callbacks++}}))
 assert.equal(error.status,403);assert.equal(r.requests.length,5);assert.equal(callbacks,0)
 assert.equal(error.nativeEvidence.observations.length,78)
 const last=error.nativeEvidence.rawResponses.at(-1).response
 assert.equal(last.status,403);assert.equal(last.bodyComplete,true);assert.match(Buffer.from(last.rawBodyBase64,'base64').toString(),/Access denied/)
})
test('a changed closing inventory retains all earlier native models without promoting a zero',async()=>{
 let feeds=0,audit,records;const r=replay({transform:p=>{if(p.requestedURL===PROFILE.feedURL&&++feeds===2){const value=JSON.parse(Buffer.from(p.bodyBase64,'base64'));value.jobs.shift();value.meta.total--;mutateBody(p,JSON.stringify(value))}}})
 const jobs=await createCriblScraper().run({...r.options,onAudit:v=>{audit=v},onRecords:v=>{records=v}})
 assert.equal(jobs.length,0);assert.equal(audit.nativeInventoryStable,false);assert.equal(audit.observations.length,78);assert.equal(records.length,78)
 assert.deepEqual(records.map(v=>v.sourceNativeRecord),fixture.expected.nativeModels)
 assert.equal(audit.pairedNativeModels,0);assert.equal(audit.companyIndiaTotal,null);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})
test('a stalled body retains the actual partial entity and its observed HTTP status',async()=>{
 let reads=0,cancelled=0
 const fetchImpl=async url=>{
  reads++;const response=new Response(new ReadableStream({start(c){c.enqueue(Buffer.from('<html><title>partial'))},cancel(){cancelled++}}),{status:200,headers:{'content-type':'text/html'}})
  Object.defineProperty(response,'url',{value:String(url)});return response
 }
 const error=await failureOf(createCriblScraper().run({fetchImpl,readTimeoutMs:20,rateLimitMs:0}))
 assert.equal(error.code,'CRIBL_READ_TIMEOUT');assert.equal(error.status,undefined);assert.equal(reads,1)
 const receipt=error.nativeEvidence.rawResponses[0].response
 assert.equal(receipt.status,200);assert.equal(receipt.bodyComplete,false);assert.equal(Buffer.from(receipt.rawBodyBase64,'base64').toString(),'<html><title>partial')
 assert.equal(cancelled,1)
})
test('changed employer component stops before collection acquisition',async()=>{
 const r=replay({transform:p=>{if(p.requestedURL===PROFILE.assetURL)mutateBody(p,Buffer.from(p.bodyBase64,'base64').toString()+'\n/* changed */')}})
 const error=await failureOf(createCriblScraper().run(r.options))
 assert.equal(error.code,'CRIBL_NATIVE_PROOF');assert.equal(r.requests.length,2)
 assert.equal(error.nativeEvidence.rawResponses.length,2)
})
test('redirects to applications or other identities are never followed',async()=>{
 const r=replay({transform:p=>{if(p.status===308)p.headers.location='/job-detail/other/'}})
 const error=await failureOf(createCriblScraper().run(r.options))
 assert.equal(error.status,308);assert.equal(r.requests.length,4)
})
test('native collection rejects missing totals, duplicate IDs and publisher contradictions',()=>{
 const feed=JSON.parse(body(PROFILE.feedURL))
 for(const alter of [v=>{v.meta.total++},v=>{v.jobs[1].id=v.jobs[0].id},v=>{v.jobs[0].company_name='Other publisher'}]){
  const v=structuredClone(feed);alter(v);assert.throws(()=>nativeCollection(JSON.stringify(v)),/Cribl native contract/)
 }
})
test('an empty native feed never becomes authoritative India or company zero',async()=>{
 const r=replay({transform:p=>{if(p.requestedURL===PROFILE.feedURL)mutateBody(p,JSON.stringify({jobs:[],meta:{total:0}}))}})
 const jobs=await createCriblScraper().run(r.options),a=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(a.observedRecordCount,0);assert.equal(a.companyIndiaTotal,null);assert.equal(a.companyGlobalTotal,null)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(a.sourceScopeComplete,false)
})
test('own page identity and full data cannot be borrowed from another role',()=>{
 const html=body(firstURL)
 assert.throws(()=>ownRole(html.replace('href="'+firstURL+'"','href="https://cribl.io/job-detail/other/"'),first),/canonical/)
 const modified=structuredClone(first);modified.requisition_id='wrong-requisition'
 assert.throws(()=>ownRole(html,modified),/complete native model conflicts/)
})
test('inert Flight packets cannot supply the primary declaration',()=>{
 const html=body(PROFILE.primaryURL).replaceAll('<script>self.__next_f.push','<script nomodule>self.__next_f.push')
 assert.throws(()=>primaryDeclaration(html),/active literal Flight packets unavailable/)
})
test('Flight text lengths count UTF-8 bytes across packet and line boundaries',()=>{
 const value='αβ\nJob criteria 😀',raw=Buffer.from(value),flight='0:{"content":"$1"}\n1:T'+raw.length.toString(16)+','+value
 const html='<script>self.__next_f.push('+JSON.stringify([1,flight.slice(0,18)])+')</script><script>self.__next_f.push('+JSON.stringify([1,flight.slice(18)])+')</script>'
 const parsed=flightDocument(html);assert.equal(parsed.resolve({content:'$1'}).content,value)
 assert.equal(parsed.textFrames,1)
 const truncated='<script>self.__next_f.push('+JSON.stringify([1,flight.slice(0,-1)])+')</script>'
 assert.throws(()=>flightDocument(truncated),/truncated Flight text/)
})
test('missing, cyclic and duplicate Flight data are rejected',()=>{
 const wrap=value=>'<script>self.__next_f.push('+JSON.stringify([1,value])+')</script>'
 const missing=flightDocument(wrap('0:{"content":"$1"}\n'))
 assert.throws(()=>missing.resolve({content:'$1'}),/unresolved Flight native field/)
 const cyclic=flightDocument(wrap('0:{"content":"$1"}\n1:{"content":"$1"}\n'))
 assert.throws(()=>cyclic.resolve({content:'$1'}),/cyclic Flight/)
 assert.throws(()=>flightDocument(wrap('0:{}\n0:{}\n')),/duplicate Flight/)
})
test('country comes from written role countries rather than city, state or company address',()=>{
 for(const value of ['Remote - Indiana','Remote - Dubai','Remote - Austin, Texas','CA','IN','Remote - California'])assert.equal(geography(value).country,null,value)
 for(const [value,expected]of [['Remote - India','India'],['London, United Kingdom','United Kingdom'],['Remote - United States','United States'],['Remote - Singapore','Singapore']])assert.equal(geography(value).country,expected)
 for(const id of fixture.expected.unknownCountryIds)assert.equal(geography(fixture.expected.nativeModels.find(v=>String(v.id)===id).location.name).country,null)
})
test('registered metadata supersedes stale sentinel and zero counts for Cribl only',()=>{
 const p=provider();assert.equal(p.atsPlatform,'cribl-native-greenhouse-rsc');assert.equal(p.backfillMode,null)
 assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.verifiedOn,null)
 assert.equal(p.sourceScopeComplete,false);assert.equal(p.lifecycleCleanupAllowed,false)
})
for(const reason of [false,0,'',Object.freeze({cancel:'frozen caller'})])test('caller pre-abort preserves exact reason '+String(reason),async()=>{
 const c=new AbortController();c.abort(reason);const r=replay();let caught,rejected=false
 try{await createCriblScraper({...r.options,signal:c.signal}).run({signal:undefined,maxJobs:-1})}catch(e){caught=e;rejected=true}
 assert.equal(rejected,true);assert.equal(caught,reason);assert.equal(r.requests.length,0)
})
const clock=t=>{let at=1000;const prior=Object.getOwnPropertyDescriptor(performance,'now');Object.defineProperty(performance,'now',{configurable:true,value:()=>at});t.after(()=>prior?Object.defineProperty(performance,'now',prior):delete performance.now);return ms=>{at+=ms}}
test('elapsed observer deadline suppresses records callback after a synchronous audit',async t=>{
 const advance=clock(t),r=replay();let calls=0
 const error=await failureOf(createCriblScraper().run({...r.options,onAudit:()=>advance(15001),onRecords:()=>{calls++}}))
 assert.equal(error.code,'CRIBL_AUDIT_TIMEOUT');assert.equal(error.status,undefined);assert.equal(calls,0)
 assert.equal(error.nativeEvidence.ownNativeModels,78);assert.equal(error.nativeEvidence.pairedNativeModels,78)
})
test('source expiry during the employer declaration prevents the next physical GET',async t=>{
 const advance=clock(t),r=replay(),error=await failureOf(createCriblScraper().run({...r.options,fetchImpl:async(...args)=>{const value=await r.options.fetchImpl(...args);advance(600001);return value}}))
 assert.equal(error.code,'CRIBL_NATIVE_TIMEOUT');assert.equal(r.requests.length,1)
})
test('undefined options retain factory callbacks and a single combined observer budget',async t=>{
 const advance=clock(t),r=replay();let audits=0,records=0
 const scraper=createCriblScraper({...r.options,onAudit:()=>{audits++;advance(10000)},onRecords:rows=>{records=rows.length;advance(5001)}})
 const error=await failureOf(scraper.run({fetchImpl:undefined,onAudit:undefined,onRecords:undefined,now:undefined}))
 assert.equal(error.code,'CRIBL_AUDIT_TIMEOUT');assert.equal(audits,1);assert.equal(records,78)
})
test('caller abort in audit remains exact and retains detached native failure evidence',async()=>{
 const r=replay(),c=new AbortController(),reason=Object.freeze({cancel:'after complete audit'});let records=0,caught
 try{await createCriblScraper().run({...r.options,signal:c.signal,onAudit:()=>c.abort(reason),onRecords:()=>{records++}})}catch(e){caught=e}
 assert.equal(caught,reason);assert.equal(records,0)
 const evidence=readCriblFailureEvidence(c.signal);assert.equal(evidence.ownNativeModels,78);evidence.observations.length=0
 assert.equal(readCriblFailureEvidence(c.signal).observations.length,78)
})
const alteredFirst=patch=>replay({transform:p=>{
 if(p.requestedURL===PROFILE.feedURL){const value=JSON.parse(Buffer.from(p.bodyBase64,'base64'));Object.assign(value.jobs[0],patch);mutateBody(p,JSON.stringify(value))}
 if(p.requestedURL===firstURL){
  let matches=0
  const html=Buffer.from(p.bodyBase64,'base64').toString().replace(/<script>self\.__next_f\.push\(([\s\S]*?)\)<\/script>/g,(whole,arg)=>{
   const packet=JSON.parse(arg);if(packet[0]!==1||typeof packet[1]!=='string')return whole
   for(const [key,value]of Object.entries(patch)){const needle=JSON.stringify(key)+':'+JSON.stringify(first[key]);if(packet[1].includes(needle)){packet[1]=packet[1].replace(needle,JSON.stringify(key)+':'+JSON.stringify(value));matches++}}
   return '<script>self.__next_f.push('+JSON.stringify(packet)+')</script>'
  })
  assert.equal(matches,Object.keys(patch).length,'test alteration must bind each native data field exactly once');mutateBody(p,html)
 }
}})
for(const label of ['Remote - United States, India','Remote - India, United States'])test('review: mixed own countries stay unresolved in either order: '+label,async()=>{
 const r=alteredFirst({location:{...first.location,name:label}});let records
 const jobs=await createCriblScraper().run({...r.options,onRecords:v=>{records=v}}),row=records.find(v=>v.jobId===String(first.id))
 assert.equal(records.length,78);assert.equal(r.requests.length,318)
 assert.equal(row.country,null);assert.equal(row.sourceNativeCountryConflict,true);assert.equal(row.sourceCurrentNativeRoleQualified,false)
 assert.equal(jobs.some(v=>v.jobId===row.jobId&&v.country==='India'),false)
 assert.equal(row.sourceNativeRecord.location.name,label)
})
for(const [name,patch]of [
 ['future publication',{first_published:'2099-01-01T00:00:00Z'}],
 ['impossible publication calendar',{first_published:'2026-02-30T00:00:00Z'}],
 ['expired deadline',{application_deadline:'2000-01-01T00:00:00Z'}],
 ['invalid deadline calendar',{application_deadline:'2026-02-30T00:00:00Z'}],
])test('review: '+name+' remains held with the complete original model',async()=>{
 const modified={location:{...first.location,name:'Remote - India'},...patch},r=alteredFirst(modified);let records
 const jobs=await createCriblScraper().run({...r.options,onRecords:v=>{records=v}}),row=records.find(v=>v.jobId===String(first.id))
 assert.equal(records.length,78);assert.equal(r.requests.length,318)
 assert.equal(jobs.some(v=>v.jobId===row.jobId),false)
 assert.equal(row.sourceNativeTemporalQualified,false);assert.equal(row.sourceCurrentNativeRoleQualified,false)
 assert.ok(row.sourceNativeIssues.length>0)
 for(const [key,value]of Object.entries(modified))assert.deepEqual(row.sourceNativeRecord[key],value)
})
for(const status of [403,429,503])test('review: HTTP '+status+' remains primary when its body stalls',async()=>{
 let reads=0;const fetchImpl=async url=>{
  reads++;const response=new Response(new ReadableStream({start(c){c.enqueue(Buffer.from('partial denied'))}}),{status,headers:{'content-type':'text/html','retry-after':'7'}})
  Object.defineProperty(response,'url',{value:String(url)});return response
 }
 const error=await failureOf(createCriblScraper().run({fetchImpl,readTimeoutMs:20,rateLimitMs:0}))
 assert.equal(reads,1);assert.equal(error.status,status);assert.equal(error.acquisitionFailure.code,'CRIBL_READ_TIMEOUT')
 if(status===429)assert.equal(error.retryDelayMs,7000)
 const receipt=error.nativeEvidence.rawResponses[0].response;assert.equal(receipt.status,status);assert.equal(receipt.bodyComplete,false)
 assert.equal(Buffer.from(receipt.rawBodyBase64,'base64').toString(),'partial denied')
})
test('review: effective dry-run path stays in the Cribl source folder',()=>{
 assert.match(provider().dryRunFile.replaceAll('\\','/'),/\/scraper\/cribl\/jobs\.json$/)
})
