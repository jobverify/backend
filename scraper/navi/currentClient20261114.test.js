import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {validateNativeDetail} from './nativeContract.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {fixture,bodyOf,listing,details,fixtureReplay} from './test-data/currentResponseFixture.js'
const now=fixture.now,finance=listing.Result[1],financeDetail=details[finance.JobId],current={now,currentPublicRender:true}

test('genuine current fixture preserves31 original response entities and full44-row inventory',()=>{
 assert.equal(fixture.responses.length,31);assert.equal(listing.Total,44);assert.equal(listing.Result.length,44)
 for(const packet of fixture.responses){const raw=bodyOf(packet);assert.equal(raw.length,packet.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),packet.sha256);assert.equal(packet.status,200);assert.equal(packet.finalUrl,packet.url)}
 assert.equal(fixture.responses.filter(row=>row.url.endsWith('.js')).length,15)
 assert.equal(fixture.responses.filter(row=>row.url.endsWith('.css')).length,6)
 assert.ok(!JSON.stringify(fixture).includes('access_token'))
})

test('registered current native route binds GUID details to exact44-row listing and preserves unread PDF/cleanup holds',async()=>{
 const replay=fixtureReplay(),provider=getScraperCatalog().find(row=>row.source==='navi'),jobs=await createCatalogScraper(provider).run(replay.options)
 assert.deepEqual(jobs.map(job=>job.jobId),[listing.Result[1].JobId,listing.Result[2].JobId])
 assert.ok(jobs.every(job=>job.sourceDetailComplete&&job.nativeRoleClosingReconciled&&!job.sourceScopeComplete&&!job.sourceListingComplete&&!job.lifecycleCleanupAllowed))
 assert.equal(jobs[0].jobDescription,extractActiveDescription(financeDetail.JobDescriptionV2));assert.equal(jobs[0].jobDescription.length,3602)
 assert.equal(jobs[0].nativeSourceRecord.nativeDetail.JobDescriptionV2,financeDetail.JobDescriptionV2)
 assert.equal(jobs[0].sourceDescriptionApiUrl,'https://thapi-stage2.azurewebsites.net/api/publicjobs/'+finance.JobId+'?fieldVisibility=CareerPage')
 assert.equal(jobs[0].applyUrl,'https://navi.turbohire.co/job/publicjobs/'+finance.JobIdObfuscated)
 assert.equal(jobs[0].nativeSourceRecord.nativeDetail.JobIdObfuscated,finance.JobIdObfuscated)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,44);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(replay.reads.filter(row=>row.method==='POST').length,2)
 assert.equal(replay.reads.filter(row=>row.url.includes('/api/publicjobs/')).length,3)
 assert.ok(!replay.reads.some(row=>row.url.includes('/api/publicjobs?')))
})

test('actual current PDF full-description carrier stays unresolved despite substantive HTML',()=>{
 const row=listing.Result[0],result=validateNativeDetail(details[row.JobId],row,current)
 assert.ok(result.jobDescription.length>150);assert.equal(result.sourceDetailComplete,false);assert.match(result.sourceDetailStatus,/unread.*carrier/)
})

test('current rendered video full-description carrier stays unresolved',()=>{
 const detail=structuredClone(financeDetail);detail.JobDescriptionVideoUrl='https://www.youtube.com/watch?v=abcdefghijk'
 assert.equal(validateNativeDetail(detail,finance,current).sourceDetailComplete,false)
})

test('current public render cannot silently omit a legacy-only criteria section',()=>{
 const detail=structuredClone(financeDetail);detail.RolesAndResponsibilitiesV2='';detail.RolesAndResponsibilities='<p>Mandatory responsibility in the original native role record.</p>'
 assert.equal(validateNativeDetail(detail,finance,current).sourceDetailComplete,false)
})

test('new criteria class activation cannot certify the current complete description',()=>{
 const detail=structuredClone(financeDetail);detail.JobDescriptionV2='<div class="d-none">'+detail.JobDescriptionV2+'</div>'
 assert.equal(validateNativeDetail(detail,finance,current).sourceDetailComplete,false)
})

test('consistent explicit closure notice cannot publish an otherwise active native role',()=>{
 const detail=structuredClone(financeDetail);detail.JobDescriptionV2='<p>This position is closed. We are no longer accepting applications.</p>'+detail.JobDescriptionV2
 assert.equal(validateNativeDetail(detail,finance,current).sourceDetailComplete,false)
})

