import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {extractionRawJobMetrics} from '../../scraper-support/utils/extractionRawJobMetrics.js'
import {nativeFixture} from '../alohatechnology/nativeFixture.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

for(const [source,observed,emitted]of[['sachaengineering',136,136],['hiddenbrainsinfotech',15,14],['ammachilabs',23,22],['hostbooks',9,9]]){
 test(source+' registered decoration preserves observed native row evidence without certifying an India total',async t=>{
  t.mock.method(globalThis,'fetch',async()=>{throw Object.assign(Error('Unexpected default test network'),{abortRetries:true})})
  if(source==='ammachilabs'){
   const fixture=nativeFixture(new URL('../ammachilabs/x.js',import.meta.url)),provider=getScraperCatalog().find(p=>p.source===source),reports=[]
   const jobs=await createCatalogScraper(provider).run({fetchPage:fixture.fetchPage,onAudit:r=>reports.push(r),now:()=> '2026-10-31T08:00:00.000Z'})
   const audit=readSourceObservationEvidence(jobs,source),evidence=readInventoryEvidence(jobs)
   assert.equal(jobs.length,emitted);assert.equal(audit.source,source);assert.equal(audit.observedRecordCount,observed);assert.equal(audit.observedVacancyCount,observed)
   assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null)
   assert.equal(reports[0].scopeGapRecords[0].jobId,'26893');assert.match(reports[0].scopeGapRecords[0].nativeEmployerName,/CWEGE/)
   assert.ok(jobs.every(job=>job.country===null&&job.requisitionId===null));assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
   assert.deepEqual(extractionRawJobMetrics(provider,jobs,evidence),{rawJobs:observed,rawJobsBasis:'observed-native-vacancy-rows'})
   return
  }
  const packets=JSON.parse(gunzipSync(fs.readFileSync(new URL('../'+source+'/test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
  const read=async url=>{const p=packets.find(p=>p.url===url);assert.ok(p,'Uncaptured '+url);assert.equal(p.status,200);return p.body}
  const provider=getScraperCatalog().find(p=>p.source===source)
  const jobs=await createCatalogScraper(provider).run({fetchText:read,fetchBellCompanyApiPage:read,fetchJson:async url=>JSON.parse(await read(url)),now:()=> '2026-10-31T08:00:00.000Z'})
  assert.equal(jobs.length,emitted)
  const audit=jobs[0].nativeCollectionEvidence,evidence=readInventoryEvidence(jobs)
  assert.equal(audit?.source,source);assert.equal(audit.observedListingCount,observed)
  assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.reportedTotal,null);assert.equal(audit.indiaFacetCount,null)
  assert.ok(jobs.slice(1).every(job=>!Object.hasOwn(job,'nativeCollectionEvidence')))
  assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
  assert.deepEqual(extractionRawJobMetrics(provider,jobs,evidence),{rawJobs:observed,rawJobsBasis:'observed-native-listing-rows'})
 })
}
