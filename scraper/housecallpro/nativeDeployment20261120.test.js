import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {nativeBoard,nativeAPI,sha} from './currentProgrammeData.js'
import {readCurrentHousecallProgramme} from './currentProgramme.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-deployment-20261120.json.gz',import.meta.url))))
const legacy=JSON.parse(gunzipSync(readFileSync(new URL('../../test/fixtures/housecallpro-current-programme-20261111.json.gz',import.meta.url))))
const first=fixture.responses.find(p=>p.kind==='page1'),apiPacket=fixture.responses.find(p=>p.kind==='api')
const body=packet=>Buffer.from(packet.bodyBase64,'base64').toString('utf8')
const api=JSON.parse(body(apiPacket))
const model=JSON.parse(body(first).match(/window\.__remixContext = ([\s\S]+?);<\/script>/)[1])
const minimalPage=()=>({model:structuredClone(model),posts:structuredClone(model.state.loaderData['routes/embed.job_board'].jobPosts.data),
 reportedTotal:44,page:1,nativeDeploymentID:'greenhouse-current-20261120',revisionDifferences:[]})
for(const packet of fixture.responses)assert.equal(sha(Buffer.from(packet.bodyBase64,'base64')),packet.bodySHA256)
assert.equal(first.credentialRedacted,true)
assert.equal(apiPacket.bodyOriginalUnmodified,true)

const replay=(change=(_url,packet)=>packet)=>{
 const calls=[]
 const run=options=>readCurrentHousecallProgramme({requestIntervalMs:0,now:()=>fixture.capturedAt,...options,readPage:async(url)=>{
  const packet=fixture.responses.find(p=>p.requestedURL===url&&p.kind!=='page2')
  assert.ok(packet,'only current directly declared original response or its explicit token-redacted replay: '+url)
  calls.push(url)
  const changed=change(url,{...packet,headers:{...packet.headers}})
  return {url:changed.finalURL,status:changed.status,headers:changed.headers,bodyBase64:changed.bodyBase64}
 }})
 return {calls,run}
}

test('Housecall parses the actual44-role single-page native model without a stale51-role minimum',()=>{
 const page=nativeBoard(body(first),first.requestedURL,1,fixture.capturedAt)
 assert.equal(page.posts.length,44);assert.equal(page.reportedTotal,44)
 assert.equal(page.nativeDeploymentID,'greenhouse-current-20261120')
})

test('Housecall verifies every full original current API record against its44 native page IDs',()=>{
 const result=nativeAPI(body(apiPacket),[minimalPage()],fixture.capturedAt)
 assert.deepEqual(result.value,api)
 assert.equal(result.value.jobs.length,44)
})

test('Housecall replays the current single-page programme with five pinned assets and complete closing reserve',async t=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('No public HTTP in deterministic regression'))
 const r=replay(),jobs=await r.run({maxPages:1,maxRequests:18})
 const audit=jobs.nativeCollectionEvidence,inventory=readInventoryEvidence(jobs)
 assert.equal(jobs.length,0)
 assert.equal(audit.currentPublishedProgrammeComplete,true)
 assert.equal(audit.nativePages.length,1)
 assert.equal(audit.observedRecordCount,44)
 assert.equal(audit.requests,18);assert.equal(r.calls.length,18)
 assert.deepEqual(audit.nativePayload,api,'retain every original criterion/date/country field')
 assert.equal(audit.allOpeningReadsBeforeAllClosingReads,true)
 assert.equal(inventory.reportedTotal,44);assert.equal(inventory.listingComplete,true)
 assert.equal(inventory.lifecycleCleanupAllowed,false);assert.equal(audit.sourceScopeComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(r.calls.some(url=>url.includes('&page=2')),false)
})

test('Housecall rejects an independently reviewed old CSP paired with the new native model',async()=>{
 const old=legacy.responses.find(p=>p.kind==='page1').headers['content-security-policy']
 const r=replay((url,packet)=>url===first.requestedURL?{...packet,headers:{...packet.headers,'content-security-policy':old}}:packet)
 await assert.rejects(r.run(),/security|profile|deployment/i)
})

test('Housecall requires the full18-read budget for the current five-asset deployment',async()=>{
 const r=replay()
 await assert.rejects(r.run({maxRequests:17}),/reserve|budget|requests/i)
 assert.ok(r.calls.length<18)
})

for(const [name,change,expected]of [
 ['India work country',value=>{value.jobs[0].location.name='India'},/India/],
 ['India authored criterion',value=>{value.jobs[0].content+='<p>Work location: India.</p>'},/India/],
 ['missing full criteria',value=>{value.jobs[0].content=''},/criteria/],
 ['unreconciled membership',value=>{value.jobs.pop();value.meta.total--},/totals|membership/],
 ['duplicate identities',value=>{value.jobs[1].id=value.jobs[0].id},/duplicate|identit/],
 ['missing explicit office country',value=>{value.jobs.flatMap(row=>row.offices).find(office=>office.name==='Denver').location='Denver, Colorado'},/office|country/],
 ['contradictory office country',value=>{value.jobs.flatMap(row=>row.offices).find(office=>office.name==='Denver').location='Denver, Colorado, India'},/office|country|India/],
 ['unknown city used as primary country',value=>{value.jobs[0].location.name='Denver'},/country/],
])test('Housecall one-page support holds '+name,()=>{
 const changed=structuredClone(api);change(changed)
 assert.throws(()=>nativeAPI(JSON.stringify(changed),[minimalPage()],fixture.capturedAt),expected)
})