test('changed immutable closing asset invalidates the registered current collection',async()=>{
 const firstAsset=fixture.responses.find(packet=>packet.url.endsWith('.js')).url
 const replay=fixtureReplay((packet,body,sequence)=>packet.url===firstAsset&&sequence===2?Buffer.concat([body,Buffer.from('/* closing change */')]):body)
 await assert.rejects(run(replay.options),/immutable.*entity.*bytes.*changed/)
})

test('current native organization publication authority must remain explicit',()=>{
 assert.equal(financeDetail.OrgDetails.IsCareerPagePublished,true)
 for(const value of [false,undefined]){const detail=structuredClone(financeDetail);if(value===undefined)delete detail.OrgDetails.IsCareerPagePublished;else detail.OrgDetails.IsCareerPagePublished=value;assert.throws(()=>validateNativeDetail(detail,finance,current),/organization.*publication/i)}
})

test('current active employer background cannot admit new hidden criteria or foreign client display',()=>{
 for(const mutate of [detail=>{detail.ClientDesc+='<p>Mandatory additional criterion outside the role field.</p>'},detail=>{detail.ShowClientName=true;detail.ClientName='Other employer'},detail=>{delete detail.ShowClientName}]){const detail=structuredClone(financeDetail);mutate(detail);assert.equal(validateNativeDetail(detail,finance,current).sourceDetailComplete,false)}
})

test('current native supplementary criteria cannot silently discard malformed skills or experience',()=>{
 for(const mutate of [detail=>{detail.Skills.push({mandatory:'unread criterion'})},detail=>{detail.Skills='unread native skills'},detail=>{detail.Experience=[]},detail=>{detail.Experience={MinExp:'unreviewed number string'}}]){const detail=structuredClone(financeDetail);mutate(detail);assert.equal(validateNativeDetail(detail,finance,current).sourceDetailComplete,false)}
})

test('current registered proof retains the active original employer background and respects native salary visibility',async()=>{
 const replay=fixtureReplay(),jobs=await run(replay.options),proof=jobs[0].sourceNativePublicCriteria
 assert.equal(proof.ClientDesc,financeDetail.ClientDesc);assert.deepEqual(proof.Experience,financeDetail.Experience);assert.deepEqual(proof.Skills,financeDetail.Skills)
 assert.equal(proof.CTCInfo,null);assert.equal(proof.compensationWithheldByNativeVisibility,true)
})

test('an explicitly public native salary carrier is retained verbatim with full public criteria',async()=>{
 const replay=fixtureReplay((packet,body)=>{if(!packet.url.includes('/api/publicjobs/'+finance.JobId+'?'))return body;const detail=JSON.parse(body);detail.CTCInfo.HiddenFrom=[];return Buffer.from(JSON.stringify(detail))}),jobs=await run(replay.options)
 assert.deepEqual(jobs[0].sourceNativePublicCriteria.CTCInfo,{...financeDetail.CTCInfo,HiddenFrom:[]});assert.equal(jobs[0].sourceNativePublicCriteria.compensationWithheldByNativeVisibility,false)
})

for(const [name,mutate]of[
 ['latest explicit closed criteria notice',payload=>{payload.Result[1].JobDescV2='<p>This position is closed. We are no longer accepting applications.</p>'}],
 ['unselected native typed country contradiction',payload=>{const row=payload.Result.at(-1),locations=JSON.parse(row.Location);locations[0].Country='US';row.Location=JSON.stringify(locations)}],
 ['full native workplace JSON change',payload=>{const row=payload.Result[1],locations=JSON.parse(row.Location);locations[0].PlaceId='changed-native-place-identity';row.Location=JSON.stringify(locations)}],
 ['full native employer object change',payload=>{payload.Result[1].OrgDetails={...payload.Result[1].OrgDetails,OrgURL:'https://other-employer.invalid/'}}],
])test(`closing current native qualification cannot pass ${name}`,async()=>{
 const replay=fixtureReplay((packet,body,sequence)=>{if(packet.method!=='POST'||sequence!==2)return body;const payload=JSON.parse(body);mutate(payload);return Buffer.from(JSON.stringify(payload))})
 await assert.rejects(run(replay.options),/closing native qualification snapshot changed|country.*conflict/i)
})
