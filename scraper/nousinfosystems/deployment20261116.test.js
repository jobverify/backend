import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {runCurrentNous} from './nativeCurrent.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261116/deployment.json.gz',import.meta.url))))
const main='https://www.artizent.com/assets/index-D2dkAufN.js'
const replay=async(edit=()=>{})=>{
 const visits=new Map()
 return runCurrentNous({now:capture.capturedAt,fetchImpl:async(url,init)=>{
  const count=visits.get(url)||0;visits.set(url,count+1)
  const original=capture.responses.filter(row=>row.url===url)[count]
  assert.ok(original,'Uncaptured current public GET '+url);assert.equal(init.method,'GET')
  const row={...original,body:Buffer.from(original.bodyBase64,'base64').toString('utf8')};edit(row)
  const response=new Response(row.body,{status:row.status,headers:row.headers})
  Object.defineProperty(response,'url',{value:row.finalURL});return response
 }})
}
test('Nous Nov16 complete current graph retains fourteen country-unknown roles without promoting any India jobs',async()=>{
 const jobs=await replay(),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0)
 assert.equal(audit.observedRecordCount,14)
 assert.equal(audit.unknownCountryVacancies,14)
 assert.equal(audit.observations.length,14)
 assert.equal(audit.wholeObservedNativeBoardClosingReconciled,true)
 assert.equal(audit.companyIndiaZeroProven,false)
 assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.companyIndiaTotal,null)
 assert.ok(audit.observations.every(row=>row.country===null&&row.legalHiringOrganization===null&&row.ownOpeningModel.overviewText.length>300&&row.ownOpeningModel.overviewText===row.ownClosingModel.overviewText))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(audit.originalResponses.length,44)
})
for(const[label,edit,error]of[
 ['edited current program',row=>{if(row.url===main)row.body+=';window.unreviewed=true'},/publisher client program changed/],
 ['future program declaration',row=>{if(row.url==='https://www.artizent.com/')row.body=row.body.replace('index-D2dkAufN.js','index-00000000.js')},/program declarations changed/],
 ['mixed reviewed deployments',row=>{if(row.url==='https://www.artizent.com/about/our-story')row.body=row.body.replace('index-D2dkAufN.js','index-Bln9X1qC.js')},/main client changed|program declarations changed/],
 ['extra retained role condition',row=>{if(row.url.includes('/openings/java-fullstack-developer-ai'))row.body=row.body.replace('Job Description','Additional visa condition Job Description')},/headings changed|mandatory criteria/],
])test('Nous Nov16 graph rejects '+label,async()=>{await assert.rejects(replay(edit),error)})
