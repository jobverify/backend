import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import * as kanoda from '../../scraper/kanodaenergysystemspvtltd/script.js'

// These original current response bytes are separately dated and hashed by the
// source regression suite. The old simplified fixture remains a negative case.
const capture=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/kanodaenergysystemspvtltd/fixtures/current20261110.json.gz',import.meta.url))))
const html=url=>Buffer.from(capture.packets.find(packet=>packet.requestedUrl===url).bodyBase64,'base64').toString('utf8')

test('Kanoda current native cards retain role criteria, qualifications and unknown formal requisition IDs',()=>{
 assert.equal(kanoda.hasOfficialHomepageSignal(html(kanoda.HOMEPAGE_URL)),true)
 assert.equal(kanoda.hasOfficialCareersSignal(html(kanoda.CAREERS_URL)),true)
 const jobs=kanoda.extractJobs(html(kanoda.CAREERS_URL))
 assert.deepEqual(jobs.map(job=>job.title),['Admin Executive | Immediate Joiner | Ahmedabad','Data Operator','Junior Design Engineer (Solar Design)','Senior Electrical Design Engineer'])
 for(const job of jobs){
  assert.equal(job.company,kanoda.COMPANY)
  assert.equal(job.country,'India')
  assert.equal(job.location,'Ahmedabad, Gujarat, India')
  assert.equal(job.requisitionId,null)
  assert.equal(job.sourceUrl,kanoda.CAREERS_URL)
  assert.equal(job.applyUrl,kanoda.CAREERS_URL)
  assert.equal(job.postingDate,null)
  assert.equal(job.closingDate,null)
  assert.equal(job.sourceScopeComplete,false)
  assert.equal(job.lifecycleCleanupAllowed,false)
 }
 const junior=jobs.find(job=>job.title==='Junior Design Engineer (Solar Design)')
 assert.match(junior.minimumQualification,/Bachelors\/ Diploma/)
 assert.ok(junior.requiredSkills.some(skill=>skill.includes('PVSyst')))
 assert.match(junior.jobDescription,/Survey Validation/)
 assert.match(junior.jobDescription,/PV System Design/)
 assert.match(jobs.find(job=>job.title==='Data Operator').minimumQualification,/B.Com/)
})
test('Kanoda registered source retains labels and caller timestamp without claiming complete inventory',async()=>{
 const requested=[]
 const jobs=await kanoda.createKanodaEnergySystemsScraper({now:()=> '2026-11-10T19:30:00.000Z'}).run({fetchText:async url=>{requested.push(url);return html(url)}})
 assert.deepEqual(requested,[kanoda.HOMEPAGE_URL,kanoda.CAREERS_URL])
 assert.equal(jobs.length,4)
 for(const job of jobs){assert.equal(job.source,kanoda.SOURCE);assert.equal(job.link,kanoda.CAREERS_URL);assert.equal(job.scrapedAt,'2026-11-10T19:30:00.000Z');assert.equal(job.sourceListingComplete,false)}
})
test('Kanoda old simplified fixture cannot qualify a current bound accordion inventory',()=>{
 const old=readFileSync(new URL('./fixtures/kanodaenergysystemspvtltd/careers.html',import.meta.url),'utf8')
 assert.equal(kanoda.hasOfficialCareersSignal(old),false)
 assert.throws(()=>kanoda.extractJobs(old),/verified native careers/)
})
