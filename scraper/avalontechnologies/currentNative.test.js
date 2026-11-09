import test from 'node:test'
import assert from 'node:assert/strict'
import {nativeFixture} from '../bizongo/nativeFixture.js'
import {createAvalonTechnologiesScraper,HOMEPAGE_URL,CAREERS_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const fixture=nativeFixture(import.meta.url),timeout=value=>new Promise(resolve=>setTimeout(()=>resolve(value),80))
test('current resume intake records unknown inventory without probing obsolete guessed job routes',async()=>{
 const calls=[],reports=[],jobs=await createAvalonTechnologiesScraper().run({fetchPage:async u=>{calls.push(u);return fixture.fetchPage(u)},onAudit:r=>reports.push(r)})
 assert.equal(jobs.length,0);assert.deepEqual(calls,[HOMEPAGE_URL,CAREERS_URL,HOMEPAGE_URL,CAREERS_URL]);assert.equal(reports.length,1)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(readSourceObservationEvidence(jobs,'avalontechnologies').observedVacancyCount,0)
 assert.equal(reports[0].observations[0].kind,'general-resume-intake');assert.equal(reports[0].observations[0].country,null)
 assert.ok(reports[0].structuralScripts.some(s=>s.visuallyInactive&&s.executable),'CSS-hidden ancestors do not prevent actual script execution')
})
test('unrelated homepage marketing copy does not veto a current same-company resume entry',async()=>{
 const jobs=await createAvalonTechnologiesScraper().run({fetchPage:async u=>{const r=await fixture.fetchPage(u);r.body=r.body.replaceAll('Trusted By','Trusted collaborators').replaceAll('Vertical Industry Leaders','Industry partners');return r}})
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('active criteria discovery remains a gap and inert role markup cannot manufacture vacancies',async()=>{
 const jobs=await createAvalonTechnologiesScraper().run({fetchPage:async u=>{const r=await fixture.fetchPage(u);r.body=r.body.replace('</body>','<!-- <a href="https://jobs.lever.co/other/1">Apply now</a> --><template><p>JobPosting</p></template></body>');return r}})
 assert.equal(readSourceObservationEvidence(jobs,'avalontechnologies').observedVacancyCount,0)
})
test('resume-intake observers cannot hang after caller abort',async()=>{
 const controller=new AbortController(),reason={abort:'avalon-observer'},p=createAvalonTechnologiesScraper().run({signal:controller.signal,fetchPage:fixture.fetchPage,onAudit:()=>{controller.abort(reason);return new Promise(()=>{})}})
 assert.equal(await Promise.race([p.then(()=>null,e=>e),timeout('hung')]),reason)
})
