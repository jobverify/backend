import assert from 'node:assert/strict'
import { fixture,replay } from './fixtureReplay.js'
import { readInventoryEvidence } from '../../utils/inventoryEvidence.js'

export async function checkCurrentFactory(source,factory){
  const r=replay(),jobs=await factory().run(r.options),audit=r.audits[0]
  assert.equal(audit.opening.publisherQualified,true);assert.equal(audit.closing.publisherQualified,true)
  assert.equal(audit.observations.length,fixture.oracle[source].records.length)
  for(const row of fixture.oracle[source].records){
    const job=audit.observations.find(job=>job.jobId===String(row.postId))
    assert.deepEqual(job.sourceNativeRecord,row.nativeOwnPostRecord);assert.equal(job.jobDescription,row.fullCriteriaText)
  }
  assert.equal(readInventoryEvidence(jobs).status,'discovery-only');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  assert.equal(audit.sourceScopeComplete,false)
  assert.ok(r.requests.indexOf(fixture.profiles[source].primaryURL)<r.requests.findIndex(url=>url.includes('/v1/boards/')))
}

export async function checkChangedPublisher(source,factory){
  const r=replay((url,page)=>{
    if(url===fixture.profiles[source].primaryURL)page.bodyBase64=Buffer.from('<title>Unrelated publisher</title>').toString('base64')
    return page
  })
  const jobs=await factory().run(r.options),audit=r.audits[0]
  assert.equal(audit.opening.publisherQualified,false);assert.equal(audit.closing.publisherQualified,false)
  assert.ok(audit.observations.every(job=>!job.sourceCurrentNativeRoleQualified))
  assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'discovery-only')
}
