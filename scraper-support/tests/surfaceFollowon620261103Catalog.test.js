import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog,createCatalogScraper} from '../providers/index.js'
import {nativeFixture} from '../../scraper/alohatechnology/nativeFixture.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
const counts={alohatechnology:{jobs:6,records:6,vacancies:6},ammachilabs:{jobs:22,records:23,vacancies:23},bluestock:{jobs:0,records:5,vacancies:2},businesswebsolutions:{jobs:0,records:11,vacancies:2}}
for(const[source,expected]of Object.entries(counts))test(source+' registered noDB source preserves current criteria/observation scope and runtime-only counts',async()=>{
 const provider=getScraperCatalog().find(p=>p.source===source),fixture=nativeFixture(new URL('../../scraper/'+source+'/x.js',import.meta.url)),reports=[]
 assert.ok(provider);assert.equal(provider.zeroResultPolicy,'evidence-required');assert.equal(provider.verifiedPublicJobCount,null);assert.equal(provider.verifiedIndiaJobCount,null);assert.equal(provider.verifiedOn,null)
 const jobs=await createCatalogScraper(provider).run({fetchPage:fixture.fetchPage,dryRun:true,persist:false,enqueueAlerts:false,onAudit:r=>reports.push(r)})
 assert.equal(jobs.length,expected.jobs);assert.equal(reports.length,1);assert.equal(reports[0].closingReconciled,true)
 const obs=readSourceObservationEvidence(jobs,source);assert.equal(obs.observedRecordCount,expected.records);assert.equal(obs.observedVacancyCount,expected.vacancies)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.ok(jobs.every(j=>j.country===null&&j.requisitionId===null));assert.equal(reports[0].sourceScopeComplete,false);assert.equal(reports[0].lifecycleCleanupAllowed,false)
 assert.equal(reports[0].companyGlobalTotal,null);assert.equal(reports[0].companyIndiaTotal,null)
})
