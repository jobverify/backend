import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/anydo-breezy-empty-board-20261108.json.gz',import.meta.url))))
const sha=raw=>createHash('sha256').update(raw).digest('hex')

test('Any.do retains its bound native empty-board signal from genuine saved responses',async t=>{
 let unexpectedPublicRequests=0
 t.mock.method(globalThis,'fetch',()=>{unexpectedPublicRequests++;assert.fail('Genuine saved-response regression forbids public requests')})
 const documents=new Map(fixture.documents.map(row=>{
  const raw=Buffer.from(row.body.data,'base64')
  assert.equal(raw.length,row.body.bytes)
  assert.equal(sha(raw),row.body.sha256)
  assert.equal(row.status,200)
  assert.equal(row.method,'GET')
  assert.equal(row.requestedURL,row.finalURL)
  return[row.requestedURL,{...row,html:new TextDecoder('utf-8',{fatal:true}).decode(raw)}]
 }))
 const requests=[]
 const {run}=await import('../scraper/anydo/script.js')
 let jobs
 try{
  jobs=await run({now:()=>fixture.replayClock,maxRequests:2,maxPages:4,maxDetails:1,sourceTimeoutMs:10000,
   fetchPage:async url=>{
    requests.push(url)
    const row=documents.get(url)
    assert.ok(row,'Unexpected source URL outside genuine two-response fixture: '+url)
    return{url:row.finalURL,status:row.status,contentType:row.contentType,html:row.html}
   }})
 }catch(error){
  t.diagnostic(JSON.stringify({evidenceKind:fixture.evidenceKind,requests,
   replayClock:fixture.replayClock,error:error.message,recruitmentObservations:error.recruitmentObservations??null,
   unexpectedPublicRequests}))
  throw error
 }
 assert.equal(unexpectedPublicRequests,0)
 assert.deepEqual(requests,['https://www.any.do/','https://any-do.breezy.hr/'])
 assert.equal(jobs.length,0)
 const audit=jobs[Symbol.for('jobverify.verified-recruitment-observations')]
 assert.equal(audit.nativeRecords,0)
 assert.equal(audit.returnedIndiaJobs,0)
 assert.equal(audit.sourceScopeComplete,false)
 assert.equal(audit.lifecycleCleanupAllowed,false)
 const empty=audit.nativeInventoryReads.find(row=>row.kind==='breezy')
 assert.ok(empty,'Retain the actual publisher empty-state evidence')
 assert.equal(empty.boardEmptyStateObserved,true)
 assert.equal(empty.reportedTotal,null,'An untranslated empty-state signal is not an authoritative numeric total')
 assert.equal(empty.surface,'https://any-do.breezy.hr/')
 const inventory=readInventoryEvidence(jobs)
 assert.equal(inventory.listingComplete,false)
 assert.equal(inventory.reportedTotal,null)
 assert.equal(inventory.indiaFacetCount,null)
 assert.equal(inventory.status,'coverage-gap')
})
