import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as petro from '../../scraper/petrobot/script.js'
import {createCatalogScraper,getScraperCatalog} from '../providers/index.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../utils/publishableJobMetrics.js'

// Exact captured bodies and original five-GET metadata. Only the per-run
// one-role/count1 envelope and explicit null/undefined mutations are synthetic.
const native=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/petrobot/native-captures/2026-11-01-older-role-date.json.gz',import.meta.url))))
const observation=JSON.parse(native.observationBody),hash=value=>createHash('sha256').update(value).digest('hex')
assert.equal(hash(native.observationBody),'7384af2e93fe756aff5ae7501f8ef94f444f16ccfe54d0585046cf17bd51260e')
assert.equal(observation.requests.length,5)
assert.equal(observation.completedAt,'2026-11-01T16:53:53.776Z')
for(const [label,index]of [['official',1],['listing',2],['detail',4]]){
  const receipt=observation.requests.find(row=>row.index===index),body=native[label+'Body']
  assert.equal(Buffer.byteLength(body),receipt.bytes);assert.equal(hash(body),receipt.bodySHA256);assert.equal(receipt.status,200)
}
const listing=JSON.parse(native.listingBody),detail=JSON.parse(native.detailBody),row=listing.content.find(value=>value.id==='744000145734619')
assert.equal(listing.content.length,3);assert.equal(listing.totalFound,3)
assert.equal(detail.id,row.id);assert.equal(row.releasedDate,'2026-08-26T12:57:04.833Z');assert.equal(detail.releasedDate,row.releasedDate)
const provider=getScraperCatalog().find(value=>value.source==='petrobot'),clone=value=>structuredClone(value)
const officialUrl=observation.requests.find(value=>value.index===1).url,listingUrl=observation.requests.find(value=>value.index===2).url,detailUrl=observation.requests.find(value=>value.index===4).url

for(const mode of ['unchanged','absent','provided-null','provided-undefined']){
  test('PetroBot known native Aug26 listing date survives optional detail '+mode,async t=>{
    // Replay comparison time is the existing native completion clock, not a
    // new observation/publication date or source freshness receipt.
    t.mock.timers.enable({apis:['Date'],now:Date.parse(observation.completedAt)})
    const original=clone(native),payload=clone(detail)
    if(mode==='absent')delete payload.releasedDate
    if(mode==='provided-null')payload.releasedDate=null
    if(mode==='provided-undefined')payload.releasedDate=undefined
    assert.equal(Object.hasOwn(payload,'releasedDate'),mode!=='absent')
    const negative=mode.startsWith('provided-'),results=[]
    for(const registered of [false,true]){
      const requests=[],snapshots=[]
      const snapshot=value=>{snapshots.push([value,clone(value)]);return value}
      const input={fetchText:async url=>{requests.push(url);assert.equal(url,officialUrl);return native.officialBody},fetchJson:async url=>{
        requests.push(url)
        if(url===listingUrl)return snapshot({...clone(listing),content:[clone(row)],totalFound:1})
        assert.equal(url,detailUrl);return snapshot(clone(payload))
      }}
      let jobs,error=null
      try{jobs=await(registered?createCatalogScraper(provider).run(input):petro.createPetroBotScraper().run(input))}catch(value){error=value}
      for(const[value,before]of snapshots)assert.deepEqual(value,before)
      assert.deepEqual(requests,[officialUrl,listingUrl,detailUrl])
      const metrics=jobs?analyzePublishableJobs(jobs,{now:new Date(observation.completedAt)}):null
      results.push({path:registered?'registered':'factory',jobs,error,metrics})
    }
    console.log('PROVIDED_DATE_OUTCOME '+JSON.stringify({mode,comparisonClock:observation.completedAt,originalNativeDate:row.releasedDate,detailOwnDate:Object.hasOwn(payload,'releasedDate'),detailDateKind:payload.releasedDate===undefined?'undefined':payload.releasedDate===null?'null':'native-string',paths:results.map(({path,jobs,error,metrics})=>({path,returnedRows:jobs?.length??null,outputDate:jobs?.[0]?.postingDate??null,inventory:jobs?readInventoryEvidence(jobs):null,genericEligible:metrics?.eligibleJobs.length??null,genericOld:metrics?.filterCounts.old??null,error:error?{message:error.message,incompleteScope:error.incompleteScope,abortRetries:error.abortRetries}:null}))}))
    for(const result of results){
      if(negative){
        assert.equal(result.error?.incompleteScope,true,'A provided null/undefined must reject instead of erasing the known old source date')
        assert.equal(result.error.abortRetries,true);assert.match(result.error.message,/detail publication date/);assert.equal(result.jobs,undefined)
      }else{
        assert.equal(result.error,null);assert.equal(result.jobs.length,1);const job=result.jobs[0]
        assert.equal(job.jobId,row.id);assert.equal(job.title,row.name);assert.equal(job.postingDate,row.releasedDate);assert.equal(job.jobDescription,detail.jobAd.sections.jobDescription.text)
        assert.equal(job.sourceUrl,detail.postingUrl);assert.equal(job.applyUrl,detail.applyUrl);assert.equal(result.metrics.eligibleJobs.length,0);assert.equal(result.metrics.filterCounts.old,1)
        const inventory=readInventoryEvidence(result.jobs);assert.equal(inventory.status,'complete-inventory');assert.equal(inventory.reportedTotal,1);assert.equal(inventory.verifiedAt,observation.completedAt)
        assert.notEqual(job.sourceScopeComplete,true);assert.ok(job.sourceGlobalJobCount==null&&job.sourceIndiaJobCount==null)
      }
    }
    assert.deepEqual(native,original)
  })
}
