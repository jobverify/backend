import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {extractCurrentListings,extractCurrentDetail} from './currentNative.js'
import {createE2logySoftwareSolutionsScraper} from './script.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-http-20261110.json.gz',import.meta.url))))
const listing=extractCurrentListings(capture.responses[0].body)[0]
const detail=capture.responses.find(row=>row.url===listing.sourceUrl).body
const change=value=>detail.replace(/var country = '[A-Z]{2}';/,"var country = "+value+";")

for(const value of ['US','DE','SG','AU'])test('visitor form country '+value+' does not change the native India workplace',()=>{
 const html=change("'"+value+"'")
 assert.notEqual(html,detail)
 const job=extractCurrentDetail(html,listing)
 assert.equal(job.country,'India')
 assert.equal(job.location,listing.location)
 assert.equal(job.sourceDetailComplete,true)
})

for(const value of ["'ZZ'","'Mars'",'window.country',"'IN' + ''"])
 test('nonliteral or unknown visitor form country remains rejected: '+value,()=>{
  assert.throws(()=>extractCurrentDetail(change(value),listing),/visitor.country|authority structure/)
 })

test('the source allows its bounded 30-second read allowance and retains opening/closing reconciliation',async t=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('Only retained response fixtures are allowed'))
 const counts=new Map()
 const jobs=await createE2logySoftwareSolutionsScraper().run({requestTimeoutMs:30000,now:()=>capture.completedAt,
  fetchPage:async url=>{
   const index=counts.get(url)||0;counts.set(url,index+1)
   const row=capture.responses.filter(item=>item.url===url)[index]
   assert.ok(row)
   return{status:row.status,url:row.finalUrl,headers:row.headers,body:row.body}
  }})
 assert.equal(jobs.length,2)
 assert.equal(jobs.nativeCollectionEvidence.requestTimeoutMs,30000)
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningClosingCriteriaMatch,true)
})
