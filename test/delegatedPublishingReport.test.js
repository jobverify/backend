import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPublishingGapReport, publishingGapCsv } from '../scripts/publishingGapReport.js'
const now=new Date('2026-10-21T01:35:00Z')
const delegation={verified:true,verifiedAt:'2026-10-21T01:30:00Z',sources:['aerospace','energy'],preservesChildSourceAndCompany:true,
  evidence:{url:'https://example.com/careers',artifact:'delegation-proof.json',sha256:'a'.repeat(64)}}
const setup=()=>({now,catalog:[{source:'legacy',companyName:'Legacy',adapter:'workday',inventoryDelegation:structuredClone(delegation)},
  {source:'aerospace',companyName:'Aerospace',adapter:'workday'},{source:'energy',companyName:'Energy',adapter:'workday'}],
  extractionAudits:[{source:'legacy',completedAt:'2026-10-21T01:20:00Z',outcome:'positive-extraction-incomplete-evidence',eligibleJobs:21}],
  runtime:{databaseAvailable:true,generatedAt:'2026-10-21T01:31:00Z',publicCompanyNames:['Aerospace','Energy'],statuses:[],inventory:[
    {source:'aerospace',savedJobs:21,visibleJobs:21,visibleCompanies:['Aerospace']},
    {source:'energy',savedJobs:2,visibleJobs:2,visibleCompanies:['Energy']}]}})
const legacy=report=>report.rows.find(r=>r.source==='legacy')
test('source-preserving wrapper references separate public employers without inventing another company or publishing source',()=>{
  const report=buildPublishingGapReport(setup()),row=legacy(report)
  assert.equal(row.gapExplanation,'delegated-inventory-published-under-other-sources')
  assert.equal(row.visibleJobs,0);assert.equal(row.savedJobs,0);assert.deepEqual(row.visibleCompanies,[])
  assert.equal(row.extractionAuditEligibleJobs,21);assert.equal(row.completeSuccessfulCheck,false)
  assert.equal(report.summary.distinctVisibleCompanies,2);assert.equal(report.summary.sourcesWithVisibleJobs,2)
  assert.equal(report.summary.delegatingSourcesWithPublicChildInventory,1)
  assert.deepEqual(row.inventoryDelegation.publicChildSources,['aerospace','energy'])
  assert.equal(report.backlog.find(r=>r.source==='legacy').reason,'reconcile-delegated-source-coverage')
  assert.equal(report.backlog.find(r=>r.source==='legacy').priority,3)
  assert.ok(publishingGapCsv(report.rows).includes('inventoryDelegation'))
  assert.equal(report.reconciliation.delegatedSourceInventories.length,1)
})
test('unverified, stale, unknown, duplicate or self delegation cannot justify a public-child explanation',()=>{
  for(const mutate of [s=>{s.catalog[0].inventoryDelegation.verified=false},s=>{s.catalog[0].inventoryDelegation.verifiedAt='2026-07-01'},
    s=>{s.catalog[0].inventoryDelegation.sources=['unknown']},s=>{s.catalog[0].inventoryDelegation.sources=['aerospace','aerospace']},
    s=>{s.catalog[0].inventoryDelegation.sources=['legacy']},s=>{s.catalog[0].inventoryDelegation.preservesChildSourceAndCompany=false},
    s=>{s.catalog[0].inventoryDelegation.evidence.sha256=null},s=>{s.runtime.generatedAt='2026-07-01'},
    s=>{s.runtime.databaseAvailable=false},s=>{s.runtime.inventory=[]}]){
    const s=setup();mutate(s);const report=buildPublishingGapReport(s)
    assert.notEqual(legacy(report).gapExplanation,'delegated-inventory-published-under-other-sources')
    assert.equal(report.summary.delegatingSourcesWithPublicChildInventory,0)
  }
})
test('fresh delegated publication evidence cannot replace the latest failed check or create a verified zero',()=>{
  const s=setup();Object.assign(s.extractionAudits[0],{outcome:'extraction-failed',eligibleJobs:null})
  const report=buildPublishingGapReport(s)
  assert.equal(legacy(report).gapExplanation,'latest-isolated-check-failed')
  assert.equal(legacy(report).extractionAuditEligibleJobs,null);assert.equal(report.summary.verifiedZeroInventories,0)
})
test('a newer persisted failure outranks an earlier positive isolated wrapper audit',()=>{
  const s=setup();s.runtime.statuses=[{source:'legacy',latestAttempt:{success:false,failureKind:'network_or_timeout',
    attemptedAt:'2026-10-21T01:32:00Z',completedAt:'2026-10-21T01:34:00Z',rawRecords:null,jobs:null,eligibleJobs:null}}]
  const report=buildPublishingGapReport(s),row=legacy(report)
  assert.equal(row.runtimeOutcome,'failed');assert.equal(row.rawJobs,null);assert.equal(row.eligibleJobs,null)
  assert.equal(row.gapExplanation,'latest-persisted-check-failed')
  assert.equal(report.backlog.find(r=>r.source==='legacy').reason,'latest-persisted-check-failed')
  assert.notEqual(report.backlog.find(r=>r.source==='legacy').priority,3)
})
test('explicitly unknown child counts remain unknown while a source absent from a complete snapshot has zero',()=>{
  const s=setup();s.runtime.inventory[0].savedJobs=null;s.runtime.inventory[0].visibleJobs=null;s.runtime.inventory.pop()
  const row=legacy(buildPublishingGapReport(s)),children=row.inventoryDelegation.childInventories
  assert.equal(children[0].savedJobs,null);assert.equal(children[0].visibleJobs,null)
  assert.equal(children[1].savedJobs,0);assert.equal(children[1].visibleJobs,0)
  assert.deepEqual(row.inventoryDelegation.publicChildSources,[])
})
