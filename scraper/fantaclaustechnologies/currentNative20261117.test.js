import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {run,extractPublicJobs} from './script.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
const bytes=fs.readFileSync(new URL('./test-data/current-20261117.json.gz',import.meta.url)),fixture=JSON.parse(gunzipSync(bytes)),profile=JSON.parse(fs.readFileSync(new URL('./reviewedNative20261117.json',import.meta.url)))
assert.equal(createHash('sha256').update(bytes).digest('hex'),profile.fixtureSHA256)
const careers=Buffer.from(fixture.originals.find(p=>p.requestedURL==='https://inteligenai.com/careers/').bodyBase64,'base64').toString()
function replay(t,change=(body)=>body){
 let clock=0;t.mock.method(performance,'now',()=>clock);const calls=[],seen=new Map()
 const fetchImpl=async(url,init={})=>{
  init.signal?.throwIfAborted();const n=seen.get(url)??0;seen.set(url,n+1)
  const packet=fixture.originals.filter(p=>p.requestedURL===url)[n];assert.ok(packet,'undeclared FantaClaus URL '+url)
  assert.equal(init.method??'GET','GET');calls.push({url,n});clock+=500
  const body=Buffer.from(packet.bodyBase64,'base64');assert.equal(createHash('sha256').update(body).digest('hex'),packet.bodySHA256)
  const response=new Response(change(body.toString(),{url,n}),{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.finalURL});return response
 };t.mock.method(globalThis,'fetch',fetchImpl);return{calls,options:{fetchImpl,now:()=>fixture.completedAt}}
}
test('current FantaClaus original includes two country-unresolved vacancies and a distinct campus programme, never three India vacancies',()=>{
 const rows=extractPublicJobs(careers);assert.equal(rows.length,2)
 assert.deepEqual(rows.map(r=>r.title),["Founder's Office Associate - Growth & Operations",'AI Development Engineer'])
 assert.ok(rows.every(r=>r.country===null&&r.city===null&&r.sourceCountryScopeUnresolved===true))
})
test('current FantaClaus closes all9 complete publisher-owned entries across6 original reads with all publication/cleanup holds',async t=>{
 const io=replay(t),rows=await run(io.options)
 assert.equal(io.calls.length,6);assert.equal(rows.length,2)
 assert.equal(rows.nativeCollectionEvidence.currentAuthoredEntries.length,3);assert.equal(rows.nativeCollectionEvidence.archivedEntries.length,6)
 const programme=rows.nativeCollectionEvidence.currentAuthoredEntries.find(r=>r.recordKind==='hiring-signals')
 assert.equal(programme.title,'Campus Recruitment Drive 2027');assert.equal(programme.applicationQualificationComplete,false)
 assert.ok(programme.qualificationHolds.includes('campus-recruitment-programme;not-a-job-vacancy'));assert.ok(programme.qualificationHolds.some(h=>h.includes('closedform')))
 assert.ok(rows.nativeCollectionEvidence.currentAuthoredEntries.filter(r=>r.recordKind==='vacancy-rows').every(r=>r.qualificationHolds.some(h=>h.includes('login-required-401'))))
 for(const row of rows){assert.equal(row.country,null);assert.equal(row.city,null);assert.equal(row.activationVerified,false);assert.equal(row.sourceApplicationQualificationComplete,false);assert.equal(row.lifecycleCleanupAllowed,false);assert.equal(row.sourceScopeComplete,false);assert.equal(row.sourceDetailComplete,true);assert.ok(row.sourceNativeRoleModel&&row.sourceNativeClosingRoleModel)}
 const observation=readSourceObservationEvidence(rows,'fantaclaustechnologies');assert.equal(observation.observedRecordCount,9);assert.equal(observation.observedVacancyCount,2)
 assert.equal(sourceLifecycleCleanupForbidden(rows),true)
 const assessed=assessSoftFailureAcquisition({source:'fantaclaustechnologies'},rows)
 // Runner rawRecords counts vacancy observations, excluding the programme and
 // six explicit closed entries; the canonical receipt retains all9 entries.
 assert.equal(assessed.runnerOutcome.rawRecords,2);assert.equal(assessed.indiaJobs,0);assert.equal(assessed.cleanupOptions.replaceExisting,false)
})
for(const [label,edit]of[
 ['criteria',html=>html.replace('0-5 years','0-7 years')],
 ['application identity',html=>html.replace('tYjH2fG9TnFYj5Zk9','differentNativeForm')],
 ['country claim',html=>html.replace('Gurugram |','India |')],
 ['closed role',html=>html.replace('Senior Backend Engineer','Another Backend Engineer')],
 ['hidden criteria',html=>html.replace('data-id="62251ad"','hidden data-id="62251ad"')],
])test('FantaClaus holds full native '+label+' drift at closing',async t=>{
 const io=replay(t,(html,c)=>c.n===1&&c.url==='https://inteligenai.com/careers/'?edit(html):html)
 await assert.rejects(run(io.options),/Fantaclaus|native|model|changed|hidden|criteria/i)
})
test('FantaClaus country-unknown caller cap preserves full closing model and canonical observations',async t=>{
 const io=replay(t),rows=await run({...io.options,maxJobs:1});assert.equal(rows.length,1);assert.equal(io.calls.length,6);assert.equal(readSourceObservationEvidence(rows,'fantaclaustechnologies').observedRecordCount,9)
})
test('FantaClaus preserves opaque abort and rejects body-only callbacks before reads',async t=>{
 const io=replay(t),controller=new AbortController(),reason={opaque:'caller'};controller.abort(reason)
 await assert.rejects(run({...io.options,signal:controller.signal}),e=>e===reason)
 await assert.rejects(run({fetchPage:()=>{throw Error('body-only read')}}),/original HTTP/i);assert.equal(io.calls.length,0)
})
