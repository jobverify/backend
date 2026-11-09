import assert from 'node:assert/strict'
import test from 'node:test'
import {fixture,replay} from './fixtureReplay.js'
import {getScraperCatalog,createCatalogScraper} from '../../providers/index.js'
import {readInventoryEvidence} from '../../utils/inventoryEvidence.js'
for(const profile of fixture.profiles)test(profile.source+': registered reader audits original all-country pairs before India/cap selection',async()=>{
 const r=replay(),provider=getScraperCatalog().find(p=>p.source===profile.source)
 const jobs=await createCatalogScraper(provider).run({...r.options,maxJobs:1})
 assert.equal(r.audits.length,1,'Native original audit callback is required')
 const a=r.audits[0],expected=fixture.oracle[profile.source],expectedCandidates=profile.source==='huggingface'?expected.hiddenPostings:0
 assert.equal(a.source,profile.source);assert.equal(a.sourceScopeComplete,false)
 assert.equal(a.observations.length,expected.records.length)
 assert.equal(a.phases.length,2,'Fresh opening/closing collections and own pairs required')
 assert.equal(a.phases[0].listingRowCount,expected.listingRows)
 for(const original of expected.records){
  const row=a.observations.find(o=>o.id===original.id);assert.ok(row)
  assert.equal(row.ownPairQualified,true,original.id+': '+row.issues.join('; '))
  assert.deepEqual(JSON.parse(JSON.stringify(row.originalNative)),original.originalNative)
  assert.deepEqual(JSON.parse(JSON.stringify(row.listingVariants)),original.listingVariants)
  assert.equal(row.originalNative.code,original.originalNative.code)
  assert.equal(row.requisitionId,null)
  assert.equal(row.fieldProvenance.publication,'native.published+listing.published_on')
  assert.ok(row.originalOwnHTML.bodyBase64)
 }
 assert.equal(a.observations.filter(o=>o.geography.unresolved).length,expected.hiddenPostings)
 assert.ok(r.requests.every(u=>!u.includes('/api/v3/')&&!/\/apply\/?$/.test(new URL(u).pathname)&&!u.includes('llms.txt')))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.notEqual(readInventoryEvidence(jobs).status,'verified-empty')
 assert.equal(a.employerBindingQualified,profile.source==='huggingface')
 assert.equal(a.candidateCount,expectedCandidates)
 assert.equal(jobs.length,Math.min(1,expectedCandidates))
 if(profile.source==='seeq'){assert.equal(a.companyDeclaredHandoff,true);assert.ok(a.issues.some(s=>s.includes('current-company-handoff-visibility-unqualified')))}
 if(profile.source==='travisci')assert.ok(a.issues.some(s=>s.includes('current-company-handoff-missing')))
})
test('catalogues clear stale source-wide dates, counts and fixed-zero claims',()=>{
 const all=getScraperCatalog()
 for(const p of fixture.profiles){const row=all.find(v=>v.source===p.source)
  for(const key of ['verifiedOn','verifiedAt','verifiedPublicJobCount','verifiedIndiaJobCount'])assert.equal(row[key],null,p.source+': '+key)
  assert.equal(row.countryFilter,'India');assert.equal(row.sourceScopeComplete,false);assert.equal(row.lifecycleCleanupAllowed,false)
  assert.equal(row.backfillMode,'discovery-only');assert.equal(row.atsPlatform,'workable-public-get')
 }
})

test('ordinary consumers preserve original criteria and never promote hidden-country candidates to India',async()=>{
 const {normalizeScrapedJob}=await import('../../utils/normalizeScrapedJob.js'),{generateFingerprint}=await import('../../utils/applicationIdentity.js'),{isIndiaJob}=await import('../../utils/indiaLocationFilter.js'),r=replay()
 const jobs=await createCatalogScraper(getScraperCatalog().find(p=>p.source==='huggingface')).run(r.options)
 assert.equal(jobs.length,3)
 for(const job of jobs){const normalized=normalizeScrapedJob(job);assert.equal(normalized.sourceDescription,job.jobDescription);assert.equal(normalized.country,null);assert.equal(normalized.countryScopeUnresolved,true);assert.equal(isIndiaJob(normalized),false);assert.match(generateFingerprint(normalized),/^[a-f0-9]{16,}$/)}
})
