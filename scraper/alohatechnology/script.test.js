import test from 'node:test'
import assert from 'node:assert/strict'
import {nativeFixture} from './nativeFixture.js'
import {run,extractCareerJobs,pageIndicatesAlohaTechnologyCareers,CAREERS_PAGE_URL,APPLICATION_EMAIL,COMPANY_HOME_URL} from './script.js'
const fixture=nativeFixture(import.meta.url)
test('Aloha native role boundaries preserve complete original criteria and explicit missing identities',()=>{
 const jobs=extractCareerJobs(fixture.get(CAREERS_PAGE_URL));assert.equal(pageIndicatesAlohaTechnologyCareers(fixture.get(CAREERS_PAGE_URL)),true)
 assert.equal(COMPANY_HOME_URL,'https://www.alohatechnology.com/');assert.equal(APPLICATION_EMAIL,'hr@alohatechnology.com')
 assert.deepEqual(jobs.map(j=>j.requiredSkills.length),[3,3,3,3,3,2]);assert.ok(jobs.every(j=>j.jobId===null&&j.requisitionId===null&&j.country===null))
 assert.ok(jobs.every(j=>!j.jobDescription.includes('Apply by emailing')&&!j.jobDescription.includes(':root')))
})
test('Aloha current run reconciles native public reveal and keeps company/workplace scope unknown',async()=>{
 const reports=[],jobs=await run({fetchPage:fixture.fetchPage,onAudit:r=>reports.push(r)})
 assert.equal(jobs.length,6);assert.equal(reports.length,1);assert.equal(reports[0].closingReconciled,true)
 assert.ok(jobs.every(j=>j.source==='alohatechnology'&&j.fullNativeCriteriaAvailable&&j.sourceDetailComplete===false&&j.country===null&&j.remoteStatus===null))
})
test('Aloha rejects a generic or inert-only source instead of manufacturing an empty inventory',()=>{
 assert.throws(()=>extractCareerJobs('<html><h1>Careers</h1></html>'),/identity|organization/i)
 assert.equal(pageIndicatesAlohaTechnologyCareers('<template>'+fixture.get(CAREERS_PAGE_URL)+'</template>'),false)
})
