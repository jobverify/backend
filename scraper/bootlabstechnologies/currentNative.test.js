import test from 'node:test'
import assert from 'node:assert/strict'
import {nativeFixture} from '../bizongo/nativeFixture.js'
import {createBootLabsTechnologiesScraper,CAREER_PAGE_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const fixture=nativeFixture(import.meta.url),PROFILE='https://www.linkedin.com/company/bootlabs-technologies/jobs/',timeout=value=>new Promise(resolve=>setTimeout(()=>resolve(value),80))
test('current declared LinkedIn employer posts are retained without inventing vacancy totals, IDs or work countries',async()=>{
 const reports=[],calls=[],jobs=await createBootLabsTechnologiesScraper().run({fetchText:fixture.get,fetchPage:async u=>{calls.push(u);return fixture.fetchPage(u)},onAudit:r=>reports.push(r)})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 const evidence=readSourceObservationEvidence(jobs,'bootlabstechnologies');assert.equal(evidence.recordKind,'hiring-signals');assert.equal(evidence.observedVacancyCount,0)
 assert.deepEqual(calls,[CAREER_PAGE_URL,PROFILE,CAREER_PAGE_URL,PROFILE]);assert.equal(reports.length,1)
 assert.equal(reports[0].observations.length,10);assert.equal(reports[0].observations.filter(o=>o.hiringSignal).length,6)
 for(const row of reports[0].observations){assert.equal(row.country,null);assert.equal(row.jobId,null);assert.equal(row.requisitionId,null);assert.ok(row.originalText.length>0);assert.ok(row.nativeAnnouncementId)}
})
test('profile website changes cannot turn generic public posts into this employer inventory',async()=>{
 await assert.rejects(createBootLabsTechnologiesScraper().run({fetchText:u=>fixture.get(u),fetchPage:async u=>{const r=await fixture.fetchPage(u);if(u===PROFILE)r.body=r.body.replaceAll('https://www.bootlabstech.com/','https://unrelated.example/');return r}}),/employer|website|identity/i)
})
test('native announcement closing text changes prevent reconciliation',async()=>{
 let read=0;await assert.rejects(createBootLabsTechnologiesScraper().run({fetchText:fixture.get,fetchPage:async u=>{const r=await fixture.fetchPage(u);if(u===PROFILE&&++read===2)r.body=r.body.replaceAll('Senior Platform Engineer','Principal Platform Engineer');return r}}),/closing/i)
})
test('native profile observer preserves exact cancellation reason',async()=>{
 const controller=new AbortController(),reason={abort:'bootlabs-observer'},p=createBootLabsTechnologiesScraper().run({signal:controller.signal,fetchText:fixture.get,fetchPage:fixture.fetchPage,onAudit:()=>{controller.abort(reason);return new Promise(()=>{})}})
 assert.equal(await Promise.race([p.then(()=>null,e=>e),timeout('hung')]),reason)
})
