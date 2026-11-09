import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper,getScraperCatalog} from '../scraper-support/providers/index.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {extractionRawJobMetrics} from '../scraper-support/utils/extractionRawJobMetrics.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/recruitmentGoal20261104/syrma-current-native.json.gz',import.meta.url))))
const provider=getScraperCatalog().find(row=>row.source==='syrmasgs'),packets=new Map(fixture.packets.map(row=>[row.requestedURL,row]))
async function replay(options={}){
 const calls=[]
 const jobs=await createCatalogScraper(provider).run({fetchResponse:async(url,init)=>{
  calls.push(url);const packet=packets.get(url);assert.ok(packet,'Only current declared native fixture entities: '+url)
  assert.equal(init.method,'GET');assert.equal(init.body,null)
  const bytes=Buffer.from(packet.bodyText),time=new Date().toISOString()
  assert.equal(bytes.length,packet.bodyBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.bodySHA256)
  return {...packet,bytes,html:packet.bodyText,startedAt:time,completedAt:time}
 },...options})
 return{jobs,calls}
}
test('registered Syrma retains seven native vacancy observations separately from four qualified India jobs',async()=>{
 const {jobs,calls}=await replay()
 assert.equal(calls.length,22);assert.equal(jobs.length,4)
 assert.deepEqual(readSourceObservationEvidence(jobs,provider.source),{source:'syrmasgs',recordKind:'vacancy-rows',observedRecordCount:7,observedVacancyCount:7,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 assert.deepEqual(extractionRawJobMetrics(provider,jobs,readInventoryEvidence(jobs)),{rawJobs:7,rawJobsBasis:'observed-native-vacancy-rows'})
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.observations.length,7)
 assert.equal(audit.observations.filter(job=>job.country===null).length,3)
 assert.equal(audit.observations.filter(job=>job.country==='India'&&job.sourceDetailComplete).length,4)
 assert.equal(audit.rawNativeOriginals.length,22)
 assert.equal(audit.wholeNativeRoleModelsClosingReconciled,true)
 assert.equal(audit.transportEvidenceWithinRun,true)
 assert.equal(audit.sourceScopeComplete,false)
 assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false&&/^2025-/.test(job.postingDate)&&job.sourceDescription.length>100))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('a registered Syrma output cap never shrinks the seven-observation source cohort',async()=>{
 const {jobs,calls}=await replay({maxJobs:1})
 assert.equal(jobs.length,1);assert.equal(calls.length,22)
 assert.equal(readSourceObservationEvidence(jobs,provider.source).observedVacancyCount,7)
 assert.equal(jobs.nativeCollectionEvidence.observations.length,7)
 assert.equal(extractionRawJobMetrics(provider,jobs,readInventoryEvidence(jobs)).rawJobs,7)
})
test('Syrma zero-read cap leaves native vacancy counts unknown rather than certifying zero',async()=>{
 const {jobs,calls}=await replay({maxJobs:0})
 assert.equal(jobs.length,0);assert.equal(calls.length,0)
 assert.equal(readSourceObservationEvidence(jobs,provider.source),null)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
