import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {BOARD_URL,DASHBOARD_URL,CAREER_PAGE_URL,API_ORIGIN,LIST_URL,jobURL,publicJobURL,nativeShellContract,clientContract} from './nativeContract.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/current-native-20261114.json.gz',import.meta.url))))
const old=JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/native-build-20261031.json.gz',import.meta.url))))
const provider=getScraperCatalog().find(p=>p.source==='monocept')
const ID=fixture.roles[0].id,D=publicJobURL(ID),H=jobURL(ID)
const PDF_ID='623c5b06-410f-4ed3-b06b-b5579c01a152'
const sha=value=>createHash('sha256').update(value).digest('hex')
const packets=new Map()
for(const packet of fixture.responses){const group=packets.get(packet.url)||[];group.push(packet);packets.set(packet.url,group)}
const mutateJSON=(packet,mutate)=>{const value=JSON.parse(packet.body);mutate(value);packet.body=JSON.stringify(value)}
const mutatePosting=(packet,mutate)=>{let changed=false;packet.body=packet.body.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/,(all,start,raw,end)=>{const value=JSON.parse(raw);if(value['@type']!=='JobPosting')return all;mutate(value);changed=true;return start+JSON.stringify(value)+end});assert.equal(changed,true)}
function replay(mutate){
 const calls=[],counts=new Map()
 return {calls,options:{requestIntervalMs:0,now:()=>fixture.capturedAt,fetchImpl:async(url,init)=>{
  const count=counts.get(url)||0;counts.set(url,count+1);calls.push({url,method:init.method,body:init.body,signal:init.signal})
  let packet
  if(url===API_ORIGIN+'/api/token/noauth')packet={status:200,finalUrl:url,contentType:'application/json',body:JSON.stringify({access_token:'synthetic-hermetic-anonymous-guest-token',token_type:'Bearer',expires_in:3600,ShouldRedirect:false})}
  else{const group=packets.get(url);assert.ok(group,'Unexpected public request '+url);packet=structuredClone(group[Math.min(count,group.length-1)])}
  mutate?.(packet,url,count,init)
  return {status:packet.status,url:packet.finalUrl,contentType:packet.contentType,body:packet.body}
 }}}
}
const run=options=>createCatalogScraper(provider).run(options)
test.beforeEach(t=>t.mock.method(globalThis,'fetch',async()=>{throw Error('Unexpected network in hermetic current Monocept tests')}))

test('current Monocept fixture retains all original noncredential response bytes and seven explicit India/date pairs',()=>{
 assert.equal(fixture.responses.length,37);assert.equal(fixture.roles.length,7)
 assert.equal(fixture.responses.some(p=>p.url.includes('/token/noauth')),false)
 for(const packet of fixture.responses){assert.equal(sha(packet.body),packet.sha256);assert.equal(Buffer.byteLength(packet.body),packet.bytes);assert.equal(packet.status,200);assert.equal(packet.finalUrl,packet.url)}
 for(const role of fixture.roles){assert.match(role.location,/, India/);assert.match(role.publishedDate,/^2026-08-06T/);assert.equal(role.publishedDate,role.careerpagePublishedDate);assert.equal(role.isPublic,true);assert.equal(role.isDraft,false);assert.equal(role.status,'Active')}
})

test('both actual current public shells select the reviewed fourteen-client public route tuple',()=>{
 for(const url of [BOARD_URL,DASHBOARD_URL]){const actual=nativeShellContract(packets.get(url)[0].body);assert.deepEqual(actual.publicClientURLs,fixture.clientURLs);assert.equal(actual.companyScopeUnqualified,true)}
 for(const url of fixture.clientURLs){const packet=packets.get(url)[0];assert.equal(clientContract(url,packet.body),packet.sha256)}
})

test('the genuine prior native tuple and bytes remain accepted',()=>{
 const shell=nativeShellContract(old.shell.body);assert.equal(shell.publicClientURLs.length,6)
 for(const packet of old.clients){const url='https://monocept.turbohire.co'+new URL(packet.url).pathname;assert.equal(clientContract(url,packet.body),sha(packet.body))}
})

