import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as detect from '../../scraper/detecttechnologies/script.js'
import * as e2logy from '../../scraper/e2logysoftwaresolutions/script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/currentNative20261106C25/capture.json.gz',import.meta.url))))
const index='https://detecttechnologies.com/current-openings',corporate='https://e2logy.com/careers'
const fetchPage=async url=>{
 const page=fixture.documents[url];assert.ok(page,'Only original declared fixture URLs may be read: '+url)
 return {status:page.status,url:page.finalUrl,headers:page.headers,body:page.body,bodyUnavailable:page.bodyUnavailable}
}
test('Detect recognizes the actual current canonical Webflow vacancy index',()=>{
 assert.equal(detect.pageIndicatesJobCards(fixture.documents[index].body),true)
})
test('Detect current listing observations retain explicit US and unknown workplaces instead of manufacturing India',()=>{
 const rows=detect.extractSearchResults(fixture.documents[index].body)
 assert.equal(rows.length,9)
 const us=rows.find(row=>row.title==='IOT Intern - US'),remote=rows.find(row=>row.title==='DE 1 DA Robotics')
 assert.ok(us&&remote)
 assert.equal(us.country,'United States')
 assert.equal(remote.country,null)
 assert.equal(remote.sourceCountryScopeUnresolved,true)
 assert.ok(rows.filter(row=>row.location==='Chennai').every(row=>row.country===null))
})
test('Detect configured collection keeps full original role criteria and unknown countries rather than placeholder descriptions',async()=>{
 const jobs=await detect.createDetectTechnologiesScraper().run({fetchPage,fetchText:async()=>fixture.documents[index].body})
 assert.equal(jobs.length,8)
 assert.ok(jobs.every(job=>job.country===null&&job.sourceCountryScopeUnresolved===true&&job.requisitionId===null))
 assert.ok(jobs.every(job=>job.jobDescription.length>300&&!job.jobDescription.includes('Apply via the official Detect Technologies job page.')))
 assert.equal(jobs.find(job=>job.title==='QA Engineer 3').jobDescription.includes('JMeter'),true)
 assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false&&job.applicationVisited===false))
})
test('E2logy recognizes its current native card page rather than requiring the removed embed loader',()=>{
 assert.equal(e2logy.hasOfficialCareersSignal(fixture.documents[corporate].body),true)
})
test('E2logy follows its two literal employer role links and retains full published records as data without evaluating programs',async()=>{
 const jobs=await e2logy.run({fetchPage,fetchText:async url=>fixture.documents[url]?.body})
 assert.equal(jobs.length,2)
 assert.deepEqual(jobs.map(job=>job.jobId),['424443000011667046','424443000011620017'])
 assert.ok(jobs.every(job=>job.country==='India'&&job.requisitionId===null&&job.jobDescription.length>1000))
 assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false&&job.applicationVisited===false))
})
