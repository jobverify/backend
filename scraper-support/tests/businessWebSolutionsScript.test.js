import test from 'node:test'
import assert from 'node:assert/strict'
import {nativeFixture} from '../../scraper/alohatechnology/nativeFixture.js'
import {extractOpenJobs,run,CAREERS_URL} from '../../scraper/businesswebsolutions/script.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const fixture=nativeFixture(new URL('../../scraper/businesswebsolutions/x.js',import.meta.url))
test('current Business Web Solutions open table preserves remote evidence and unknown countries/IDs',()=>{
 const rows=extractOpenJobs(fixture.get(CAREERS_URL));assert.equal(rows.length,3)
 assert.deepEqual(rows.map(r=>r.title),['Full Stack Web Development Internship','Social Media Marketing Executive','Business Development Associate'])
 assert.ok(rows.every(r=>r.country===null&&r.jobId===null&&r.requisitionId===null&&r.location==='Remote'))
 assert.equal(rows.find(r=>r.title==='Social Media Marketing Executive').applyUrl,null)
})
test('current detail classification preserves all11source observations and full native criteria without publishing unresolved vacancies',async()=>{
 const reports=[],jobs=await run({fetchPage:fixture.fetchPage,onAudit:r=>reports.push(r)})
 assert.equal(jobs.length,0);assert.equal(reports[0].observations.length,11);assert.equal(reports[0].programHandoffs.length,1)
 assert.equal(reports[0].fullNativeRoleDetails[0].nativeJobId,'09261');assert.equal(reports[0].identityConflictCount,1)
 assert.equal(readSourceObservationEvidence(jobs,'businesswebsolutions').observedVacancyCount,2)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