test('registered current native route retains six full India roles and one unread full-description hold with original dates',async()=>{
 const transport=replay(),jobs=await run(transport.options)
 assert.equal(jobs.length,6);assert.deepEqual(jobs.map(j=>j.jobId),fixture.roles.filter(r=>r.id!==PDF_ID).map(r=>r.id))
 for(const job of jobs){assert.equal(job.country,'India');assert.equal(job.legalEmployer,'Monocept Consulting Pvt. Ltd.');assert.equal(job.sourceDetailComplete,true);assert.equal(job.nativeRoleClosingReconciled,true);assert.match(job.postingDate,/^2026-08-06T/);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.ok(job.jobDescription.length>1000)}
 assert.equal(jobs[0].postingDate,fixture.roles[0].publishedDate)
 assert.equal(transport.calls.filter(c=>c.url.includes('/api/publicjobs/')).length,14)
 assert.equal(transport.calls.filter(c=>c.url.includes('/job/publicjobs/')).length,14)
 for(const url of fixture.clientURLs)assert.equal(transport.calls.filter(c=>c.url===url).length,2)
 assert.equal(transport.calls.length,73)
 assert.equal(transport.calls.some(c=>/candidate|applications|userspartialdata|referral|statistics/.test(c.url)),false)
 assert.equal(JSON.stringify(jobs).includes('synthetic-hermetic-anonymous-guest-token'),false)
 const evidence=jobs[0].nativeCollectionEvidence
 assert.equal(evidence.observedGlobalRecords,7);assert.equal(evidence.confirmedIndiaRecords,6);assert.equal(evidence.unresolvedRecords,1);assert.equal(evidence.closingReconciled,true)
 assert.ok(evidence.reasons.includes('current-native-client-company-inventory-unqualified'))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const assessment=assessSoftFailureAcquisition(provider,jobs)
 assert.equal(assessment.indiaJobs,6);assert.equal(assessment.eligibleJobs,0)
 // Publication filters record the first rejection. Title exclusions may run
 // before age, while every one of these six historical jobs stays ineligible.
 assert.equal(assessment.filterCounts.old+(assessment.filterCounts.excludedTitle||0),6)
})

for(const url of fixture.clientURLs)test('whole current client bytes remain pinned: '+new URL(url).pathname,()=>{
 const packet=packets.get(url)[0]
 assert.throws(()=>clientContract(url,packet.body+'\n/* new native behavior */'),/unreviewed current native client bytes/)
})

for(const[label,mutate]of[
 ['mixed prior runtime',html=>html.replace('runtime-main.22581bcb0af0126ad3a1.js','runtime-main.a3801c5ec8c75a558b86.js')],
 ['duplicate main',html=>html.replace('30.726ffa16663af89e0bd8.chunk.js','main.abf08ac7a40e59d79668.chunk.js')],
 ['disabled main',html=>html.replace('src="/main.abf08ac7a40e59d79668.chunk.js"','type="application/json" src="/main.abf08ac7a40e59d79668.chunk.js"')],
 ['hidden root',html=>html.replace('<div id="root">','<div hidden id="root">')],
 ['additional executable',html=>html.replace('</body>','<script>window.unreviewedJobs="/jobs"</script></body>')],
])test('current native deployment rejects '+label,()=>{
 const original=packets.get(BOARD_URL)[0].body,changed=mutate(original);assert.notEqual(changed,original);assert.throws(()=>nativeShellContract(changed))
})

