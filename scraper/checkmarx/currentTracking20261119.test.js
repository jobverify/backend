import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {parseCheckmarxBoard} from './nativeContract.js'
import {readNativeData} from './nativeData.js'
import {run} from './script.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {PROVIDER_METADATA} from './catalog.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/current-tracking-20261119.json.gz',import.meta.url))))
const html=Buffer.from(capture.responses[0].bodyBase64,'base64').toString('utf8')
const options={now:capture.completedAt}
const rows=readNativeData(html,'COMPANY_POSITIONS_DATA')
const changed=(id,mutate)=>html.replace(/(\bCOMPANY_POSITIONS_DATA\s*=\s*)([^\r\n]+)/,(_match,before,line)=>{
 const value=structuredClone(rows)
 mutate(value.find(row=>row.uid===id))
 return before+JSON.stringify(value).replaceAll('<','\\u003C').replaceAll('>','\\u003E')+(line.match(/[,;]\s*$/)?.[0]||'')
})

test('Checkmarx current foreign-only referral originals preserve 31 records and two query-free India identities',()=>{
 const board=parseCheckmarxBoard(html,options)
 assert.equal(board.rows.length,31)
 assert.deepEqual(board.rows.filter(row=>row.location.country==='IN').map(row=>row.uid),['5D.474','C7.471'])
 for(const id of ['35.27F','BF.475']){
  const row=board.rows.find(row=>row.uid===id)
  assert.equal(row.is_internal,false)
  assert.notEqual(row.location.country,'IN')
  assert.equal(new URL(row.url_comeet_hosted_page).search,'')
 }
})

for(const id of ['35.27F','BF.475'])for(const [label,mutate]of[
 ['changed referral bytes',row=>{row.url_active_page+='&unqualified=true';row.url_detected_page=row.url_active_page}],
 ['employee-only role',row=>{row.is_internal=true}],
 ['changed official identity',row=>{row.url_active_page=row.url_active_page.replace(row.uid,'A0.000');row.url_detected_page=row.url_active_page}],
 ['changed assigned country',row=>{row.location.country=id==='35.27F'?'SG':'IL'}],
])test('Checkmarx exact current '+id+' referral rejects '+label,()=>{
 assert.throws(()=>parseCheckmarxBoard(changed(id,mutate),options),/Checkmarx native contract:/)
})

test('Checkmarx current imported workflow recovers two complete eligible India roles and preserves company scope holds',async t=>{
 const workflow=JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/current-workflow-20261119.json.gz',import.meta.url))))
 const visits=new Map()
 t.mock.method(globalThis,'fetch',async(url,init={})=>{
  const count=visits.get(url)||0;visits.set(url,count+1)
  const packet=workflow.responses.filter(row=>row.requestedURL===url)[count]
  assert.ok(packet,'Only captured public native reads '+url)
  assert.equal(init.method??'GET','GET')
  return Object.defineProperty(new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers}),'url',{value:packet.url})
 })
 const jobs=await run({now:workflow.completedAt})
 assert.equal([...visits.values()].reduce((a,b)=>a+b,0),4)
 assert.equal(jobs.length,2)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.nativeCompanyUID==='C0.008'))
 const assessed=assessSoftFailureAcquisition(PROVIDER_METADATA,jobs)
 assert.equal(assessed.eligibleJobs,2)
 assert.equal(assessed.runnerOutcome.success,true)
 assert.equal(readSourceObservationEvidence(jobs,'checkmarx').observedRecordCount,31)
 assert.equal(readSourceObservationEvidence(jobs,'checkmarx').sourceScopeComplete,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
