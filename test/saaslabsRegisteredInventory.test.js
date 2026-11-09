import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

test('registered SaaSLabs preserves17 native descriptions without completing missing application criteria',async()=>{
  const provider=getScraperCatalog().find(row=>row.source==='saaslabs')
  assert.equal(provider.adapter,'script')
  const archive=JSON.parse(gunzipSync(readFileSync(new URL('../scraper/saaslabs/fixtures/retained-http-20261029.json.gz',import.meta.url))))
  const html=Buffer.from(archive.bodyBase64,'base64').toString('utf8'),audits=[]
  const jobs=await createCatalogScraper(provider).run({
    fetchText:async url=>{assert.equal(url,archive.receipt.url);return html},
    onAudit:audit=>audits.push(audit),
  })
  assert.equal(jobs.length,17)
  assert.equal(new Set(jobs.map(job=>job.jobId)).size,17)
  assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete===false))
  assert.ok(jobs.every(job=>job.sourceListingDescriptionComplete===true&&job.sourceNativeCriteriaCopyComplete===false))
  assert.ok(jobs.every(job=>job.jobDescription&&job.sourceNativeDescription&&job.sourceNativeRecord))
  assert.ok(jobs.every(job=>job.postingDate===null&&job.legalHiringEmployer===null))
  assert.equal(audits.length,1)
  assert.equal(audits[0].originalNativeHTML,html)
  assert.equal(audits[0].observedIndiaRecords,17)
  assert.equal(audits[0].currentLiveQualification,false)
  assert.equal(audits[0].lifecycleCleanupAllowed,false)
  const evidence=readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete,false)
  assert.equal(evidence.reportedTotal,null)
  assert.equal(evidence.indiaFacetCount,null)
})