for(const[label,mutate]of[
 ['other employer',j=>{j.OrgDetails.OrgName='Another Employer'}],
 ['unknown country',j=>{j.Location='[{"Address":"Remote Job","PlaceId":null}]'}],
 ['city without country',j=>{j.Location='[{"Address":"Mumbai","PlaceId":null}]'}],
 ['missing public publication',j=>{delete j.PublishedDates.CAREERPAGE}],
 ['closed native DTO',j=>{j.JobStatus='Closed'}],
 ['unpublished native DTO',j=>{j.IsPublic=false}],
 ['listing preview in place of full criteria',j=>{const preview=JSON.parse(packets.get(LIST_URL)[0].body).Result[0].JobDescV2;assert.equal(typeof preview,'string');assert.ok(preview.length<=500);j.JobDescriptionV2=preview;j.JobDescription=preview}],
])test('actual current '+label+' excludes that identity and preserves incomplete scope',async()=>{
 const transport=replay((packet,url)=>{if(url===D)mutateJSON(packet,mutate)}),jobs=await run(transport.options)
 assert.equal(jobs.some(j=>j.jobId===ID),false);assert.equal(jobs.length,5);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for(const[label,mutate]of[
 ['schema employer',j=>{j.hiringOrganization.name='Another Employer'}],
 ['schema country',j=>{j.jobLocation.address.addressCountry='United States'}],
 ['schema publication date',j=>{j.datePosted='2026-11-14'}],
])test('current '+label+' disagreement cannot promote a full role',async()=>{
 const transport=replay((packet,url)=>{if(url===H)mutatePosting(packet,mutate)}),jobs=await run(transport.options)
 assert.equal(jobs.some(j=>j.jobId===ID),false);assert.equal(jobs.length,5);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('current closing-only full criteria drift excludes the affected role',async()=>{
 const transport=replay((packet,url,count)=>{if(url===D&&count===1)mutateJSON(packet,j=>{j.JobDescriptionV2+='<p>New closing qualification that changes the complete native criteria.</p>';j.JobDescription=j.JobDescriptionV2})}),jobs=await run(transport.options)
 assert.equal(jobs.some(j=>j.jobId===ID),false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('current listing continuation/count gaps retain explicit incomplete inventory',async()=>{
 const transport=replay((packet,url)=>{if(url===LIST_URL)mutateJSON(packet,j=>{j.Total=8;j.NextPage=2})}),jobs=await run(transport.options)
 assert.equal(jobs.length,6);const reasons=jobs[0].nativeCollectionEvidence.reasons
 assert.ok(reasons.includes('native-total-not-exhausted'));assert.ok(reasons.includes('native-unknown-continuation-or-metadata'));assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('the exact public-role render program is measured again at closing before any result returns',async()=>{
 const url=fixture.clientURLs.find(url=>new URL(url).pathname.startsWith('/62.'))
 assert.ok(url);const transport=replay((packet,requested,count)=>{if(requested===url&&count===1)packet.body+='\n/* changed full criteria rendering */'})
 await assert.rejects(run(transport.options),/unreviewed current native client bytes/)
 assert.equal(transport.calls.at(-1).url,url);assert.equal(transport.calls.filter(c=>c.url===url).length,2)
})

test('opaque caller abort before reads and during closing preserves reason and starts no later requests',async()=>{
 const reason={caller:'opaque-before'},first=new AbortController();first.abort(reason);const before=replay()
 await assert.rejects(run({...before.options,signal:first.signal}),error=>error===reason);assert.equal(before.calls.length,0)
 const closingReason={caller:'opaque-closing'},controller=new AbortController(),closing=replay((_packet,url,count)=>{if(url===CAREER_PAGE_URL&&count===1)controller.abort(closingReason)})
 await assert.rejects(run({...closing.options,signal:controller.signal}),error=>error===closingReason)
 assert.equal(closing.calls.at(-1).url,CAREER_PAGE_URL);const count=closing.calls.length;await new Promise(resolve=>setImmediate(resolve));assert.equal(closing.calls.length,count)
})

test('actual current PDF full-description carrier holds that raw identity instead of claiming full criteria',async()=>{
 const original=JSON.parse(packets.get(publicJobURL(PDF_ID))[0].body)
 assert.match(original.JobDescriptionBlobUrl,/\/JobDescription\/KeyAccountsManager-NewClientAcquisition[.]pdf$/)
 const transport=replay(),jobs=await run(transport.options)
 assert.equal(jobs.some(j=>j.jobId===PDF_ID),false)
 assert.equal(jobs[0].nativeCollectionEvidence.observedGlobalRecords,7)
 assert.equal(jobs[0].nativeCollectionEvidence.unresolvedRecords,1)
 assert.ok(jobs[0].nativeCollectionEvidence.reasons.some(r=>r.includes(PDF_ID)&&/full.description carrier/.test(r)))
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

for(const[field,value]of[['JobDescriptionBlobUrl','https://hiringsolutions.blob.core.windows.net/public/job-description.pdf'],['JobDescriptionVideoUrl','https://www.youtube.com/watch?v=dQw4w9WgXcQ']])test('unmeasured '+field+' video or PDF criteria cannot promote a full role',async()=>{
 const transport=replay((packet,url)=>{if(url===D)mutateJSON(packet,j=>{j[field]=value})}),jobs=await run(transport.options)
 assert.equal(jobs.some(j=>j.jobId===ID),false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
