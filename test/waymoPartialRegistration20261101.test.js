import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {buildScrapers} from '../scraper-support/providers/index.js'
import {buildScraperAttemptDiagnostics} from '../scraper-support/runner.js'
import {readInventoryEvidence,isCompleteScraperAttempt} from '../scraper-support/utils/inventoryEvidence.js'
import {buildIndiaSearchUrl,extractJobsFromSearchHtml} from '../scraper/waymo/script.js'

const packets=JSON.parse(gunzipSync(fs.readFileSync(new URL('../scraper/waymo/test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
const clock='2026-10-31T07:30:00.000Z'
const lastUrl=extractJobsFromSearchHtml(packets.find(row=>row.url===buildIndiaSearchUrl()).body).at(-1).sourceUrl

test('Waymo registration preserves partial native facts and stops at an application HTTP 202',async t=>{
  t.mock.method(globalThis,'fetch',async()=>assert.fail('Native HTTP is forbidden'))
  const scraper=buildScrapers().find(item=>item.name==='waymo')
  assert.ok(scraper)
  const jobs=await scraper.run({now:()=>clock,fetchText:async url=>{
    const packet=packets.find(row=>row.url===url)
    assert.ok(packet,'Uncaptured request: '+url)
    const status=url===lastUrl?202:packet.status
    if(status!==200)throw Object.assign(Error('Waymo HTTP '+status),{status,requestUrl:url,finalUrl:packet.finalUrl})
    return packet.body
  }})
  assert.equal(jobs.length,3)
  assert.ok(jobs.every(job=>job.source==='waymo'&&job.country==='India'&&job.jobDescription.length>1500
    &&job.sourceDetailComplete===false&&job.nativeRoleClosingReconciled===false
    &&job.sourceListingComplete===false&&job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
  assert.ok(jobs.every(job=>job.sourceUrl!==lastUrl),'The unavailable fourth role must remain excluded')
  assert.deepEqual(jobs.map(job=>job.activeApplyVerified),[false,false,false],
    'No native model has a closing reconciliation after the source interruption')
  const inventory=readInventoryEvidence(jobs)
  assert.equal(inventory.status,'coverage-gap')
  assert.equal(inventory.listingComplete,false)
  assert.equal(inventory.reportedTotal,null)
  assert.equal(inventory.indiaFacetCount,null)
  const diagnostics=buildScraperAttemptDiagnostics(jobs,undefined,scraper.provider)
  assert.equal(diagnostics.detailHealth.complete,false)
  assert.equal(diagnostics.detailHealth.inspectedJobs,3)
  assert.equal(diagnostics.detailHealth.incompleteJobs,3)
  assert.equal(diagnostics.detailHealth.missingDescriptions,0)
  assert.deepEqual(diagnostics.detailHealth.failureKinds,{'waymo-native-reconciliation-incomplete':3})
  assert.equal(isCompleteScraperAttempt({success:true,completedAt:clock,inventoryEvidence:inventory,detailHealth:diagnostics.detailHealth},{now:clock}),false)
})
